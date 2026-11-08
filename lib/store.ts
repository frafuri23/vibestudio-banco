import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { Table } from "./types";
import { cleanName, LEGACY_HOST, renamePlayer } from "./engine";
import { enqueue, Fn, forget, initLive, runFn, setLocalBankMe, setLocalMe, watch } from "./live";
import { looksLikeSeed, seedTables } from "./seed";
import { Evening, isDemoEvening, seedHistory } from "./history";

const KEY = "banco.v1";

type Outcome = { error?: string; info?: string };

type S = {
  tables: Record<string, Table>;
  order: string[];
  seeded: boolean;
  hydrated: boolean;
  past: Evening[]; // serate di cui resta solo il riassunto (storico)
  pastSeeded: boolean;
  cleaned: boolean; // pulizia una tantum dei tavoli di prova vuoti già fatta
  demoMarked: boolean; // tavoli e serate di esempio già segnati come "demo"
  myName: string; // come ti chiamano al tavolo: il nome dell'host nei tavoli creati da questo telefono
  // Salva il nome e lo mette al posto di "Tu" nei tavoli in cui questo telefono è l'host
  setMyName: (name: string) => { error?: string; renamed: number };
  add: (t: Table) => void;
  // Unico punto di scrittura: ogni operazione passa da qui. Sui tavoli online va anche al server,
  // che la riapplica sull'ultimo stato confermato e controlla che nessun saldo vada sotto zero.
  apply: (id: string, fn: Fn) => Outcome;
  setMe: (id: string, pid: string) => void;
  setBankView: (id: string, pid: string) => void;
  remove: (id: string) => void;
  // Toglie tutti gli esempi del primo avvio (tavoli e serate dello storico). Non tornano più.
  removeDemos: () => { tables: number; evenings: number };
};

export const useStore = create<S>((set, get) => ({
  tables: {},
  order: [],
  seeded: false,
  hydrated: false,
  past: [],
  pastSeeded: false,
  cleaned: false,
  demoMarked: false,
  myName: "",
  setMyName: (name) => {
    const clean = cleanName(name);
    if (!clean) return { error: "Scrivi il tuo nome", renamed: 0 };
    const prev = get().myName;
    set({ myName: clean });
    let renamed = 0;
    const s = get();
    for (const id of s.order) {
      const t = s.tables[id];
      const meP = t?.players?.find((p) => p.id === t.me);
      if (!t || !meP || meP.noPhone || meP.name === clean) continue;
      // "Tu" dell'host (anche nelle serate chiuse), oppure il nome di prima nei tavoli ancora aperti
      const legacy = !!meP.isHost && meP.name === LEGACY_HOST;
      const old = !!prev && meP.name === prev && t.status !== "closed";
      if (!legacy && !old) continue;
      const r = get().apply(id, (x) => renamePlayer(x, meP.id, clean));
      if (!r.error) renamed++;
    }
    return { renamed };
  },
  add: (t) => set((s) => ({ tables: { ...s.tables, [t.id]: t }, order: [t.id, ...s.order.filter((x) => x !== t.id)] })),
  apply: (id, fn) => {
    const t = get().tables[id];
    if (!t) return { error: "Tavolo non trovato" };
    const res = runFn(fn, t);
    if (res.error && res.table === t) return { error: res.error };
    set((s) => ({ tables: { ...s.tables, [id]: res.table } }));
    if (t.online) enqueue(id, fn);
    return { error: res.error, info: res.info };
  },
  setMe: (id, pid) => {
    setLocalMe(id, pid);
    set((s) => (s.tables[id] ? { tables: { ...s.tables, [id]: { ...s.tables[id], me: pid } } } : s));
  },
  setBankView: (id, pid) => {
    setLocalBankMe(id, pid);
    set((s) => {
      const t = s.tables[id];
      if (!t || !t.bank) return s;
      return { tables: { ...s.tables, [id]: { ...t, bank: { ...t.bank, me: pid } } } };
    });
  },
  remove: (id) => {
    forget(id);
    set((s) => {
      const tables = { ...s.tables };
      delete tables[id];
      return { tables, order: s.order.filter((x) => x !== id) };
    });
  },
  removeDemos: () => {
    const s = get();
    const ids = s.order.filter((id) => s.tables[id]?.demo);
    const evenings = s.past.filter((e) => isDemoEvening(e)).length;
    ids.forEach((id) => forget(id));
    const tables = { ...s.tables };
    ids.forEach((id) => delete tables[id]);
    set({ tables, order: s.order.filter((id) => !ids.includes(id)), past: s.past.filter((e) => !isDemoEvening(e)), seeded: true, pastSeeded: true });
    return { tables: ids.length, evenings };
  },
}));

