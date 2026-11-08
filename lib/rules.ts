import { BANK, POT, balanceOf, naivePaymentCount, settle, standings } from "./ledger";
import { append, Result, undoEntry } from "./engine";
import { Payment, Table } from "./types";

const fail = (table: Table, error: string): Result => ({ table, error });

// ---------- Tombola ----------

export function tombolaTotal(t: Table): number {
  const tb = t.tombola;
  if (!tb) return 0;
  const cards = (Object.values(tb.cards) as number[]).reduce((s: number, c: number) => s + c, 0);
  return cards * tb.priceCents;
}

// Importo base di ogni premio: percentuale del montepremi; l'ultimo prende il resto
export function prizeBase(t: Table, idx: number): number {
  const tb = t.tombola!;
  const total = tombolaTotal(t);
  if (idx === tb.prizes.length - 1) {
    const others = tb.prizes.slice(0, -1).reduce((s, p) => s + Math.floor((total * p.pct) / 100), 0);
    return total - others;
  }
  return Math.floor((total * tb.prizes[idx].pct) / 100);
}

export function currentPrizeIndex(t: Table): number {
  const tb = t.tombola;
  if (!tb) return -1;
  return tb.prizes.findIndex((p) => !p.done);
}

export function tombolaAward(t: Table, winners: string[], now = Date.now()): Result {
  const tb = t.tombola;
  if (!tb) return fail(t, "Non \u00E8 una tombola");
  const idx = currentPrizeIndex(t);
  if (idx < 0) return fail(t, "Tutti i premi sono stati assegnati");
  if (!winners.length) return fail(t, "Scegli almeno un vincitore");
  const isLast = idx === tb.prizes.length - 1;
  const prize = prizeBase(t, idx) + tb.carryCents;
  const share = Math.floor(prize / winners.length);
  let carry = prize - share * winners.length;
  const paid = winners.map(() => share);
  if (isLast && carry > 0) {
    paid[0] += carry;
    carry = 0;
  }
  let table = t;
  const ids: string[] = [];
  for (let i = 0; i < winners.length; i++) {
    if (paid[i] <= 0) continue;
    const r = append(table, { from: POT, to: winners[i], amount: paid[i], kind: "prize", note: tb.prizes[idx].label, now });
    if (r.error) return r;
    table = r.table;
    ids.push(r.info!);
  }
  const prizes = tb.prizes.map((p, i) => (i === idx ? { ...p, winners, paidCents: paid, done: true, entryIds: ids, carryIn: tb.carryCents } : p));
  return { table: { ...table, tombola: { ...tb, prizes, carryCents: carry } } };
}

export function tombolaUndo(t: Table): Result {
  const tb = t.tombola;
  if (!tb) return fail(t, "Non \u00E8 una tombola");
  let idx = -1;
  tb.prizes.forEach((p, i) => p.done && (idx = i));
  if (idx < 0) return fail(t, "Nessun premio da annullare");
  const p = tb.prizes[idx];
  let table = t;
  for (const id of p.entryIds) {
    const r = undoEntry(table, id);
    if (r.error) return r;
    table = r.table;
  }
  const prizes = tb.prizes.map((x, i) => (i === idx ? { ...x, winners: [], paidCents: [], done: false, entryIds: [], carryIn: 0 } : x));
  return { table: { ...table, tombola: { ...tb, prizes, carryCents: p.carryIn } } };
}

export function prizeWonBy(t: Table, pid: string): number {
  const tb = t.tombola;
  if (!tb) return 0;
  return tb.prizes.reduce((s, p) => s + p.winners.reduce((a, w, i) => a + (w === pid ? p.paidCents[i] || 0 : 0), 0), 0);
}

// ---------- Gioco con banca ----------

export function bankLap(t: Table, pid: string): Result {
  const bonus = t.bank?.lapBonus || 200;
  return append(t, { from: BANK, to: pid, amount: bonus, kind: "lap", note: "Giro completo" });
}

// ---------- Sette e mezzo ----------

export type SetteResult = { pid: string; bet: number; outcome: "win" | "lose" | "real" };

