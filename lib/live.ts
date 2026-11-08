import { AppState } from "react-native";
import { create } from "zustand";
import type { Result } from "./engine";
import { makeCode } from "./games";
import { claimRemote, commitRemote, createRemote, fetchRemote, joinRemote, niceError, Remote, subscribeTable } from "./sync";
import { Table } from "./types";
import { toast } from "../components/Toast";

// Tempo reale: lo stato confermato dal server + una coda di mosse in attesa.
// Lo schermo mostra sempre "confermato + mosse in coda" (ottimista); il server ha l'ultima parola.

export type Fn = (t: Table) => Result | Table;
type Api = { get: (id: string) => Table | undefined; put: (t: Table) => void };

let api: Api = { get: () => undefined, put: () => {} };
export function initLive(a: Api) {
  api = a;
}

const confirmed: Record<string, Table> = {};
const queue: Record<string, Fn[]> = {};
const running: Record<string, boolean> = {};
const maxSeq: Record<string, number> = {};
const local: Record<string, { me?: string; bankMe?: string }> = {};
const watchers: Record<string, { n: number; off: () => void }> = {};
const syncing: Record<string, boolean> = {};
// Tavoli tolti da questo telefono: una risposta del server arrivata dopo non li fa ricomparire
const gone = new Set<string>();
// Il giocatore a cui il server ha legato questo telefono (null = nessuno ancora; assente = server non ancora sentito)
const mine: Record<string, string | null> = {};
const claimTried: Record<string, string> = {};
// Risposte di banco_claim che non cambiano riprovando
const FINAL_CLAIM_ERRORS = new Set(["taken", "already", "no_player"]);

// Stato confermato a partire da una risposta del server
function fromRemote(id: string, remote: Remote, entries = remote.entries): Table {
  mine[id] = remote.mine;
  return withLocal({ ...remote.state, entries, version: remote.version, phones: remote.phones });
}

// Chi si è seduto da questo telefono viene legato al suo giocatore sul server, una volta sola.
// Serve a fine serata: "Segna ricevuto" lo accetta solo da chi riceve i soldi.
function maybeClaim(id: string) {
  const base = confirmed[id];
  if (!base || gone.has(id) || !(id in mine) || mine[id]) return;
  const me = local[id]?.me ?? base.me;
  if (!me || claimTried[id] === me) return;
  const p = base.players.find((x) => x.id === me);
  if (!p || p.isHost || p.noPhone || (base.phones || []).includes(me)) return;
  claimTried[id] = me;
  claimRemote(id, me)
    .then((r) => {
      if (r.ok) {
        mine[id] = me;
        refresh(id).catch(() => {});
        return;
      }
      // Risposta definitiva del server: non si riprova. Altrimenti si riprova al prossimo refresh o alla prossima mossa.
      if (!FINAL_CLAIM_ERRORS.has(r.error || "") && claimTried[id] === me) delete claimTried[id];
    })
    .catch(() => {
      // Rete o errore temporaneo
      if (claimTried[id] === me) delete claimTried[id];
    });
}

// Stato visibile della sincronizzazione, per il badge "In tempo reale" delle schermate di gioco
type LiveStatus = { pending: Record<string, boolean>; offline: Record<string, boolean> };
export const useLiveStatus = create<LiveStatus>(() => ({ pending: {}, offline: {} }));

function mark(id: string, patch: { pending?: boolean; offline?: boolean }) {
  const s = useLiveStatus.getState();
  const samePending = patch.pending === undefined || !!s.pending[id] === patch.pending;
  const sameOffline = patch.offline === undefined || !!s.offline[id] === patch.offline;
  if (samePending && sameOffline) return;
  useLiveStatus.setState({
    pending: samePending ? s.pending : { ...s.pending, [id]: !!patch.pending },
    offline: sameOffline ? s.offline : { ...s.offline, [id]: !!patch.offline },
  });
}

function put(t: Table) {
  if (gone.has(t.id)) return;
  api.put(t);
}

// Toglie il tavolo da questo telefono: smette di ascoltarlo. Il registro sul server resta com'è.
export function forget(id: string) {
  gone.add(id);
  const w = watchers[id];
  if (w) {
    try {
      w.off();
    } catch {
      // canale già chiuso
    }
    delete watchers[id];
  }
}

// Il tavolo torna su questo telefono (es. ripreso dall'account dopo un nuovo accesso)
export function revive(id: string) {
  gone.delete(id);
}

export function runFn(fn: Fn, t: Table): Result {
  try {
    const out = fn(t);
    return "table" in out && (out as Result).table ? (out as Result) : { table: out as Table };
  } catch (e: any) {
    return { table: t, error: e?.message || "Qualcosa \u00E8 andato storto" };
  }
}

