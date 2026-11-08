import { HandStart, PokerAction, PokerState } from "./types";

export const STREETS = ["preflop", "flop", "turn", "river", "showdown"];

export type HandView = {
  street: number; // 0..3, 4 = showdown
  committed: Record<string, number>;
  total: Record<string, number>;
  stack: Record<string, number>;
  folded: Set<string>;
  allIn: Set<string>;
  currentBet: number;
  minRaiseTo: number;
  toAct: string | null;
  over: boolean;
  winnerByFold: string | null;
  pot: number;
  last: Record<string, string>;
  feed: string[];
};

type Hand = HandStart & { actions: PokerAction[] };

export function blindPositions(seats: string[], dealer: string): { sb: string; bb: string } {
  const n = seats.length;
  const d = Math.max(0, seats.indexOf(dealer));
  if (n === 2) return { sb: seats[d], bb: seats[(d + 1) % n] };
  return { sb: seats[(d + 1) % n], bb: seats[(d + 2) % n] };
}

export function replay(h: Hand, names: Record<string, string> = {}): HandView {
  const seats = h.seats;
  const n = seats.length;
  const committed: Record<string, number> = {};
  const total: Record<string, number> = {};
  const stack: Record<string, number> = {};
  seats.forEach((p) => {
    committed[p] = 0;
    total[p] = 0;
    stack[p] = h.startStacks[p] || 0;
  });
  const folded = new Set<string>();
  const allIn = new Set<string>();
  const last: Record<string, string> = {};
  let feed: string[] = [];
  let street = 0;
  let currentBet = 0;
  let lastRaise = h.bb;
  let acted = new Set<string>();
  let toAct: string | null = seats.length ? blindPositions(seats, h.dealer).sb : null;
  let over = false;
  let winnerByFold: string | null = null;
  const dIdx = Math.max(0, seats.indexOf(h.dealer));
  const canAct = (p: string) => !folded.has(p) && !allIn.has(p);
  const nextFrom = (idx: number) => {
    for (let k = 1; k <= n; k++) {
      const p = seats[(idx + k) % n];
      if (canAct(p)) return p;
    }
    return null;
  };
  const nm = (p: string) => names[p] || "?";

  const roundComplete = () => {
    const actors = seats.filter(canAct);
    if (actors.length === 0) return true;
    if (actors.length === 1) return committed[actors[0]] >= currentBet;
    return actors.every((p) => acted.has(p) && committed[p] === currentBet);
  };

  const advance = () => {
    street++;
    seats.forEach((p) => (committed[p] = 0));
    currentBet = 0;
    lastRaise = h.bb;
    acted = new Set();
    feed = [];
    const actors = seats.filter(canAct);
    if (street >= 4 || actors.length <= 1) {
      street = 4;
      toAct = null;
      over = true;
      return;
    }
    toAct = nextFrom(dIdx);
  };

  for (const a of h.actions) {
    if (over) break;
    const p = a.pid;
    const wasBet = currentBet;
    const put = Math.max(0, Math.min(a.amount, stack[p] || 0));
    stack[p] -= put;
    committed[p] += put;
    total[p] += put;
    if (a.type === "fold") folded.add(p);
    else if (stack[p] === 0) allIn.add(p);
    if (a.type !== "post") acted.add(p);
    if (committed[p] > currentBet) {
      const by = committed[p] - currentBet;
      if (a.type !== "post") {
        if (by >= lastRaise) lastRaise = by;
        acted = new Set([p]);
      }
      currentBet = committed[p];
    }
    let label = "";
    if (a.type === "post") label = p === blindPositions(seats, h.dealer).bb ? "BB" : "SB";
    else if (a.type === "fold") label = "Fold";
    else if (a.type === "check") label = "Check";
    else if (a.type === "call") label = allIn.has(p) ? "All-in" : "Chiama";
    else if (allIn.has(p)) label = "All-in";
    else label = wasBet === 0 ? "Punta " + committed[p] : "Rilancia a " + committed[p];
    last[p] = label;
    if (a.type !== "post") {
      const verb =
        a.type === "fold" ? "passa" : a.type === "check" ? "fa check" : a.type === "call" ? "chiama" : allIn.has(p) ? "va all-in" : wasBet === 0 ? "punta " + committed[p] : "rilancia a " + committed[p];
      feed.push(nm(p) + " " + verb);
    }

    const live = seats.filter((x) => !folded.has(x));
    if (live.length === 1) {
      over = true;
      winnerByFold = live[0];
      toAct = null;
      break;
    }
    if (roundComplete()) advance();
    else toAct = nextFrom(seats.indexOf(p));
  }

  const pot = seats.reduce((s, p) => s + total[p], 0);
  const minRaiseTo = currentBet === 0 ? h.bb : currentBet + lastRaise;
  return { street, committed, total, stack, folded, allIn, currentBet, minRaiseTo, toAct, over, winnerByFold, pot, last, feed: feed.slice(-2) };
}

