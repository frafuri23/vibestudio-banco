import { BANK, POT, balanceOf, balances, uid, undoneIds, validateEntry } from "./ledger";
import { blindClock, blindPositions, DEFAULT_LEVELS, replay } from "./poker";
import { defaultTableName, makeCode, POKER_CHIPS, TOMBOLA_PRIZES } from "./games";
import { ChipDef, Entry, EntryKind, GameKind, Player, PokerActionType, Table } from "./types";

export type Result = { table: Table; error?: string; info?: string };
const fail = (table: Table, error: string): Result => ({ table, error });

export type CreateOpts = {
  kind: GameKind;
  name?: string;
  buyinUnits: number;
  buyinCents: number;
  chips: ChipDef[];
  levelMinutes?: number;
  startLevel?: number;
  levels?: [number, number][];
  skin?: "casino" | "notte" | "neon";
  priceCents?: number;
  prizePcts?: number[];
  startBalance?: number;
  lapBonus?: number;
  hostName?: string; // il nome di chi crea il tavolo (dal profilo di questo telefono)
  now?: number;
};

export const HOST_COLOR = "#DDB765";
// Nome che l'host aveva prima del profilo: si sostituisce col nome vero appena lo si sceglie
export const LEGACY_HOST = "Tu";
export const NAME_MAX = 20;

export function cleanName(name: string): string {
  return String(name || "").trim().replace(/\s+/g, " ").slice(0, NAME_MAX);
}

export function createTable(o: CreateOpts): Table {
  const now = o.now || Date.now();
  const host: Player = { id: uid("p"), name: cleanName(o.hostName || "") || LEGACY_HOST, color: HOST_COLOR, isHost: true, status: "ready" };
  const t: Table = {
    id: uid("t"),
    code: makeCode(),
    name: o.name || defaultTableName(o.kind, new Date(now)),
    kind: o.kind,
    createdAt: now,
    status: "lobby",
    players: [host],
    entries: [],
    buyinUnits: o.buyinUnits,
    buyinCents: o.buyinCents,
    chips: o.chips.length ? o.chips : POKER_CHIPS,
    me: host.id,
  };
  if (o.kind === "poker") {
    t.poker = {
      levelMinutes: o.levelMinutes || 15,
      levels: o.levels && o.levels.length ? o.levels : DEFAULT_LEVELS.slice(o.startLevel || 0),
      startedAt: null,
      pausedAt: null,
      pausedTotal: 0,
      skin: o.skin || "casino",
      hand: null,
      handsPlayed: 0,
    };
  }
  if (o.kind === "tombola") {
    t.tombola = {
      priceCents: o.priceCents || 100,
      cards: {},
      carryCents: 0,
      started: false,
      prizes: TOMBOLA_PRIZES.map((p, i) => ({ ...p, pct: o.prizePcts?.[i] ?? p.pct, winners: [], paidCents: [], done: false, entryIds: [], carryIn: 0 })),
    };
  }
  if (o.kind === "bank") t.bank = { startBalance: o.startBalance || 1500, lapBonus: o.lapBonus || 200, me: host.id };
  if (o.kind === "sette") t.sette = { banker: host.id, round: 1 };
  return t;
}

export function addPlayer(t: Table, name: string, color: string, opts: { id?: string; noPhone?: boolean; status?: Player["status"]; now?: number } = {}): Result {
  const clean = cleanName(name);
  if (!clean) return fail(t, "Scrivi un nome");
  // Già seduto (la stessa mossa riapplicata dal server): niente da fare
  if (opts.id && t.players.some((x) => x.id === opts.id)) return { table: t, info: opts.id };
  const same = t.players.find((p) => p.name.toLowerCase() === clean.toLowerCase());
  if (same) {
    // Posto tenuto dall'host per qualcuno del gruppo: chi arriva col suo nome se lo prende
    if (same.status === "joining" && !same.isHost && !opts.noPhone) {
      const players = t.players.map((p) => (p.id === same.id ? { ...p, color, noPhone: false, status: "ready" as const } : p));
      return { table: { ...t, players }, info: same.id };
    }
    return fail(t, "C'\u00E8 gi\u00E0 qualcuno con questo nome");
  }
  if (t.players.length >= 10) return fail(t, "Il tavolo \u00E8 pieno (10 giocatori)");
  const p: Player = { id: opts.id || uid("p"), name: clean, color, noPhone: opts.noPhone, status: opts.status || "ready" };
  let table: Table = { ...t, players: [...t.players, p] };
  if (t.status === "playing" && t.kind !== "tombola") {
    const r = buyIn(table, p.id, opts.now);
    if (r.error) return r;
    table = r.table;
  }
  return { table, info: p.id };
}