// Quello che è solo di questo telefono: chi sono io, chi sto guardando nel gioco con banca
function withLocal(t: Table): Table {
  const cur = api.get(t.id);
  const me = local[t.id]?.me ?? cur?.me ?? t.me ?? "";
  const bankMe = local[t.id]?.bankMe ?? cur?.bank?.me;
  const bank = t.bank ? { ...t.bank, me: bankMe || me || t.bank.me } : t.bank;
  return { ...t, me, bank, online: true };
}

export function setLocalMe(id: string, me: string) {
  local[id] = { ...local[id], me };
  if (confirmed[id]) confirmed[id] = { ...confirmed[id], me };
}

export function setLocalBankMe(id: string, pid: string) {
  local[id] = { ...local[id], bankMe: pid };
}

export function isPending(id: string): boolean {
  return !!(queue[id] && queue[id].length) || !!syncing[id];
}

function recompute(id: string) {
  const base = confirmed[id];
  if (!base) return;
  let t = withLocal(base);
  for (const fn of queue[id] || []) t = runFn(fn, t).table;
  put(t);
}

const CLOSED_MSG = "\u00E8 stato chiuso sul server: ora resta solo su questo telefono";

// Il tavolo non c'è più (o è chiuso) sul server e non si può rientrare: torna un tavolo locale.
// Si gioca come prima su questo telefono, con le mosse già fatte qui; niente più coda verso il server.
function goLocal(id: string) {
  const cur = api.get(id);
  delete confirmed[id];
  delete maxSeq[id];
  queue[id] = [];
  const w = watchers[id];
  if (w) {
    try {
      w.off();
    } catch {
      // canale già chiuso
    }
    delete watchers[id];
  }
  mark(id, { offline: false, pending: false });
  if (cur && cur.online) {
    put({ ...cur, online: false, version: undefined });
    toast.info("\u00AB" + cur.name + "\u00BB " + CLOSED_MSG);
  }
}

function closedError(): Error {
  const e: any = new Error("Questo tavolo " + CLOSED_MSG);
  e.code = "closed";
  return e;
}

// Legge il tavolo dal server. Il server risponde solo ai membri: se questo telefono non risulta più al tavolo
// (sessione nuova, tavolo portato online prima dei membri) rientra col codice che conosce, come un ospite.
// Se nemmeno col codice si rientra (tavolo chiuso sul server) il tavolo torna locale.
async function pull(id: string, after: number): Promise<{ remote: Remote; after: number }> {
  try {
    return { remote: await fetchRemote(id, after), after };
  } catch (e: any) {
    if (e?.code !== "forbidden") throw e;
    const code = (confirmed[id] || api.get(id))?.code;
    const remote = code ? await joinRemote(code, id) : null;
    if (!remote) {
      goLocal(id);
      throw closedError();
    }
    return { remote, after: 0 };
  }
}

export async function refresh(id: string, full = false): Promise<void> {
  const prev = confirmed[id];
  const { remote, after } = await pull(id, full || !prev ? 0 : maxSeq[id] || 0);
  const now = confirmed[id];
  if (now && (now.version || 0) > remote.version) return; // arrivata una risposta vecchia
  let entries = remote.entries;
  if (after > 0 && now) {
    const seen = new Set(now.entries.map((e) => e.id));
    entries = [...now.entries, ...remote.entries.filter((e) => !seen.has(e.id))];
  }
  maxSeq[id] = Math.max(after > 0 ? maxSeq[id] || 0 : 0, remote.maxSeq);
  confirmed[id] = fromRemote(id, remote, entries);
  mark(id, { offline: false });
  recompute(id);
  maybeClaim(id);
}

export function enqueue(id: string, fn: Fn) {
  (queue[id] = queue[id] || []).push(fn);
  mark(id, { pending: true });
  drain(id);
}