export type Pot = { amount: number; eligible: string[] };

export function computePots(seats: string[], total: Record<string, number>, folded: Set<string>): Pot[] {
  const levels = Array.from(new Set(seats.filter((p) => !folded.has(p)).map((p) => total[p] || 0)))
    .filter((x) => x > 0)
    .sort((a, b) => a - b);
  const pots: Pot[] = [];
  let prev = 0;
  for (const L of levels) {
    let amount = 0;
    for (const p of seats) amount += Math.max(0, Math.min(total[p] || 0, L) - prev);
    const eligible = seats.filter((p) => !folded.has(p) && (total[p] || 0) >= L);
    if (amount > 0) {
      const lastPot = pots[pots.length - 1];
      if (lastPot && lastPot.eligible.length === eligible.length && lastPot.eligible.every((x) => eligible.includes(x))) lastPot.amount += amount;
      else pots.push({ amount, eligible });
    }
    prev = L;
  }
  const sum = seats.reduce((s, p) => s + (total[p] || 0), 0);
  const covered = pots.reduce((s, x) => s + x.amount, 0);
  if (sum > covered && pots.length) pots[pots.length - 1].amount += sum - covered;
  return pots;
}

// Divide un piatto: parti uguali arrotondate alla fiche più piccola,
// la fiche che avanza va al primo vincitore a sinistra del dealer.
export function splitPot(amount: number, winners: string[], seats: string[], dealer: string, unit: number): Record<string, number> {
  const res: Record<string, number> = {};
  if (!winners.length || amount <= 0) return res;
  const d = Math.max(0, seats.indexOf(dealer));
  const order = [...winners].sort((a, b) => ((seats.indexOf(a) - d - 1 + seats.length * 2) % seats.length) - ((seats.indexOf(b) - d - 1 + seats.length * 2) % seats.length));
  const u = Math.max(1, unit);
  const share = Math.floor(amount / order.length / u) * u;
  order.forEach((w) => (res[w] = share));
  let rem = amount - share * order.length;
  let i = 0;
  while (rem > 0) {
    const give = Math.min(u, rem);
    res[order[i % order.length]] += give;
    rem -= give;
    i++;
  }
  return res;
}

export function firstLeftOfDealer(winners: string[], seats: string[], dealer: string): string | null {
  const d = Math.max(0, seats.indexOf(dealer));
  for (let k = 1; k <= seats.length; k++) {
    const p = seats[(d + k) % seats.length];
    if (winners.includes(p)) return p;
  }
  return null;
}

export function blindClock(ps: PokerState, now = Date.now()) {
  const len = Math.max(1, ps.levelMinutes) * 60000;
  if (!ps.startedAt) return { level: 0, remaining: len, sb: ps.levels[0][0], bb: ps.levels[0][1], paused: true };
  const pausedNow = ps.pausedAt ? now - ps.pausedAt : 0;
  const elapsed = Math.max(0, now - ps.startedAt - ps.pausedTotal - pausedNow);
  const level = Math.min(Math.floor(elapsed / len), ps.levels.length - 1);
  const isLast = level === ps.levels.length - 1;
  const remaining = isLast && elapsed >= len * (ps.levels.length - 1) + len ? 0 : len - (elapsed % len);
  return { level, remaining, sb: ps.levels[level][0], bb: ps.levels[level][1], paused: !!ps.pausedAt };
}

export const DEFAULT_LEVELS: [number, number][] = [
  [25, 50],
  [50, 100],
  [75, 150],
  [100, 200],
  [150, 300],
  [200, 400],
  [300, 600],
  [500, 1000],
  [1000, 2000],
];

// Livelli a partire da bui scelti liberamente: se sono già nella scala classica si parte da lì,
// altrimenti la scala classica viene riportata in proporzione ai bui di partenza.
export function levelsFrom(sb: number, bb: number): [number, number][] {
  const s = Math.max(1, Math.round(sb));
  const b = Math.max(s, Math.round(bb));
  const k = DEFAULT_LEVELS.findIndex(([x, y]) => x === s && y === b);
  if (k >= 0) return DEFAULT_LEVELS.slice(k);
  const [s0, b0] = DEFAULT_LEVELS[0];
  return DEFAULT_LEVELS.map(([x, y]) => [Math.max(1, Math.round((x * s) / s0)), Math.max(1, Math.round((y * b) / b0))] as [number, number]);
}
