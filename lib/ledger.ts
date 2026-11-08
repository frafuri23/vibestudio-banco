import { Entry, Payment, Table } from "./types";

export const BANK = "bank";
export const POT = "pot";

export function uid(prefix = "e"): string {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function balances(entries: Entry[]): Record<string, number> {
  const b: Record<string, number> = {};
  for (const e of entries) {
    b[e.from] = (b[e.from] || 0) - e.amount;
    b[e.to] = (b[e.to] || 0) + e.amount;
  }
  return b;
}

export function balanceOf(entries: Entry[], acc: string): number {
  let v = 0;
  for (const e of entries) {
    if (e.to === acc) v += e.amount;
    if (e.from === acc) v -= e.amount;
  }
  return v;
}

export function undoneIds(entries: Entry[]): Set<string> {
  const s = new Set<string>();
  for (const e of entries) if (e.undoOf) s.add(e.undoOf);
  return s;
}

// Totale "comprato" da ogni giocatore (buy-in netti, contando gli annullamenti)
export function boughtIn(entries: Entry[]): Record<string, number> {
  const undone = undoneIds(entries);
  const r: Record<string, number> = {};
  for (const e of entries) {
    if (e.kind === "buyin" && e.from === BANK && !undone.has(e.id)) r[e.to] = (r[e.to] || 0) + e.amount;
  }
  return r;
}

export function buyinCount(t: Table, pid: string): number {
  const undone = undoneIds(t.entries);
  return t.entries.filter((e) => e.kind === "buyin" && e.from === BANK && e.to === pid && !undone.has(e.id)).length;
}

// Validazione "lato server": nessun saldo di un giocatore va sotto zero.
export function validateEntry(entries: Entry[], e: Pick<Entry, "from" | "to" | "amount">): string | null {
  if (!Number.isFinite(e.amount) || e.amount <= 0) return "Importo non valido";
  if (e.from === e.to) return "Mittente e destinatario coincidono";
  if (e.from !== BANK) {
    const have = balanceOf(entries, e.from);
    if (have < e.amount) return e.from === POT ? "Il piatto non ha abbastanza fiches" : "Saldo insufficiente";
  }
  return null;
}

export function unitsToCents(t: Table, units: number): number {
  if (!t.buyinUnits || !t.buyinCents) return 0;
  return Math.round((units * t.buyinCents) / t.buyinUnits);
}

export type Standing = { pid: string; balance: number; bought: number; net: number; cents: number; buyins: number };

export function standings(t: Table): Standing[] {
  const bal = balances(t.entries);
  const bought = boughtIn(t.entries);
  const rows = t.players.map((p) => {
    const balance = bal[p.id] || 0;
    const b = bought[p.id] || 0;
    const net = balance - b;
    return { pid: p.id, balance, bought: b, net, cents: unitsToCents(t, net), buyins: buyinCount(t, p.id) };
  });
  // L'arrotondamento non deve creare o perdere centesimi
  const drift = rows.reduce((s, r) => s + r.cents, 0);
  if (drift !== 0 && rows.length) {
    const target = drift > 0 ? rows.reduce((a, r) => (r.cents > a.cents ? r : a)) : rows.reduce((a, r) => (r.cents < a.cents ? r : a));
    target.cents -= drift;
  }
  return rows.sort((a, b) => b.cents - a.cents || b.net - a.net);
}

// Il minor numero di pagamenti: chi perde di più paga chi vince di più.
export function settle(rows: { pid: string; cents: number }[]): Payment[] {
  const debt = rows.filter((r) => r.cents < 0).map((r) => ({ pid: r.pid, left: -r.cents })).sort((a, b) => b.left - a.left);
  const cred = rows.filter((r) => r.cents > 0).map((r) => ({ pid: r.pid, left: r.cents })).sort((a, b) => b.left - a.left);
  const out: Payment[] = [];
  let i = 0;
  let j = 0;
  while (i < debt.length && j < cred.length) {
    const pay = Math.min(debt[i].left, cred[j].left);
    if (pay > 0) out.push({ from: debt[i].pid, to: cred[j].pid, cents: pay, status: "pending" });
    debt[i].left -= pay;
    cred[j].left -= pay;
    if (debt[i].left === 0) i++;
    if (cred[j].left === 0) j++;
  }
  return out;
}

export function naivePaymentCount(rows: { cents: number }[]): number {
  const d = rows.filter((r) => r.cents < 0).length;
  const c = rows.filter((r) => r.cents > 0).length;
  return d * c;
}