// Cambia il nome di un giocatore. I movimenti usano l'id, quindi registro, saldi e conti restano uguali.
export function renamePlayer(t: Table, pid: string, name: string): Result {
  const clean = cleanName(name);
  if (!clean) return fail(t, "Scrivi un nome");
  const p = t.players.find((x) => x.id === pid);
  if (!p) return fail(t, "Giocatore non trovato");
  if (p.name === clean) return { table: t };
  if (t.players.some((x) => x.id !== pid && x.name.trim().toLowerCase() === clean.toLowerCase())) return fail(t, "C'\u00E8 gi\u00E0 qualcuno con questo nome");
  return { table: { ...t, players: t.players.map((x) => (x.id === pid ? { ...x, name: clean } : x)) } };
}

// Chi può cambiare il nome di chi: su un tavolo di un solo telefono chi lo tiene; in tempo reale l'host
// cambia tutti i nomi, gli altri solo il proprio (lo stesso controllo lo fa il server).
export function canRename(t: Table, pid: string): boolean {
  if (!t.online) return true;
  const me = t.players.find((p) => p.id === t.me);
  if (!me) return false;
  return !!me.isHost || pid === me.id;
}

export function setPlayerStatus(t: Table, pid: string, status: Player["status"]): Table {
  return { ...t, players: t.players.map((p) => (p.id === pid ? { ...p, status } : p)) };
}

export function removePlayer(t: Table, pid: string): Result {
  if (t.status !== "lobby") return fail(t, "Si pu\u00F2 togliere qualcuno solo prima di iniziare");
  const p = t.players.find((x) => x.id === pid);
  if (!p || p.isHost) return fail(t, "Non si pu\u00F2 togliere l'host");
  return { table: { ...t, players: t.players.filter((x) => x.id !== pid) } };
}

export function append(t: Table, e: { from: string; to: string; amount: number; kind: EntryKind; note?: string; undoOf?: string; now?: number }): Result {
  const err = validateEntry(t.entries, e);
  if (err) return fail(t, err);
  const entry: Entry = { id: uid("e"), ts: e.now || Date.now(), from: e.from, to: e.to, amount: Math.round(e.amount), kind: e.kind, note: e.note, undoOf: e.undoOf };
  return { table: { ...t, entries: [...t.entries, entry] }, info: entry.id };
}

export function undoEntry(t: Table, entryId: string): Result {
  const e = t.entries.find((x) => x.id === entryId);
  if (!e) return fail(t, "Movimento non trovato");
  if (e.kind === "undo") return fail(t, "Questo \u00E8 gi\u00E0 un annullamento");
  if (undoneIds(t.entries).has(entryId)) return fail(t, "Gi\u00E0 annullato");
  return append(t, { from: e.to, to: e.from, amount: e.amount, kind: "undo", undoOf: e.id, note: "Annulla: " + (e.note || e.kind) });
}

export function buyIn(t: Table, pid: string, now?: number): Result {
  if (t.kind === "tombola") return fail(t, "Nella tombola si comprano cartelle");
  const amount = t.kind === "bank" ? t.bank?.startBalance || 1500 : t.buyinUnits;
  return append(t, { from: BANK, to: pid, amount, kind: "buyin", note: t.kind === "bank" ? "Saldo iniziale" : "Buy-in", now });
}

export function transfer(t: Table, from: string, to: string, amount: number, note?: string, kind: EntryKind = "pay"): Result {
  return append(t, { from, to, amount, kind, note });
}

