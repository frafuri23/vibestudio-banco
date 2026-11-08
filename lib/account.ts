import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { create } from "zustand";
import { supabase } from "./supabase";
import { useStore } from "./store";
import { forget, revive } from "./live";
import { cleanName } from "./engine";
import { Evening, isDemoEvening } from "./history";
import { Table } from "./types";

// Account con email e password: nome, tavoli e serate passate restano salvati sul server
// (rpc banco_profile_get / banco_profile_save) e si ritrovano su ogni telefono o browser.
// Senza account il telefono continua a usare l'accesso anonimo, come prima.
// Accedendo, i posti al tavolo dell'accesso anonimo passano all'account (banco_handoff_*): host e giocatore restano.

type SaveStatus = "idle" | "saving" | "saved" | "error";
type AccountState = {
  ready: boolean;
  email: string | null; // null = nessun account
  userId: string | null;
  status: SaveStatus;
  savedAt: number | null;
  error: string | null;
};

export const useAccount = create<AccountState>(() => ({ ready: false, email: null, userId: null, status: "idle", savedAt: null, error: null }));

type Payload = { v: 1; tables: Record<string, Table>; past: Evening[]; deleted: string[] };
type Snapshot = { name: string; data: Payload };

const KEY = "banco.account.v1";
const MAX_DELETED = 300;

// Tavoli tolti da questo telefono (da togliere anche negli altri) e tavoli tornati dopo essere stati tolti
const deleted = new Set<string>();
const undeleted = new Set<string>();
let cloudVersion = 0;
let lastLocal = ""; // dati locali al momento dell'ultimo salvataggio riuscito
let adoptCloudName = false; // primo salvataggio dopo un accesso: vale il nome dell'account
let applying = false;
let resetting = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let running: Promise<void> | null = null;
let again = false;
let started = false;

const signedIn = () => !!useAccount.getState().userId;

// Account vero = utente con email e non anonimo (l'accesso anonimo del telefono non ha email)
const isAccountUser = (u: any) => !!u && !u.is_anonymous && typeof u.email === "string" && u.email.length > 0;

function setUser(session: any) {
  const u = session?.user;
  if (!isAccountUser(u)) useAccount.setState({ email: null, userId: null });
  else useAccount.setState({ email: u.email, userId: u.id });
}

export function authError(e: any): string {
  const code = String(e?.code || "");
  const msg = String(e?.message || e || "");
  if (code === "not_configured" || /not_configured/i.test(msg)) return "Il server non \u00E8 ancora collegato: riprova pi\u00F9 tardi";
  if (code === "invalid_credentials" || /invalid login credentials/i.test(msg)) return "Email o password sbagliate";
  if (code === "email_not_confirmed" || /email not confirmed/i.test(msg)) return "Prima conferma l'email: apri il link che ti abbiamo mandato";
  if (code === "user_already_exists" || code === "email_exists" || /already registered|already exists/i.test(msg)) return "Esiste gi\u00E0 un account con questa email: accedi";
  if (code === "weak_password" || /password should/i.test(msg)) return "Password troppo debole: usa almeno 6 caratteri";
  if (code === "email_address_not_authorized" || /not authorized/i.test(msg)) return "Il server non pu\u00F2 ancora mandare email a questo indirizzo: va attivato l'invio email su Supabase";
  if (code === "email_address_invalid" || /invalid.*email|email.*invalid/i.test(msg)) return "Questa email non sembra valida";
  if (/rate limit|too many/i.test(code + " " + msg)) return "Troppi tentativi: riprova tra qualche minuto";
  if (code === "signup_disabled" || /signups not allowed/i.test(msg)) return "Le registrazioni sono spente sul server";
  if (code === "email_provider_disabled" || /email logins are disabled/i.test(msg)) return "L'accesso con email \u00E8 spento sul server";
  if (code === "preview_unsupported") return "Non disponibile nell'anteprima: provalo sull'app";
  if (/failed to fetch|network request failed|networkerror|load failed/i.test(msg)) return "Nessuna connessione: riprova tra poco";
  if (code === "too_big") return "Troppi dati da salvare";
  return msg || "Qualcosa \u00E8 andato storto";
}

function codeError(code: string): Error {
  const e: any = new Error(code);
  e.code = code;
  return e;
}

