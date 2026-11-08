import { undoEntry } from "./engine";
import type { Result } from "./engine";
import { undoneIds } from "./ledger";
import { Entry, EntryKind, Table } from "./types";

// Una mossa riconosciuta dal contenuto e non dall'id: sui tavoli online il server riapplica la mossa
// e la riga confermata può avere un id diverso da quella mostrata subito sullo schermo.
export type MoveSig = { from: string; to: string; amount: number; kind: EntryKind; note?: string };

const sigOf = (e: Entry): MoveSig => ({ from: e.from, to: e.to, amount: e.amount, kind: e.kind, note: e.note });

const same = (e: Entry, m: MoveSig) => e.from === m.from && e.to === m.to && e.amount === m.amount && e.kind === m.kind && (e.note || "") === (m.note || "");

// Le righe aggiunte da una mossa (per l'"Annulla" nel messaggio di conferma)
export function addedMoves(before: Table, after: Table): MoveSig[] {
  const seen = new Set((before.entries || []).map((e) => e.id));
  return (after.entries || []).filter((e) => !seen.has(e.id) && e.kind !== "undo").map(sigOf);
}

// Annulla quelle righe, dall'ultima alla prima: ognuna diventa una riga inversa nel registro
export function undoMoves(t: Table, moves: MoveSig[]): Result {
  let table = t;
  for (const m of [...moves].reverse()) {
    const undone = undoneIds(table.entries);
    const e = [...table.entries].reverse().find((x) => x.kind !== "undo" && !undone.has(x.id) && same(x, m));
    if (!e) return { table: t, error: "Questo movimento è già stato annullato" };
    const r = undoEntry(table, e.id);
    if (r.error) return { table: t, error: r.error };
    table = r.table;
  }
  return { table };
}