export function setteRound(t: Table, results: SetteResult[]): Result {
  const st = t.sette;
  if (!st) return fail(t, "Non \u00E8 un tavolo di sette e mezzo");
  const banker = st.banker;
  const valid = results.filter((r) => r.pid !== banker && r.bet > 0);
  if (!valid.length) return fail(t, "Nessuna puntata da chiudere");
  let table = t;
  const note = "Mano " + st.round;
  // Prima incassa il banco, poi paga
  for (const r of valid.filter((x) => x.outcome === "lose")) {
    const res = append(table, { from: r.pid, to: banker, amount: r.bet, kind: "bet", note });
    if (res.error) return fail(t, nameErr(t, r.pid) + res.error.toLowerCase());
    table = res.table;
  }
  for (const r of valid.filter((x) => x.outcome !== "lose")) {
    const amount = r.outcome === "real" ? r.bet * 2 : r.bet;
    const res = append(table, { from: banker, to: r.pid, amount, kind: "win", note });
    if (res.error) return fail(t, "Il banco non ha abbastanza fiches per pagare tutti");
    table = res.table;
  }
  const real = valid.find((x) => x.outcome === "real");
  const nextBanker = real ? real.pid : banker;
  return { table: { ...table, sette: { banker: nextBanker, round: st.round + 1 } }, info: real ? "Sette e mezzo reale: il banco passa" : undefined };
}

export function passBanker(t: Table): Table {
  const st = t.sette;
  if (!st) return t;
  const ids = t.players.map((p) => p.id);
  const i = ids.indexOf(st.banker);
  return { ...t, sette: { ...st, banker: ids[(i + 1) % ids.length] } };
}

function nameErr(t: Table, pid: string): string {
  const p = t.players.find((x) => x.id === pid);
  return (p ? p.name : "Giocatore") + ": ";
}

// ---------- Fine serata ----------

export function endNight(t: Table, now = Date.now()): Result {
  // Già chiusa (es. da un altro telefono un attimo prima): l'elenco dei pagamenti resta quello, il server non ne accetta un altro
  if (t.endedAt) return { table: t };
  if (balanceOf(t.entries, POT) > 0)
    return fail(t, t.kind === "tombola" ? "Ci sono ancora premi da assegnare" : "C'\u00E8 ancora un piatto aperto: assegnalo prima di chiudere");
  const rows = standings(t);
  const payments = t.buyinCents > 0 ? settle(rows) : [];
  return { table: { ...t, endedAt: now, payments } };
}

export function settlementInfo(t: Table) {
  const rows = standings(t);
  return { rows, naive: naivePaymentCount(rows) };
}

// Il giocatore ha un telefono suo a questo tavolo? Sui tavoli online lo dice il server.
export function hasOwnPhone(t: Table, pid: string): boolean {
  if (!t.online) return pid === t.me; // tavolo su un solo telefono
  if (Array.isArray(t.phones)) return t.phones.includes(pid);
  const p = t.players.find((x) => x.id === pid);
  return !!p && !p.noPhone && p.status !== "joining";
}

export type PaymentRights = { confirm: boolean; undo: boolean; forOther: boolean };

// Chi può toccare un pagamento da questo telefono:
// - "ricevuto" lo segna chi riceve i soldi; se non ha il telefono lo segna l'host al suo posto
// - tornare a "non pagato" lo possono fare chi riceve e l'host (conferma data per sbaglio)
// Su un tavolo che sta su un solo telefono lo gestisce chi lo tiene. Il server applica le stesse regole.
export function paymentRights(t: Table, p: Payment): PaymentRights {
  if (!t.online) return { confirm: true, undo: true, forOther: false };
  const mine = p.to === t.me;
  const host = !!t.players.find((x) => x.id === t.me)?.isHost;
  const forOther = !mine && host && !hasOwnPhone(t, p.to);
  return { confirm: mine || forOther, undo: mine || host, forOther };
}

// Imposta lo stato (non lo inverte): riapplicata dal server dopo una mossa di altri dà lo stesso risultato
export function setPaymentStatus(t: Table, idx: number, received: boolean): Result {
  const p = (t.payments || [])[idx];
  if (!p) return fail(t, "Pagamento non trovato");
  if ((p.status === "received") === received) return { table: t };
  const r = paymentRights(t, p);
  if (received && !r.confirm) return fail(t, "Solo chi riceve i soldi può segnarli come ricevuti");
  if (!received && !r.undo) return fail(t, "Solo chi ha ricevuto i soldi o l'host può annullare la conferma");
  const payments = (t.payments || []).map((x, i) => (i === idx ? { ...x, status: received ? ("received" as const) : ("pending" as const) } : x));
  return { table: { ...t, payments } };
}

export function reopen(t: Table): Table {
  return { ...t, endedAt: undefined, payments: undefined, status: "playing" };
}