// ---------- Dati da salvare ----------

function localSnapshot(): Snapshot {
  const s = useStore.getState();
  const tables: Record<string, Table> = {};
  for (const id of s.order) {
    const t = s.tables[id];
    if (t && !t.demo) tables[id] = t;
  }
  return { name: s.myName || "", data: { v: 1, tables, past: s.past.filter((e) => !isDemoEvening(e)), deleted: Array.from(deleted) } };
}

const isTable = (t: any): t is Table => !!t && typeof t === "object" && typeof t.id === "string" && Array.isArray(t.players) && Array.isArray(t.entries);
const isEvening = (e: any): e is Evening => !!e && typeof e === "object" && typeof e.id === "string" && Array.isArray(e.players);

function cloudSnapshot(c: any): Snapshot {
  const d = c?.data && typeof c.data === "object" ? c.data : {};
  const tables: Record<string, Table> = {};
  if (d.tables && typeof d.tables === "object") Object.keys(d.tables).forEach((id) => isTable(d.tables[id]) && (tables[id] = d.tables[id]));
  return {
    name: typeof c?.name === "string" ? c.name : "",
    data: {
      v: 1,
      tables,
      past: Array.isArray(d.past) ? d.past.filter(isEvening) : [],
      deleted: Array.isArray(d.deleted) ? d.deleted.filter((x: unknown) => typeof x === "string") : [],
    },
  };
}

const rank = (t: Table) => (t.status === "closed" ? 3 : t.endedAt ? 2 : t.status === "playing" ? 1 : 0);

// Lo stesso tavolo su due telefoni: vince quello pi\u00F9 avanti. Se \u00E8 in tempo reale decide il server, quindi resta quello di qui.
function better(a: Table, b: Table): Table {
  if (a.online) return a;
  const ka = [rank(a), a.entries.length, a.version || 0, a.players.length];
  const kb = [rank(b), b.entries.length, b.version || 0, b.players.length];
  for (let i = 0; i < ka.length; i++) {
    if (kb[i] > ka[i]) return b;
    if (kb[i] < ka[i]) return a;
  }
  return a;
}

function merge(local: Snapshot, cloud: Snapshot, adoptName: boolean): Snapshot {
  const gone = new Set([...cloud.data.deleted, ...local.data.deleted].filter((id) => !undeleted.has(id)));
  const tables: Record<string, Table> = {};
  const ids = new Set([...Object.keys(local.data.tables), ...Object.keys(cloud.data.tables)]);
  ids.forEach((id) => {
    if (gone.has(id)) return;
    const a = local.data.tables[id];
    const b = cloud.data.tables[id];
    tables[id] = a && b ? better(a, b) : a || b;
  });
  const past = [...local.data.past];
  const seen = new Set(past.map((e) => e.id));
  cloud.data.past.forEach((e) => !seen.has(e.id) && past.push(e));
  const name = adoptName ? cloud.name || local.name : local.name || cloud.name;
  return { name, data: { v: 1, tables, past, deleted: Array.from(gone).slice(-MAX_DELETED) } };
}

// Impronta per capire se il server ha gi\u00E0 questi dati (l'ordine delle chiavi del server \u00E8 diverso)
function coarse(s: Snapshot): string {
  const ids = Object.keys(s.data.tables).sort();
  return JSON.stringify([
    s.name,
    ids.map((id) => {
      const t = s.data.tables[id];
      return [id, t.name, t.status, t.endedAt || 0, t.entries.length, t.version || 0, t.players.map((p) => p.id + p.name + p.color).join(","), (t.payments || []).map((p) => p.status).join(",")];
    }),
    s.data.past.map((e) => e.id).sort(),
    [...s.data.deleted].sort(),
  ]);
}