// Tavolo mai partito: in attesa, nessun movimento e al tavolo c'è solo l'host
function isEmptyLobby(t: Table | undefined, now: number): boolean {
  if (!t || t.status !== "lobby" || t.endedAt) return false;
  if ((t.entries || []).length) return false;
  if ((t.players || []).some((p) => !p.isHost)) return false;
  return now - (t.createdAt || now) > 10 * 60000;
}

initLive({
  get: (id) => useStore.getState().tables[id],
  put: (t) =>
    useStore.setState((s) => ({
      tables: { ...s.tables, [t.id]: t },
      order: s.order.includes(t.id) ? s.order : [t.id, ...s.order],
    })),
});

// Legge un tavolo e, se è online, resta in ascolto del suo canale in tempo reale
export function useTable(id: string | undefined): Table | undefined {
  const t = useStore((s) => (id ? s.tables[id] : undefined));
  const online = !!t?.online;
  useEffect(() => {
    if (!id || !online) return;
    return watch(id);
  }, [id, online]);
  return t;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

export async function hydrate() {
  if (started) return;
  started = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data === "object") {
        useStore.setState({
          tables: data.tables || {},
          order: Array.isArray(data.order) ? data.order : [],
          seeded: !!data.seeded,
          past: Array.isArray(data.past) ? data.past : [],
          pastSeeded: !!data.pastSeeded,
          cleaned: !!data.cleaned,
          demoMarked: !!data.demoMarked,
          myName: typeof data.myName === "string" ? cleanName(data.myName) : "",
        });
      }
    }
  } catch {
    // dati illeggibili: si riparte puliti
  }
  if (!useStore.getState().seeded) {
    const seeds = seedTables();
    const tables: Record<string, Table> = { ...useStore.getState().tables };
    seeds.forEach((t) => (tables[t.id] = t));
    useStore.setState({ tables, order: [...seeds.map((t) => t.id), ...useStore.getState().order], seeded: true });
  }
  if (!useStore.getState().pastSeeded) {
    try {
      useStore.setState({ past: [...seedHistory(), ...useStore.getState().past], pastSeeded: true });
    } catch {
      useStore.setState({ pastSeeded: true });
    }
  }
  if (!useStore.getState().cleaned) {
    // Una volta sola: via i tavoli di prova rimasti in attesa senza nessuno (es. "Tombola di sabato")
    try {
      const now = Date.now();
      const { tables, order } = useStore.getState();
      const drop = order.filter((id) => isEmptyLobby(tables[id], now));
      const keep = { ...tables };
      drop.forEach((id) => delete keep[id]);
      useStore.setState({ tables: keep, order: order.filter((id) => !drop.includes(id)), cleaned: true });
    } catch {
      useStore.setState({ cleaned: true });
    }
  }
  if (!useStore.getState().demoMarked) {
    // Una volta sola: gli esempi salvati prima del segno "demo" vengono riconosciuti e segnati
    try {
      const { tables, past } = useStore.getState();
      const next = { ...tables };
      Object.keys(next).forEach((id) => {
        if (!next[id]?.demo && looksLikeSeed(next[id])) next[id] = { ...next[id], demo: true };
      });
      useStore.setState({ tables: next, past: past.map((e) => (isDemoEvening(e) && !e.demo ? { ...e, demo: true } : e)), demoMarked: true });
    } catch {
      useStore.setState({ demoMarked: true });
    }
  }
  useStore.setState({ hydrated: true });
  const save = (s: S) =>
    AsyncStorage.setItem(
      KEY,
      JSON.stringify({ tables: s.tables, order: s.order, seeded: s.seeded, past: s.past, pastSeeded: s.pastSeeded, cleaned: s.cleaned, demoMarked: s.demoMarked, myName: s.myName })
    ).catch(() => {});
  useStore.subscribe((s) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => save(s), 250);
  });
  // primo salvataggio
  save(useStore.getState());
}