export function startGame(t: Table, now = Date.now()): Result {
  if (t.players.length < 2) return fail(t, "Servono almeno 2 giocatori");
  let table: Table = { ...t, status: "playing", players: t.players.map((p) => ({ ...p, status: "ready" as const })) };
  if (t.kind === "tombola") {
    table = { ...table, tombola: { ...table.tombola!, started: true } };
    for (const p of table.players) {
      for (let i = 0; i < 2; i++) {
        const r = addCard(table, p.id, now);
        if (r.error) return r;
        table = r.table;
      }
    }
    return { table };
  }
  for (const p of table.players) {
    const r = buyIn(table, p.id, now);
    if (r.error) return r;
    table = r.table;
  }
  if (t.kind === "poker" && table.poker) {
    table = { ...table, poker: { ...table.poker, startedAt: now } };
    return startHand(table, now);
  }
  return { table };
}

export function addCard(t: Table, pid: string, now?: number): Result {
  const tb = t.tombola;
  if (!tb) return fail(t, "Non \u00E8 una tombola");
  if (tb.prizes.some((p) => p.done)) return fail(t, "Le cartelle si comprano prima del primo premio");
  let r = append(t, { from: BANK, to: pid, amount: tb.priceCents, kind: "buyin", note: "Cartella", now });
  if (r.error) return r;
  r = append(r.table, { from: pid, to: POT, amount: tb.priceCents, kind: "bet", note: "Cartella", now });
  if (r.error) return r;
  const cards = { ...tb.cards, [pid]: (tb.cards[pid] || 0) + 1 };
  return { table: { ...r.table, tombola: { ...tb, cards } } };
}

export function removeCard(t: Table, pid: string): Result {
  const tb = t.tombola;
  if (!tb || !(tb.cards[pid] > 0)) return fail(t, "Nessuna cartella da togliere");
  if (tb.prizes.some((p) => p.done)) return fail(t, "Troppo tardi: un premio \u00E8 gi\u00E0 stato assegnato");
  const undone = undoneIds(t.entries);
  const bet = [...t.entries].reverse().find((e) => e.kind === "bet" && e.from === pid && e.note === "Cartella" && !undone.has(e.id));
  const buy = [...t.entries].reverse().find((e) => e.kind === "buyin" && e.to === pid && e.note === "Cartella" && !undone.has(e.id));
  if (!bet || !buy) return fail(t, "Nessuna cartella da togliere");
  let r = undoEntry(t, bet.id);
  if (r.error) return r;
  r = undoEntry(r.table, buy.id);
  if (r.error) return r;
  return { table: { ...r.table, tombola: { ...tb, cards: { ...tb.cards, [pid]: tb.cards[pid] - 1 } } } };
}

// ---------- Poker ----------

export function names(t: Table): Record<string, string> {
  const r: Record<string, string> = {};
  t.players.forEach((p) => (r[p.id] = p.name));
  return r;
}

export function startHand(t: Table, now = Date.now()): Result {
  const ps = t.poker;
  if (!ps) return fail(t, "Non \u00E8 un tavolo da poker");
  const bal = balances(t.entries);
  if ((bal[POT] || 0) > 0) return fail(t, "Il piatto non \u00E8 ancora stato assegnato");
  const ids = t.players.map((p) => p.id);
  const seats = ids.filter((id) => (bal[id] || 0) > 0);
  if (seats.length < 2) return { table: { ...t, poker: { ...ps, hand: null } }, error: "Servono almeno 2 giocatori con fiches" };
  const prev = ps.hand?.dealer;
  let dealer = seats[0];
  if (prev) {
    const start = ids.indexOf(prev);
    for (let k = 1; k <= ids.length; k++) {
      const c = ids[(start + k) % ids.length];
      if (seats.includes(c)) {
        dealer = c;
        break;
      }
    }
  }
  const clock = blindClock(ps, now);
  const startStacks: Record<string, number> = {};
  seats.forEach((s) => (startStacks[s] = bal[s] || 0));
  const hand = { number: ps.handsPlayed + 1, dealer, seats, startStacks, sb: clock.sb, bb: clock.bb, actions: [] as any[] };
  let table: Table = { ...t, poker: { ...ps, hand } };
  const pos = blindPositions(seats, dealer);
  for (const [pid, blind, label] of [
    [pos.sb, clock.sb, "SB"],
    [pos.bb, clock.bb, "BB"],
  ] as [string, number, string][]) {
    const amount = Math.min(blind, startStacks[pid]);
    const r = append(table, { from: pid, to: POT, amount, kind: "bet", note: label + " \u00B7 mano " + hand.number, now });
    if (r.error) return r;
    const h = r.table.poker!.hand!;
    table = { ...r.table, poker: { ...r.table.poker!, hand: { ...h, actions: [...h.actions, { pid, type: "post", amount, entryId: r.info }] } } };
  }
  return { table };
}

