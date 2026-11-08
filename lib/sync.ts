import { ensureUser, supabase } from "./supabase";
import { Entry, Table } from "./types";

// Livello di trasporto verso Supabase. Nessuna logica di gioco qui:
// il server riceve lo stato del tavolo + le righe nuove del registro e decide se accettarle.
// Ogni chiamata parte con l'identità anonima di questo telefono: il server risponde solo ai membri del tavolo.

// phones: giocatori legati a un telefono sul server; mine: il giocatore di questo telefono (se già legato)
export type Remote = { state: Table; entries: Entry[]; version: number; maxSeq: number; phones: string[]; mine: string | null };
export type CommitResult = { version: number } | { error: string; message: string };

// Campi che restano su questo telefono e non vanno sul server
export function toState(t: Table): Record<string, unknown> {
  const { entries, me, online, version, phones, ...rest } = t;
  void entries;
  void me;
  void online;
  void version;
  void phones;
  return rest as Record<string, unknown>;
}

const SERVER_ERRORS: Record<string, string> = {
  auth: "Accesso al server non riuscito: riprova tra poco",
  forbidden: "Questo telefono non risulta seduto al tavolo",
  rate_limited: "Troppi codici sbagliati: riprova tra 15 minuti",
  not_found: "Nessun tavolo aperto con questo codice",
  exists: "Questo tavolo è già sul server: entra con il suo codice",
  code_taken: "Codice già in uso",
  conflict: "Qualcuno ha appena fatto una mossa",
  negative: "Il banco ha rifiutato la mossa: un saldo andrebbe sotto zero",
  not_receiver: "Solo chi riceve i soldi può segnarli come ricevuti",
  not_allowed: "Il nome di un giocatore lo cambiano solo lui e l'host",
};

export function niceError(e: any): string {
  const code = String(e?.code || "");
  const msg = String(e?.message || e || "");
  if (code === "not_configured" || /not_configured/i.test(msg)) return "Supabase non è ancora collegato: il tavolo resta su questo telefono";
  if (code === "anonymous_provider_disabled" || code === "signup_disabled" || /anonymous sign-ins are disabled|signups not allowed/i.test(msg))
    return "Su Supabase l'accesso anonimo è spento: attivalo per giocare in tempo reale";
  if (code === "PGRST202" || /could not find the function|does not exist/i.test(msg)) return "Il database del tempo reale non è ancora pronto";
  if (/failed to fetch|network request failed|networkerror|load failed/i.test(msg)) return "Nessuna connessione: riprova tra poco";
  if (SERVER_ERRORS[code]) return SERVER_ERRORS[code];
  return msg || "Errore del server";
}

function remoteError(code: string, message?: string): Error {
  const e: any = new Error(message || SERVER_ERRORS[code] || "Errore del server");
  e.code = code;
  return e;
}

// Chiamata a una funzione del server con l'identità di questo telefono
async function call(fn: string, args: Record<string, unknown>): Promise<any> {
  try {
    await ensureUser();
  } catch (e: any) {
    throw remoteError("auth", niceError(e));
  }
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw remoteError(String((error as any).code || "server"), niceError(error));
  return data || {};
}

function toEntry(r: any): Entry {
  return {
    id: String(r.id),
    ts: Number(r.ts) || Date.now(),
    from: String(r.from),
    to: String(r.to),
    amount: Number(r.amount) || 0,
    kind: r.kind,
    note: r.note ?? undefined,
    undoOf: r.undoOf ?? undefined,
  };
}

function toPayload(e: Entry) {
  return { id: e.id, ts: e.ts, from: e.from, to: e.to, amount: e.amount, kind: e.kind, note: e.note ?? null, undoOf: e.undoOf ?? null };
}

