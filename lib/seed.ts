import { addCard, addPlayer, append, createTable, pokerAct, pokerAward, Result, startGame } from "./engine";
import { replay } from "./poker";
import { tombolaAward } from "./rules";
import { BANK, balanceOf, POT } from "./ledger";
import { POKER_CHIPS } from "./games";
import { Table } from "./types";

const ok = (t: Table, r: Result) => (r.error ? t : r.table);
const pid = (t: Table, name: string) => t.players.find((p) => p.name === name)?.id || "";

function playPoker(now: number): Table {
  let t = createTable({ kind: "poker", name: "Poker del gioved\u00EC", buyinUnits: 1000, buyinCents: 1000, chips: POKER_CHIPS, levelMinutes: 15, startLevel: 1, skin: "casino", now: now - 47 * 60000 });
  t = ok(t, addPlayer(t, "Marco", "#6E8DEB"));
  t = ok(t, addPlayer(t, "Giulia", "#E58A63"));
  t = ok(t, addPlayer(t, "Luca", "#B490EC"));
  t = ok(t, addPlayer(t, "Sara", "#6FC0A8"));
  t = ok(t, startGame(t, now - 378000));

  // Mano 1: tutti chiamano fino allo showdown, vince Marco
  for (let i = 0; i < 40; i++) {
    const v = replay(t.poker!.hand!);
    if (v.over) break;
    t = ok(t, pokerAct(t, "call"));
  }
  t = ok(t, pokerAward(t, { [pid(t, "Marco")]: balanceOf(t.entries, POT) }, now - 300000));

  // Mano 2: rilancio e tutti passano
  t = ok(t, pokerAct(t, "raise", 300));
  for (let i = 0; i < 10; i++) {
    const v = replay(t.poker!.hand!);
    if (v.over) break;
    t = ok(t, pokerAct(t, "fold"));
  }
  const w = replay(t.poker!.hand!).winnerByFold;
  if (w) t = ok(t, pokerAward(t, { [w]: balanceOf(t.entries, POT) }, now - 150000));

  // Mano 3: si chiama, al flop si punta 200 e qualcuno chiama
  for (let i = 0; i < 12; i++) {
    const v = replay(t.poker!.hand!);
    if (v.over || v.street > 0) break;
    t = ok(t, pokerAct(t, "call"));
  }
  t = ok(t, pokerAct(t, "raise", 200));
  const v2 = replay(t.poker!.hand!);
  if (v2.toAct && v2.toAct !== t.me) t = ok(t, pokerAct(t, "call"));
  return t;
}

function playTombola(now: number): Table {
  let t = createTable({ kind: "tombola", name: "Tombola di Natale", buyinUnits: 100, buyinCents: 100, chips: [], priceCents: 100, now: now - 30 * 60000 });
  t = ok(t, addPlayer(t, "Nonna Pina", "#D7C49E", { noPhone: true }));
  t = ok(t, addPlayer(t, "Sara", "#6FC0A8"));
  t = ok(t, addPlayer(t, "Marco", "#6E8DEB"));
  t = ok(t, addPlayer(t, "Giulia", "#E58A63"));
  t = ok(t, addPlayer(t, "Zio Carlo", "#9DB4CF", { noPhone: true }));
  t = ok(t, startGame(t, now - 29 * 60000));
  for (const n of ["Nonna Pina", "Nonna Pina", "Sara", "Marco", "Zio Carlo", "Zio Carlo"]) t = ok(t, addCard(t, pid(t, n)));
  t = ok(t, tombolaAward(t, [pid(t, "Nonna Pina"), pid(t, "Sara")], now - 12 * 60000));
  t = ok(t, tombolaAward(t, [pid(t, "Marco")], now - 6 * 60000));
  return t;
}

function playBank(now: number): Table {
  let t = createTable({ kind: "bank", name: "Sabato in famiglia", buyinUnits: 0, buyinCents: 0, chips: [], startBalance: 1500, lapBonus: 200, now: now - 80 * 60000 });
  t = ok(t, addPlayer(t, "Marco", "#6E8DEB"));
  t = ok(t, addPlayer(t, "Giulia", "#E58A63"));
  t = ok(t, addPlayer(t, "Sara", "#6FC0A8"));
  t = ok(t, addPlayer(t, "Luca", "#B490EC"));
  t = ok(t, startGame(t, now - 79 * 60000));
  const me = t.me;
  const moves: [string, string, number, string, number][] = [
    [me, BANK, 200, "Acquisto", 60],
    [pid(t, "Marco"), BANK, 180, "Acquisto", 52],
    [BANK, pid(t, "Sara"), 200, "Giro completo", 40],
    [pid(t, "Luca"), me, 24, "Affitto", 31],
    [me, pid(t, "Marco"), 50, "Affitto", 22],
    [pid(t, "Giulia"), BANK, 100, "Tassa", 14],
    [pid(t, "Giulia"), me, 36, "Affitto", 5],
    [me, BANK, 120, "Acquisto", 2],
  ];
  for (const [from, to, amount, note, ago] of moves) {
    t = ok(t, append(t, { from, to, amount, kind: note === "Giro completo" ? "lap" : "pay", note, now: now - ago * 60000 }));
  }
  return t;
}

export function seedTables(now = Date.now()): Table[] {
  try {
    return [playPoker(now), playTombola(now), playBank(now)].map((t) => ({ ...t, demo: true }));
  } catch {
    return [];
  }
}

// Tavoli di esempio salvati prima che avessero il segno "demo": stesso nome, stesso gioco, stessi giocatori
const SIGNATURES: { kind: Table["kind"]; name: string; players: string[] }[] = [
  { kind: "poker", name: "Poker del gioved\u00EC", players: ["Tu", "Marco", "Giulia", "Luca", "Sara"] },
  { kind: "tombola", name: "Tombola di Natale", players: ["Tu", "Nonna Pina", "Sara", "Marco", "Giulia", "Zio Carlo"] },
  { kind: "bank", name: "Sabato in famiglia", players: ["Tu", "Marco", "Giulia", "Sara", "Luca"] },
];

export function looksLikeSeed(t: Table | undefined): boolean {
  if (!t || !Array.isArray(t.players)) return false;
  const names = t.players.map((p) => p.name).sort().join("|");
  return SIGNATURES.some((s) => s.kind === t.kind && s.name === t.name && [...s.players].sort().join("|") === names);
}
