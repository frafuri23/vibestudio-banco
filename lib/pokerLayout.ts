import { fmtNum } from "./format";

// Posizioni degli elementi del tavolo da poker. Ogni cosa (foto, scritte, puntate, piatto, "D")
// è un rettangolo: puntate, piatto e dischetto del dealer vanno nel primo posto libero, così
// non coprono mai nome, fiches o ultima mossa di nessuno, con qualsiasi numero di giocatori.

export type Rect = { x: number; y: number; w: number; h: number };

// Misure delle righe sotto la foto (usate anche da PokerTable, così il calcolo combacia)
export const SEAT_TEXT = { nameMt: 3, nameLh: 16, stackLh: 18, lastMt: 2, lastH: 19 };
export const BET_H = 28;
// Puntata compatta (fiche sopra, cifra sotto) per lo spazio stretto accanto alle scritte
export const VBET_H = 45;
export const DEALER_SIZE = 26;

export type BetSpot = Rect & { v?: boolean };

// Proporzioni del tavolo: con più di 6 giocatori si allunga. Sotto il tavolo restano TABLE_PAD px
// per le scritte di chi siede in basso, quindi l'ingombro totale è round(W * ratio) + TABLE_PAD.
export const TABLE_PAD = 24;
export const tableRatio = (n: number) => (n > 6 ? 1.3 : 1.12);
export const tableHeight = (W: number, n: number) => Math.round(W * tableRatio(n)) + TABLE_PAD;

// La larghezza più grande che entra sia in maxW sia in maxH. Sotto minW non si scende (le scritte
// non ci starebbero): in quel caso PokerScreen rimpicciolisce il tavolo intero (scala) per farlo entrare.
export const minTableWidth = (maxW: number, n: number) => Math.min(maxW, n > 6 ? 290 : 270);

export function fitTableWidth(maxW: number, maxH: number, n: number): number {
  const minW = minTableWidth(maxW, n);
  const byH = Math.floor((maxH - TABLE_PAD) / tableRatio(n));
  return Math.max(minW, Math.min(maxW, byH));
}

export type SeatIn = { id: string; name: string; stack: string | null; last?: string; bet: number; isMe: boolean };

export type TableLayout = {
  H: number;
  seatSize: number;
  ring: number;
  blockW: number;
  amountFs: number;
  amountLh: number;
  seats: Record<string, { x: number; y: number }>;
  bets: Record<string, BetSpot>;
  potTop: number;
  dealer: Rect | null;
};

// Larghezza stimata di un testo (font di sistema, grassetto)
function textW(s: string, px: number): number {
  let w = 0;
  for (const ch of s) {
    if (".,:;' ".includes(ch)) w += px * 0.3;
    else if ("mwMW".includes(ch)) w += px * 0.85;
    else if (/[0-9A-Z]/.test(ch)) w += px * 0.64;
    else w += px * 0.56;
  }
  return w;
}

const overlap = (a: Rect, b: Rect) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};
const grow = (r: Rect, p: number): Rect => ({ x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p });
const at = (x: number, y: number, w: number, h: number): Rect => ({ x: x - w / 2, y: y - h / 2, w, h });

type Ob = { r: Rect; k: number };

// Il primo candidato che non tocca niente; se non c'è, quello che copre meno (nomi e fiches pesano di più)
function pick<R extends Rect>(cands: R[], obs: Ob[], bounds: Rect): R {
  let best = cands[0];
  let bestCost = Infinity;
  for (const c of cands) {
    let cost = (c.w * c.h - overlap(c, bounds)) * 1000;
    for (const o of obs) cost += overlap(c, o.r) * o.k;
    if (cost <= 0) return c;
    if (cost < bestCost) {
      best = c;
      bestCost = cost;
    }
  }
  return best;
}