// Mette su questo telefono quello che \u00E8 arrivato dagli altri (tavoli nuovi, tavoli tolti, serate)
function applyToStore(m: Snapshot) {
  const s = useStore.getState();
  const tables = { ...s.tables };
  let changed = false;
  m.data.deleted.forEach((id) => {
    if (tables[id] && !tables[id].demo) {
      forget(id);
      delete tables[id];
      changed = true;
    }
  });
  Object.keys(m.data.tables).forEach((id) => {
    const t = m.data.tables[id];
    if (tables[id] === t) return;
    if (!tables[id]) revive(id);
    tables[id] = t;
    changed = true;
  });
  const localDemos = s.past.filter((e) => isDemoEvening(e));
  const past = [...localDemos, ...m.data.past];
  const pastChanged = past.length !== s.past.length || past.some((e, i) => e !== s.past[i]);
  if (!changed && !pastChanged) return;
  const order = Object.keys(tables).sort((a, b) => (tables[b].createdAt || 0) - (tables[a].createdAt || 0));
  applying = true;
  try {
    useStore.setState({ tables, order, past });
  } finally {
    applying = false;
  }
}

async function persistMarks() {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ deleted: Array.from(deleted), undeleted: Array.from(undeleted) }));
  } catch {
    // si riprova alla prossima modifica
  }
}

// ---------- Salvataggio ----------

async function runSync(force: boolean): Promise<void> {
  if (!signedIn()) return;
  const changedLocally = JSON.stringify(localSnapshot()) !== lastLocal;
  if (!force && !changedLocally) return;
  useAccount.setState({ status: "saving", error: null });
  try {
    for (let tries = 0; tries < 5; tries++) {
      const { data: got, error } = await supabase.rpc("banco_profile_get");
      if (error) throw error;
      if (got?.error) throw codeError(String(got.error));
      const cloud = cloudSnapshot(got);
      cloudVersion = Number(got?.version) || 0;
      const merged = merge(localSnapshot(), cloud, adoptCloudName);
      applyToStore(merged);
      const st = useStore.getState();
      if (merged.name && merged.name !== st.myName) st.setMyName(merged.name);
      const needSave = changedLocally || coarse(merged) !== coarse(cloud);
      if (needSave) {
        const { data: res, error: err2 } = await supabase.rpc("banco_profile_save", { p_version: cloudVersion, p_name: merged.name, p_data: merged.data });
        if (err2) throw err2;
        if (res?.error === "conflict") continue; // un altro telefono ha appena salvato: si riunisce e si riprova
        if (res?.error) throw codeError(String(res.error));
        cloudVersion = Number(res?.version) || cloudVersion + 1;
      }
      adoptCloudName = false;
      deleted.clear();
      undeleted.clear();
      persistMarks();
      lastLocal = JSON.stringify(localSnapshot());
      useAccount.setState({ status: "saved", savedAt: Date.now(), error: null });
      return;
    }
    throw new Error("Altri telefoni stanno salvando: riprovo tra poco");
  } catch (e: any) {
    useAccount.setState({ status: "error", error: authError(e) });
  }
}

// Salva adesso (e attende). Se un salvataggio \u00E8 gi\u00E0 in corso ne accoda un altro.
export function syncNow(force = true): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await runSync(force);
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

function schedule(ms = 3000) {
  if (!signedIn()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    syncNow(false).catch(() => {});
  }, ms);
}

export function initAccount() {
  if (started) return;
  started = true;
  AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (!raw) return;
      const d = JSON.parse(raw);
      if (Array.isArray(d?.deleted)) d.deleted.forEach((x: unknown) => typeof x === "string" && deleted.add(x));
      if (Array.isArray(d?.undeleted)) d.undeleted.forEach((x: unknown) => typeof x === "string" && undeleted.add(x));
    })
    .catch(() => {});
  supabase.auth
    .getSession()
    .then(({ data }) => {
      setUser(data?.session);
      useAccount.setState({ ready: true });
      if (signedIn()) syncNow(true).catch(() => {});
    })
    .catch(() => useAccount.setState({ ready: true }));
  try {
    supabase.auth.onAuthStateChange((_event, session) => {
      // Niente chiamate al server qui dentro: solo lo stato
      if (resetting) return;
      setUser(session);
    });
  } catch {
    // ascolto non disponibile: lo stato si aggiorna dopo accesso e uscita
  }
  useStore.subscribe((s, prev) => {
    if (applying || resetting || !signedIn()) return;
    if (s.tables === prev.tables && s.past === prev.past && s.myName === prev.myName && s.order === prev.order) return;
    let marks = false;
    Object.keys(prev.tables).forEach((id) => {
      if (!s.tables[id] && !prev.tables[id]?.demo) {
        deleted.add(id);
        undeleted.delete(id);
        marks = true;
      }
    });
    Object.keys(s.tables).forEach((id) => {
      if (!prev.tables[id] && deleted.has(id)) {
        deleted.delete(id);
        undeleted.add(id);
        marks = true;
      }
    });
    if (marks) persistMarks();
    schedule();
  });
  AppState.addEventListener("change", (st) => {
    if (st === "active" && signedIn()) syncNow(true).catch(() => {});
  });
}