async function drain(id: string) {
  if (running[id]) return;
  running[id] = true;
  try {
    while ((queue[id] || []).length) {
      const fn = queue[id][0];
      let failMsg: string | null = null;
      try {
        if (!confirmed[id]) await refresh(id, true);
        for (let tries = 0; ; tries++) {
          const base = withLocal(confirmed[id]);
          const r = runFn(fn, base);
          if (r.error && r.table === base) {
            failMsg = r.error;
            break;
          }
          const added = r.table.entries.slice(base.entries.length);
          const res = await commitRemote(id, base.version || 1, r.table, added);
          if ("version" in res) {
            if ((confirmed[id]?.version || 0) < res.version) confirmed[id] = { ...r.table, version: res.version, online: true };
            mark(id, { offline: false });
            maybeClaim(id);
            break;
          }
          if (res.error === "conflict" && tries < 5) {
            await refresh(id);
            continue;
          }
          if (res.error === "forbidden" && tries < 2) {
            // Il server non riconosce questo telefono al tavolo: rientra col codice e riprova
            await refresh(id, true);
            continue;
          }
          failMsg = res.message;
          await refresh(id).catch(() => {});
          break;
        }
      } catch (e: any) {
        // Tavolo tornato locale: l'avviso l'ha già dato goLocal, e la mossa è già sullo schermo
        if (e?.code !== "closed") {
          failMsg = niceError(e);
          mark(id, { offline: true });
        }
      }
      (queue[id] = queue[id] || []).shift();
      if (failMsg) toast.error(failMsg);
      recompute(id);
    }
  } finally {
    running[id] = false;
    mark(id, { pending: false });
  }
}

// L'host porta il tavolo sul server: da qui in poi chiunque col codice lo vede in tempo reale
export async function publish(id: string): Promise<{ ok: boolean; error?: string }> {
  const start = api.get(id);
  if (!start) return { ok: false, error: "Tavolo non trovato" };
  if (start.online) return { ok: true };
  if (syncing[id]) return { ok: false, error: "Sto gi\u00E0 collegando il tavolo" };
  syncing[id] = true;
  mark(id, { pending: true });
  try {
    let snap = start;
    for (let i = 0; i < 5; i++) {
      const res = await createRemote(snap);
      if ("version" in res) {
        local[id] = { ...local[id], me: snap.me, bankMe: snap.bank?.me };
        maxSeq[id] = 0;
        // Il server lega chi crea il tavolo al giocatore host
        const host = snap.players.filter((p) => p.isHost).map((p) => p.id);
        mine[id] = host[0] || null;
        confirmed[id] = { ...snap, online: true, version: res.version, phones: host };
        mark(id, { offline: false });
        const cur = api.get(id);
        recompute(id);
        // Mosse fatte mentre il tavolo andava online: si mandano adesso
        if (cur && cur !== start) {
          const extra = cur.entries.slice(start.entries.length);
          enqueue(id, (b) => ({ ...cur, code: b.code, me: b.me, online: true, version: b.version, entries: [...b.entries, ...extra] }));
        }
        return { ok: true };
      }
      if (res.error === "code_taken") {
        snap = { ...snap, code: makeCode() };
        put({ ...(api.get(id) || snap), code: snap.code });
        continue;
      }
      if (res.error === "exists") {
        // Già sul server ma questo telefono non risulta al tavolo: si rientra col codice, se è ancora aperto
        const remote = await joinRemote(snap.code, id);
        if (!remote) return { ok: false, error: "Questo tavolo " + CLOSED_MSG + ". Per il tempo reale crea un tavolo nuovo" };
        local[id] = { ...local[id], me: snap.me, bankMe: snap.bank?.me };
        maxSeq[id] = remote.maxSeq;
        confirmed[id] = fromRemote(id, remote);
        mark(id, { offline: false });
        recompute(id);
        return { ok: true };
      }
      return { ok: false, error: res.message };
    }
    return { ok: false, error: "Non trovo un codice libero, riprova" };
  } catch (e: any) {
    return { ok: false, error: niceError(e) };
  } finally {
    syncing[id] = false;
    if (!running[id]) mark(id, { pending: false });
  }
}

// Un ospite cerca un tavolo per codice (su un altro telefono o nel browser)
export async function findByCode(code: string): Promise<Table | null> {
  // Entrare col codice rende questo telefono membro del tavolo sul server
  const remote = await joinRemote(code.toUpperCase());
  if (!remote) return null;
  const id = remote.state.id;
  gone.delete(id); // rientrare col codice lo riporta su questo telefono
  maxSeq[id] = remote.maxSeq;
  confirmed[id] = fromRemote(id, remote);
  recompute(id);
  return api.get(id) || null;
}

export function watch(id: string): () => void {
  const w = watchers[id];
  if (w) w.n++;
  else {
    const off = subscribeTable(id, (v) => {
      if (v > (confirmed[id]?.version || 0)) refresh(id).catch(() => {});
    });
    watchers[id] = { n: 1, off };
    refresh(id, !confirmed[id]).catch(() => {});
  }
  return () => {
    const x = watchers[id];
    if (!x) return;
    x.n -= 1;
    if (x.n <= 0) {
      x.off();
      delete watchers[id];
    }
  };
}

// Tornando in primo piano ci si riallinea: il telefono può aver perso degli eventi
AppState.addEventListener("change", (s) => {
  if (s !== "active") return;
  Object.keys(watchers).forEach((id) => refresh(id).catch(() => {}));
});