export function layoutTable(W: number, seatsIn: SeatIn[], dealerId: string | undefined, potText: string, toCallText?: string): TableLayout {
  const n = Math.max(1, seatsIn.length);
  const crowded = n > 6;
  // Con tanti giocatori il tavolo si allunga, così le scritte di uno non finiscono sulla foto del vicino
  const H = Math.round(W * tableRatio(n));
  const cx = W / 2;
  const cy = H / 2;
  const rx = W * 0.4;
  const ry = H * 0.4;
  const seatSize = crowded ? (W < 360 ? 38 : 42) : W < 360 ? 44 : 50;
  const ring = seatSize + 8;
  const blockW = crowded ? 80 : 90;
  const bounds: Rect = { x: 2, y: 2, w: W - 4, h: H + 20 };
  const ang = (i: number) => Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pos = (i: number, f = 1) => ({ x: cx + Math.cos(ang(i)) * rx * f, y: cy + Math.sin(ang(i)) * ry * f });
  const T = SEAT_TEXT;

  const info = seatsIn.map((s, i) => {
    const p = pos(i);
    const a: Rect = { x: p.x - ring / 2, y: p.y - ring / 2, w: ring, h: ring };
    const lastW = s.last ? textW(s.last, 11.5) + 18 : 0;
    const tw = Math.min(blockW, Math.max(textW(s.name, 13), s.stack ? textW(s.stack, 15) : 0, lastW)) + 4;
    const th = T.nameMt + T.nameLh + (s.stack ? T.stackLh : 0) + (s.last ? T.lastMt + T.lastH : 0);
    const t: Rect = { x: p.x - tw / 2, y: a.y + a.h, w: tw, h: th };
    const c = Math.cos(ang(i));
    const sn = Math.sin(ang(i));
    // verso il centro: a destra per chi siede a sinistra (e per chi è in alto o in basso al centro)
    const side = p.x <= cx + 0.5 ? 1 : -1;
    const kind: "side" | "top" | "bottom" = Math.abs(c) >= 0.6 ? "side" : sn < 0 ? "top" : "bottom";
    return { s, i, p, a, t, sn, side, kind };
  });
  type Seat = (typeof info)[number];

  const seatObs: Ob[] = info.flatMap((x) => [
    { r: grow(x.a, 3), k: 1000 },
    { r: grow(x.t, 3), k: 1000 },
  ]);
  // Le puntate restano ben staccate da ogni foto (non solo non sovrapposte)
  const photoObs: Ob[] = info.map((x) => ({ r: grow(x.a, 8), k: 1000 }));

  // ---- Piatto ----
  const amountFs = W < 360 ? 44 : 54;
  const amountLh = W < 360 ? 50 : 60;
  const potH = 32 + 16 + amountLh + 18;
  const baseTop = cy - potH / 2;
  const potRects = (top: number): Rect[] => {
    const aw = textW(potText, amountFs) - 2 * potText.length + 8;
    const r: Rect[] = [at(cx, top + 13, 62, 26), at(cx, top + 40, 76, 16), at(cx, top + 48 + amountLh / 2, aw, amountLh * 0.8)];
    if (toCallText) r.push(at(cx, top + 48 + amountLh + 9, textW(toCallText, 14) + 6, 18));
    return r;
  };

  // ---- Puntate ----
  const GAP = 5;
  const betSize = (bet: number) => ({ w: Math.round(8 + 22 + 5 + textW(fmtNum(bet), 15) + 10), h: BET_H });
  const vbetW = (bet: number) => Math.round(Math.max(22, textW(fmtNum(bet), 14)) + 12);
  const betCands = (x: Seat, bet: number): BetSpot[] => {
    const { w, h } = betSize(bet);
    const vw = vbetW(bet);
    const vh = VBET_H;
    const { p, a, t, side, sn, kind } = x;
    const toward = (cx - p.x) * 0.22;
    // Allineata alla riga delle fiches del giocatore (o al nome se non c'è), sotto il bordo della foto
    const textMid = x.s.stack ? t.y + T.nameMt + T.nameLh + T.stackLh / 2 : t.y + T.nameMt + T.nameLh / 2;
    // Oltre il bordo più esterno fra scritte e foto, verso il centro: così non finisce sotto l'angolo della foto
    const inner = side > 0 ? Math.max(t.x + t.w, a.x + a.w) : Math.min(t.x, a.x);
    const nextTo = (bw: number) => (side > 0 ? inner + GAP + 3 + bw / 2 : inner - GAP - 3 - bw / 2);
    const besideText = at(nextTo(w), textMid, w, h);
    // Versione compatta accanto alle scritte: allineata al centro, in alto o in basso del blocco di testo
    const besideTextV = [Math.max(textMid, t.y + vh / 2), t.y + vh / 2, t.y + t.h - vh / 2].map((y): BetSpot => ({ ...at(nextTo(vw), y, vw, vh), v: true }));
    const besideAvatar = at(side > 0 ? a.x + a.w + GAP + 3 + w / 2 : a.x - GAP - 3 - w / 2, p.y, w, h);
    const below = at(p.x + toward, t.y + t.h + GAP + 3 + h / 2, w, h);
    const above = at(p.x + toward, a.y - GAP - 3 - h / 2, w, h);
    const rays = [0.62, 0.52, 0.42, 0.32].map((f) => {
      const q = pos(x.i, f);
      return at(q.x, q.y, w, h);
    });
    // In alto: sotto nome, fiches e ultima mossa. Ai lati: accanto alle scritte, verso il centro. In basso: sopra la foto.
    const first: BetSpot[] =
      kind === "top"
        ? [below, besideText, ...besideTextV, besideAvatar]
        : kind === "side"
          ? sn < -0.3
            ? [besideText, ...besideTextV, besideAvatar, below, above]
            : [besideText, ...besideTextV, besideAvatar, above, below]
          : [above, besideAvatar, besideText, ...besideTextV];
    return [...first, ...rays];
  };

  const betters = info.filter((x) => x.s.bet > 0 && !x.s.isMe);
  const tops = betters.filter((x) => x.kind === "top");
  const others = betters.filter((x) => x.kind !== "top");

  // 1) dove cadono le puntate di chi sta in alto, per sapere quanto spostare il piatto
  const pre: Rect[] = [];
  for (const x of tops) {
    pre.push(pick(betCands(x, x.s.bet), [...seatObs, ...photoObs, ...pre.map((r) => ({ r: grow(r, 2), k: 500 }))], bounds));
  }

  // 2) il piatto scende (o sale) del minimo necessario, restando sul panno
  const feltTop = H * 0.1 + 18;
  const feltBottom = H * 0.9 - 18;
  const potCost = (top: number) => {
    let cost = 0;
    for (const r of potRects(top)) {
      for (const o of seatObs) cost += overlap(r, o.r);
      for (const b of pre) cost += overlap(r, grow(b, 4));
    }
    return cost;
  };
  let potTop = baseTop;
  let bestPot = potCost(baseTop);
  for (let k = 1; k <= 18 && bestPot > 0; k++) {
    for (const sgn of [1, -1]) {
      const top = baseTop + sgn * k * 5;
      if (top < feltTop || top + potH > feltBottom) continue;
      const c = potCost(top);
      if (c < bestPot) {
        bestPot = c;
        potTop = top;
        if (c === 0) break;
      }
    }
  }

  // 3) tutte le puntate, con il piatto ormai fermo
  const potObs: Ob[] = potRects(potTop).map((r) => ({ r: grow(r, 3), k: 60 }));
  const bets: Record<string, BetSpot> = {};
  const placed: Ob[] = [];
  for (const x of [...tops, ...others]) {
    const r = pick(betCands(x, x.s.bet), [...seatObs, ...photoObs, ...potObs, ...placed], bounds);
    bets[x.s.id] = r;
    placed.push({ r: grow(r, 2), k: 500 });
  }

  // ---- Dischetto del dealer ----
  let dealer: Rect | null = null;
  const dx = info.find((x) => x.s.id === dealerId);
  if (dx) {
    const D = DEALER_SIZE;
    const g = 4;
    const { p, a, t, side, i } = dx;
    const cands: Rect[] = [
      at(side > 0 ? a.x + a.w + g + D / 2 : a.x - g - D / 2, p.y - 4, D, D),
      at(side > 0 ? a.x - g - D / 2 : a.x + a.w + g + D / 2, p.y - 4, D, D),
      at(side > 0 ? t.x + t.w + g + D / 2 : t.x - g - D / 2, t.y + 10, D, D),
      at(side > 0 ? a.x + a.w + g + D / 2 - 6 : a.x - g - D / 2 + 6, a.y + 4, D, D),
      ...[0.3, -0.3, 0.5, -0.5].map((o) => {
        const q = pos(i + o, 0.75);
        return at(q.x, q.y, D, D);
      }),
      ...[0.55, 0.45].map((f) => {
        const q = pos(i, f);
        return at(q.x, q.y, D, D);
      }),
    ];
    dealer = pick(cands, [...seatObs, ...placed.map((o) => ({ r: o.r, k: 1000 })), ...potObs.map((o) => ({ r: o.r, k: 200 }))], bounds);
  }

  const seats: Record<string, { x: number; y: number }> = {};
  info.forEach((x) => (seats[x.s.id] = x.p));
  return { H, seatSize, ring, blockW, amountFs, amountLh, seats, bets, potTop, dealer };
}
