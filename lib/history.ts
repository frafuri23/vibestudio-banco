import { standings } from "./ledger";
import { GameKind, Table } from "./types";

// Storico: ogni serata finita diventa un riassunto. I gruppi sono le persone che giocano spesso insieme.

export type EveningPlayer = { name: string; color: string; cents: number; net: number; me?: boolean };
export type Evening = { id: string; name: string; kind: GameKind; date: number; players: EveningPlayer[]; tableId?: string; demo?: boolean };

// Serata di esempio (anche quelle salvate prima del segno "demo": il loro id inizia con h_poker_ / h_tombola_)
export function isDemoEvening(e: Evening | undefined): boolean {
  return !!e && (!!e.demo || /^h_(poker|tombola)_\d+$/.test(String(e.id)));
}
export type GroupTotal = { name: string; color: string; cents: number; wins: number; me?: boolean };
export type Group = { key: string; name: string; kind: GameKind; evenings: Evening[]; totals: GroupTotal[]; last: number };

export function eveningOf(t: Table): Evening | null {
  if (t.status !== "closed" && !t.endedAt) return null;
  const rows = standings(t);
  const players: EveningPlayer[] = rows.map((r) => {
    const p = t.players.find((x) => x.id === r.pid);
    return { name: p?.name || "?", color: p?.color || "#888", cents: r.cents, net: r.net, me: r.pid === t.me };
  });
  return { id: t.id, tableId: t.id, name: t.name, kind: t.kind, date: t.endedAt || t.createdAt, players };
}

const keyName = (p: { name: string; me?: boolean }) => (p.me ? "\u2022me" : p.name.trim().toLowerCase());

// Nome del gruppo: il nome di serata più ricorrente, senza la data in coda
function groupName(evs: Evening[]): string {
  const count: Record<string, number> = {};
  evs.forEach((e) => {
    const n = e.name.replace(/\s+\d{1,2}[/.]\d{1,2}([/.]\d{2,4})?$/, "").trim();
    count[n] = (count[n] || 0) + 1;
  });
  return Object.keys(count).sort((a, b) => count[b] - count[a])[0] || "Gruppo";
}

export function groupsOf(evenings: Evening[]): Group[] {
  const by: Record<string, Evening[]> = {};
  for (const e of evenings) {
    if (e.players.length < 2) continue;
    const key = e.players.map(keyName).sort().join("|");
    (by[key] = by[key] || []).push(e);
  }
  return Object.keys(by)
    .map((key) => {
      const evs = by[key].sort((a, b) => b.date - a.date);
      const totals: Record<string, GroupTotal> = {};
      for (const e of evs) {
        const top = e.players.reduce((a, p) => (p.net > a.net ? p : a), e.players[0]);
        for (const p of e.players) {
          const k = keyName(p);
          // Le serate sono dalla più recente: resta il nome usato l'ultima volta
          const cur = totals[k] || { name: p.name, color: p.color, cents: 0, wins: 0, me: p.me };
          cur.cents += p.cents;
          if (top && keyName(top) === k && top.net > 0) cur.wins += 1;
          totals[k] = cur;
        }
      }
      return {
        key,
        name: groupName(evs),
        kind: evs[0].kind,
        evenings: evs,
        totals: Object.values(totals).sort((a, b) => b.cents - a.cents || b.wins - a.wins),
        last: evs[0].date,
      };
    })
    .sort((a, b) => b.last - a.last);
}

// Serate passate di esempio, così lo storico non è vuoto al primo avvio
export function seedHistory(now = Date.now()): Evening[] {
  const day = 86400000;
  const poker = (ago: number, c: [number, number, number, number, number]): Evening => ({
    id: "h_poker_" + ago,
    demo: true,
    name: "Poker del gioved\u00EC",
    kind: "poker",
    date: now - ago * day,
    players: [
      { name: "Tu", color: "#DDB765", cents: c[0], net: c[0] * 10, me: true },
      { name: "Marco", color: "#6E8DEB", cents: c[1], net: c[1] * 10 },
      { name: "Giulia", color: "#E58A63", cents: c[2], net: c[2] * 10 },
      { name: "Luca", color: "#B490EC", cents: c[3], net: c[3] * 10 },
      { name: "Sara", color: "#6FC0A8", cents: c[4], net: c[4] * 10 },
    ],
  });
  const tombola = (ago: number, c: [number, number, number, number, number]): Evening => ({
    id: "h_tombola_" + ago,
    demo: true,
    name: "Tombola in famiglia",
    kind: "tombola",
    date: now - ago * day,
    players: [
      { name: "Tu", color: "#DDB765", cents: c[0], net: c[0], me: true },
      { name: "Nonna Pina", color: "#D7C49E", cents: c[1], net: c[1] },
      { name: "Zio Carlo", color: "#9DB4CF", cents: c[2], net: c[2] },
      { name: "Sara", color: "#6FC0A8", cents: c[3], net: c[3] },
      { name: "Marco", color: "#6E8DEB", cents: c[4], net: c[4] },
    ],
  });
  return [
    poker(7, [1250, -800, 450, -1000, 100]),
    poker(14, [-500, 1600, -300, -200, -600]),
    poker(21, [300, 200, -1100, 900, -300]),
    poker(28, [-1000, 600, 800, -100, -300]),
    tombola(10, [-150, 420, -90, -60, -120]),
    tombola(38, [80, -100, 260, -120, -120]),
  ];
}