function toRemote(data: any, after: number): Remote | null {
  const row = data?.table;
  if (!row || !row.state) return null;
  const list: any[] = Array.isArray(data.entries) ? data.entries : [];
  const maxSeq = list.reduce((m, r) => Math.max(m, Number(r.seq) || 0), after);
  const state = { ...(row.state as Table), id: String(row.id), code: String(row.code) };
  const phones = Array.isArray(data.phones) ? data.phones.filter((x: unknown) => typeof x === "string") : [];
  const mine = typeof data.mine === "string" ? data.mine : null;
  return { state, entries: list.map(toEntry), version: Number(row.version) || 1, maxSeq, phones, mine };
}

// Legge un tavolo di cui questo telefono è membro. Errore "forbidden" se non lo è (o se il tavolo non esiste).
export async function fetchRemote(id: string, after = 0): Promise<Remote> {
  const d = await call("banco_get", { p_id: id, p_after: after });
  if (d.error) throw remoteError(String(d.error));
  const r = toRemote(d, after);
  if (!r) throw remoteError("forbidden");
  return r;
}

// Entra con il codice: l'unico modo per diventare membro di un tavolo creato da altri.
// id (facoltativo): rientra solo in quel tavolo, non in un altro che ha preso lo stesso codice.
export async function joinRemote(code: string, id?: string): Promise<Remote | null> {
  const d = await call("banco_join", { p_code: code.toUpperCase(), p_id: id ?? null });
  if (d.error === "not_found") return null;
  if (d.error) throw remoteError(String(d.error));
  return toRemote(d, 0);
}

// Lega questo telefono al suo giocatore: da qui in poi il server sa chi riceve i soldi a fine serata
// error: taken / already / no_player sono risposte definitive; le altre (rete, accesso, forbidden) si possono riprovare
export async function claimRemote(id: string, pid: string): Promise<{ ok: boolean; error?: string }> {
  const d = await call("banco_claim", { p_id: id, p_player: pid });
  return d.ok ? { ok: true } : { ok: false, error: String(d.error || "server") };
}

export async function createRemote(t: Table): Promise<CommitResult> {
  let d: any;
  try {
    d = await call("banco_create", {
      p_id: t.id,
      p_code: t.code,
      p_kind: t.kind,
      p_name: t.name,
      p_status: t.status,
      p_state: toState(t),
      p_entries: t.entries.map(toPayload),
    });
  } catch (e: any) {
    return { error: String(e?.code || "server"), message: e?.message || niceError(e) };
  }
  if (d.error) return { error: String(d.error), message: SERVER_ERRORS[d.error] || String(d.detail || d.error) };
  return { version: Number(d.version) || 1 };
}

export async function commitRemote(id: string, baseVersion: number, next: Table, added: Entry[]): Promise<CommitResult> {
  let d: any;
  try {
    d = await call("banco_commit", {
      p_id: id,
      p_version: baseVersion,
      p_state: toState(next),
      p_entries: added.map(toPayload),
    });
  } catch (e: any) {
    return { error: String(e?.code || "server"), message: e?.message || niceError(e) };
  }
  if (d.error) {
    const code = String(d.error);
    return { error: code, message: SERVER_ERRORS[code] || (code === "not_found" ? "Il tavolo non esiste più sul server" : "Il banco ha rifiutato la mossa") };
  }
  return { version: Number(d.version) || baseVersion + 1 };
}

// Un canale broadcast per tavolo: dopo ogni mossa il server manda solo il nuovo numero di versione
// e chi guarda si riallinea leggendo il tavolo (da membro). Nessun dato del tavolo passa dal canale.
export function subscribeTable(id: string, onVersion: (v: number) => void): () => void {
  try {
    const ch = supabase
      .channel("banco-" + id)
      .on("broadcast" as any, { event: "version" }, (msg: any) => {
        const v = Number(msg?.payload?.version ?? msg?.version) || 0;
        if (v) onVersion(v);
      })
      .subscribe();
    return () => {
      try {
        supabase.removeChannel(ch);
      } catch {
        // canale già chiuso
      }
    };
  } catch {
    return () => {};
  }
}