export function pokerAct(t: Table, type: PokerActionType, amount = 0): Result {
  const ps = t.poker;
  const h = ps?.hand;
  if (!ps || !h) return fail(t, "Nessuna mano in corso");
  const v = replay(h);
  if (v.over || !v.toAct) return fail(t, "La mano \u00E8 finita");
  const p = v.toAct;
  const stack = v.stack[p];
  const toCall = v.currentBet - v.committed[p];
  let put = 0;
  let kind: PokerActionType = type;
  if (type === "check") {
    if (toCall > 0) return fail(t, "Non puoi fare check: devi chiamare " + toCall);
  } else if (type === "call") {
    put = Math.min(toCall, stack);
    if (put <= 0) kind = "check";
  } else if (type === "raise") {
    if (amount <= 0) return fail(t, "Componi la puntata toccando le fiches");
    if (amount >= stack) {
      kind = "allin";
      put = stack;
    } else {
      if (v.committed[p] + amount < v.minRaiseTo) return fail(t, (v.currentBet === 0 ? "La puntata minima \u00E8 " : "Il rilancio minimo \u00E8 a ") + v.minRaiseTo);
      put = amount;
    }
  } else if (type === "allin") {
    put = stack;
  }
  let table = t;
  let entryId: string | undefined;
  if (put > 0) {
    const label = kind === "allin" ? "All-in" : kind === "call" ? "Chiama" : "Puntata";
    const r = append(t, { from: p, to: POT, amount: put, kind: "bet", note: label + " \u00B7 mano " + h.number });
    if (r.error) return r;
    table = r.table;
    entryId = r.info;
  }
  const nh = { ...h, actions: [...h.actions, { pid: p, type: kind, amount: put, entryId }] };
  return { table: { ...table, poker: { ...ps, hand: nh } } };
}

export function pokerUndo(t: Table): Result {
  const ps = t.poker;
  const h = ps?.hand;
  if (!ps || !h) return fail(t, "Nessuna mano in corso");
  const idx = h.actions.length - 1;
  const a = h.actions[idx];
  if (!a || a.type === "post") return fail(t, "Niente da annullare in questa mano");
  let table = t;
  if (a.entryId) {
    const r = undoEntry(t, a.entryId);
    if (r.error) return r;
    table = r.table;
  }
  return { table: { ...table, poker: { ...ps, hand: { ...h, actions: h.actions.slice(0, idx) } } } };
}

export function pokerAward(t: Table, awards: Record<string, number>, now = Date.now()): Result {
  const ps = t.poker;
  const h = ps?.hand;
  if (!ps || !h) return fail(t, "Nessuna mano in corso");
  const potBal = balanceOf(t.entries, POT);
  const ids = Object.keys(awards);
  const sum = ids.reduce((s: number, k) => s + (awards[k] || 0), 0);
  if (sum !== potBal) return fail(t, "La divisione non torna: " + sum + " su " + potBal);
  let table = t;
  for (const pid of ids) {
    const amt = awards[pid] || 0;
    if (amt <= 0) continue;
    const r = append(table, { from: POT, to: pid, amount: amt, kind: "win", note: "Vince mano " + h.number, now });
    if (r.error) return r;
    table = r.table;
  }
  table = { ...table, poker: { ...table.poker!, handsPlayed: ps.handsPlayed + 1 } };
  const next = startHand(table, now);
  return next.error ? { table: next.table, info: "fine" } : next;
}

export function togglePause(t: Table, now = Date.now()): Table {
  const ps = t.poker;
  if (!ps || !ps.startedAt) return t;
  if (ps.pausedAt) return { ...t, poker: { ...ps, pausedTotal: ps.pausedTotal + (now - ps.pausedAt), pausedAt: null } };
  return { ...t, poker: { ...ps, pausedAt: now } };
}