// ---------- Accesso, registrazione, uscita ----------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Gettone che porta i posti al tavolo dell'accesso anonimo nell'account
async function handoffStart(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const u = data?.session?.user;
    if (!u || isAccountUser(u)) return null;
    const { data: d } = await supabase.rpc("banco_handoff_start");
    return typeof d?.token === "string" ? d.token : null;
  } catch {
    return null;
  }
}

async function handoffFinish(token: string | null) {
  if (!token) return;
  try {
    await supabase.rpc("banco_handoff_finish", { p_token: token });
  } catch {
    // senza passaggio si rientra comunque ai tavoli col codice
  }
}

async function afterSignIn(session: any, adopt: boolean) {
  setUser(session);
  adoptCloudName = adopt;
  lastLocal = "";
  await syncNow(true);
}

export async function signIn(email: string, password: string): Promise<{ error?: string }> {
  const em = email.trim().toLowerCase();
  if (!EMAIL_RE.test(em)) return { error: "Scrivi un'email valida" };
  if (!password) return { error: "Scrivi la password" };
  try {
    const token = await handoffStart();
    const { data, error } = await supabase.auth.signInWithPassword({ email: em, password });
    if (error) return { error: authError(error) };
    if (!data?.session) return { error: "Accesso non riuscito: riprova" };
    await handoffFinish(token);
    await afterSignIn(data.session, true);
    return {};
  } catch (e: any) {
    return { error: authError(e) };
  }
}

// confirm: true = il server chiede di confermare l'email prima di accedere
export async function signUp(email: string, password: string, name: string): Promise<{ error?: string; confirm?: boolean }> {
  const em = email.trim().toLowerCase();
  const nm = cleanName(name);
  if (!nm) return { error: "Scrivi il nome che vedono al tavolo" };
  if (!EMAIL_RE.test(em)) return { error: "Scrivi un'email valida" };
  if (password.length < 6) return { error: "La password deve avere almeno 6 caratteri" };
  try {
    const token = await handoffStart();
    const { data, error } = await supabase.auth.signUp({ email: em, password, options: { data: { name: nm } } });
    if (error) return { error: authError(error) };
    // Email gi\u00E0 registrata con la conferma attiva: Supabase risponde con un utente senza identit\u00E0
    if (data?.user && Array.isArray((data.user as any).identities) && (data.user as any).identities.length === 0) {
      return { error: "Esiste gi\u00E0 un account con questa email: accedi" };
    }
    // Registrazione accettata: il nome scelto diventa quello di questo telefono (e dell'account)
    useStore.getState().setMyName(nm);
    if (!data?.session) return { confirm: true };
    await handoffFinish(token);
    await afterSignIn(data.session, false);
    return {};
  } catch (e: any) {
    return { error: authError(e) };
  }
}

// Esce dall'account: prima salva, poi toglie da questo telefono i dati dell'account (restano sul server)
export async function signOut(): Promise<{ error?: string }> {
  if (!signedIn()) return {};
  await syncNow(true);
  if (useAccount.getState().status !== "saved" || JSON.stringify(localSnapshot()) !== lastLocal) {
    return { error: "Non riesco a salvare gli ultimi dati: riprova quando sei online" };
  }
  resetting = true;
  try {
    const { error } = await supabase.auth.signOut();
    if (error) return { error: authError(error) };
    if (timer) clearTimeout(timer);
    timer = null;
    const s = useStore.getState();
    Object.keys(s.tables).forEach((id) => forget(id));
    useStore.setState({ tables: {}, order: [], past: [], myName: "", seeded: true, pastSeeded: true });
    deleted.clear();
    undeleted.clear();
    persistMarks();
    lastLocal = "";
    cloudVersion = 0;
    useAccount.setState({ email: null, userId: null, status: "idle", savedAt: null, error: null });
    return {};
  } catch (e: any) {
    return { error: authError(e) };
  } finally {
    resetting = false;
  }
}
