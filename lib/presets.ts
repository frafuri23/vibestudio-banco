import { CreateOpts, Result } from "./engine";
import { CUSTOM_CHIPS, FREE_CHIPS, POKER_CHIPS, SETTE_CHIPS, TOMBOLA_PRIZES } from "./games";
import { fmtEuro, fmtNum } from "./format";
import { levelsFrom } from "./poker";
import { PokerSkin, pokerSkins } from "./theme";
import { ChipDef, GameKind, Table } from "./types";

// Regole di un tavolo, con valori liberi (non più scelte da una lista fissa)
export type Config = {
  buyinUnits: number; // fiches (o punti) a testa
  buyinCents: number; // quanto valgono in euro, in centesimi (0 = si gioca senza soldi)
  sb: number;
  bb: number;
  levelMin: number;
  skin: PokerSkin;
  priceCents: number; // tombola: prezzo di una cartella
  prizes: number[]; // tombola: % di ambo, terno, quaterna, cinquina, tombola
  startBal: number; // gioco con banca: saldo iniziale a testa
  lap: number; // gioco con banca: giro completo
  chips: ChipDef[];
};

const BASE: Config = {
  buyinUnits: 100,
  buyinCents: 1000,
  sb: 50,
  bb: 100,
  levelMin: 15,
  skin: "casino",
  priceCents: 100,
  prizes: TOMBOLA_PRIZES.map((p) => p.pct),
  startBal: 1500,
  lap: 200,
  chips: CUSTOM_CHIPS,
};

export function defaultConfig(kind: GameKind): Config {
  if (kind === "poker" || kind === "sette") return { ...BASE, buyinUnits: 1000, buyinCents: 1000 };
  return { ...BASE };
}

const SKINS = Object.keys(pokerSkins) as PokerSkin[];
export const nextSkin = (s: PokerSkin): PokerSkin => SKINS[(Math.max(0, SKINS.indexOf(s)) + 1) % SKINS.length];

// Rimette in forma una configurazione letta dalla memoria del telefono
export function cleanConfig(kind: GameKind, raw: any): Config {
  const d = defaultConfig(kind);
  if (!raw || typeof raw !== "object") return d;
  const num = (v: any, fb: number, min: number) => (typeof v === "number" && isFinite(v) && v >= min ? Math.round(v) : fb);
  const prizes = Array.isArray(raw.prizes) && raw.prizes.length === d.prizes.length && raw.prizes.every((x: any) => typeof x === "number") ? raw.prizes : d.prizes;
  const c: Config = {
    buyinUnits: num(raw.buyinUnits, d.buyinUnits, 1),
    buyinCents: num(raw.buyinCents, d.buyinCents, 0),
    sb: num(raw.sb, d.sb, 1),
    bb: num(raw.bb, d.bb, 1),
    levelMin: num(raw.levelMin, d.levelMin, 1),
    skin: SKINS.includes(raw.skin) ? raw.skin : d.skin,
    priceCents: num(raw.priceCents, d.priceCents, 1),
    prizes: prizes.reduce((s: number, x: number) => s + x, 0) === 100 ? prizes : d.prizes,
    startBal: num(raw.startBal, d.startBal, 1),
    lap: num(raw.lap, d.lap, 1),
    chips: Array.isArray(raw.chips) && raw.chips.length >= 2 && raw.chips.every((x: any) => x && typeof x.value === "number" && typeof x.color === "string") ? raw.chips : d.chips,
  };
  if (c.bb < c.sb) c.bb = c.sb;
  return c;
}

// ---------- Campi modificabili ----------

export type FieldKind = "int" | "euro" | "pct";
export type Field = {
  id: string;
  label: string;
  kind: FieldKind;
  min: number;
  max: number;
  suffix?: string;
  presets: number[];
  hint?: string;
  get: (c: Config) => number;
  set: (c: Config, v: number) => Config;
};

export type Row = {
  id: string;
  label: string;
  value: string;
  fields: Field[];
  action?: "skin" | "chips";
  title?: string;
  compact?: boolean; // campi su una riga sola (es. le percentuali dei premi)
  check?: (c: Config) => string | null;
  preview?: (c: Config) => { text: string; bad?: boolean } | null;
};

const euro = (cents: number) => fmtEuro(cents).replace(",00", "");

export function fieldText(f: Field, v: number): string {
  if (f.kind !== "euro") return String(v);
  return v % 100 === 0 ? String(v / 100) : (v / 100).toFixed(2).replace(".", ",");
}

export function fieldLabel(f: Field, v: number): string {
  return f.kind === "euro" ? euro(v) : f.kind === "pct" ? v + "%" : fmtNum(v);
}

// Legge quello che è stato scritto: "1.000" e "1000" sono la stessa cifra; per gli euro "10,50" o "10.50"
export function parseField(f: Field, s: string): number | null {
  const raw = (s || "").replace(/[\s\u20AC%']/g, "");
  if (!raw) return null;
  if (f.kind !== "euro") {
    const clean = raw.replace(/\./g, "");
    return /^\d+$/.test(clean) ? parseInt(clean, 10) : null;
  }
  let x = raw;
  if (x.includes(",") && x.includes(".")) x = x.replace(/\./g, "").replace(",", ".");
  else if (x.includes(",")) x = x.replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(x)) x = x.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(x)) return null;
  return Math.round(parseFloat(x) * 100);
}

export function rangeText(f: Field): string {
  return "da " + fieldLabel(f, f.min) + " a " + fieldLabel(f, f.max);
}

const unitsField = (kind: GameKind): Field => ({
  id: "buyinUnits",
  label: kind === "poker" || kind === "sette" ? "Fiches a testa" : "Fiches o punti a testa",
  kind: "int",
  min: 1,
  max: 100000000,
  suffix: "fiches",
  presets: kind === "poker" || kind === "sette" ? [500, 1000, 2000, 5000] : [50, 100, 200, 500],
  get: (c) => c.buyinUnits,
  set: (c, v) => ({ ...c, buyinUnits: v }),
});

const centsField: Field = {
  id: "buyinCents",
  label: "Valgono in euro",
  kind: "euro",
  min: 0,
  max: 10000000,
  presets: [0, 500, 1000, 2000, 5000],
  hint: "0 = si gioca senza soldi: a fine serata niente conti in euro.",
  get: (c) => c.buyinCents,
  set: (c, v) => ({ ...c, buyinCents: v }),
};

const buyinRow = (kind: GameKind, c: Config): Row => ({
  id: "buyin",
  label: "Buy-in",
  title: "Buy-in",
  value: fmtNum(c.buyinUnits) + " fiches = " + (c.buyinCents > 0 ? euro(c.buyinCents) : "senza soldi"),
  fields: [unitsField(kind), centsField],
  preview: (x) => {
    if (!(x.buyinCents > 0 && x.buyinUnits > 0)) return { text: "Si gioca solo per i punti" };
    const per = x.buyinCents / x.buyinUnits;
    if (per >= 1) return { text: "1 fiche vale " + fmtEuro(per) + (Number.isInteger(per) ? "" : " circa") };
    const per100 = per * 100;
    return { text: "100 fiches valgono " + fmtEuro(per100) + (Number.isInteger(per100) ? "" : " circa") };
  },
});

const sbField: Field = { id: "sb", label: "Piccolo buio", kind: "int", min: 1, max: 10000000, presets: [10, 25, 50, 100], get: (c) => c.sb, set: (c, v) => ({ ...c, sb: v }) };
const bbField: Field = { id: "bb", label: "Grande buio", kind: "int", min: 1, max: 10000000, presets: [20, 50, 100, 200], get: (c) => c.bb, set: (c, v) => ({ ...c, bb: v }) };
const levelField: Field = { id: "levelMin", label: "Minuti per livello", kind: "int", min: 1, max: 240, suffix: "min", presets: [10, 15, 20, 30], get: (c) => c.levelMin, set: (c, v) => ({ ...c, levelMin: v }) };
const blindsCheck = (c: Config) => (c.bb < c.sb ? "Il grande buio non può essere più piccolo del piccolo buio" : null);
const blindsPreview = (c: Config) => {
  if (c.bb < c.sb) return null;
  const l = levelsFrom(c.sb, c.bb);
  return { text: "Poi: " + l.slice(1, 5).map(([s, b]) => fmtNum(s) + "/" + fmtNum(b)).join(" · ") + " …" };
};

export function blindsRow(c: Config, withMinutes = false): Row {
  return {
    id: withMinutes ? "blindsLive" : "blinds",
    label: "Bui",
    title: withMinutes ? "Bui e livelli" : "Bui di partenza",
    value: fmtNum(c.sb) + "/" + fmtNum(c.bb) + ", salgono ogni " + c.levelMin + " min",
    fields: withMinutes ? [sbField, bbField, levelField] : [sbField, bbField],
    check: blindsCheck,
    preview: blindsPreview,
  };
}

const prizeFields: Field[] = TOMBOLA_PRIZES.map((p, i) => ({
  id: "prize" + i,
  label: p.label,
  kind: "pct" as const,
  min: 0,
  max: 100,
  suffix: "%",
  presets: [],
  get: (c: Config) => c.prizes[i] ?? 0,
  set: (c: Config, v: number) => ({ ...c, prizes: c.prizes.map((x, k) => (k === i ? v : x)) }),
}));
const prizeSum = (c: Config) => c.prizes.reduce((s, x) => s + x, 0);

export function rowsFor(kind: GameKind, c: Config): Row[] {
  switch (kind) {
    case "poker":
      return [
        buyinRow(kind, c),
        blindsRow(c),
        { id: "levels", label: "Livelli", title: "Durata dei livelli", value: "ogni " + c.levelMin + " minuti", fields: [levelField] },
        {
          id: "skin",
          label: "Grafica",
          value: pokerSkins[c.skin].label + (c.skin === "casino" ? " \u00B7 tavolo verde" : c.skin === "notte" ? " \u00B7 panno blu" : " \u00B7 luci al neon"),
          fields: [],
          action: "skin",
        },
      ];
    case "tombola":
      return [
        {
          id: "price",
          label: "Cartella",
          title: "Prezzo della cartella",
          value: euro(c.priceCents) + " l'una",
          fields: [{ id: "priceCents", label: "Prezzo di una cartella", kind: "euro", min: 1, max: 100000, presets: [50, 100, 200, 500], get: (x) => x.priceCents, set: (x, v) => ({ ...x, priceCents: v }) }],
        },
        {
          id: "prizes",
          label: "Premi",
          title: "Premi in percentuale",
          value: c.prizes.join(" \u00B7 ") + " %",
          fields: prizeFields,
          compact: true,
          check: (x) => (prizeSum(x) !== 100 ? "I premi devono fare 100% in tutto (ora " + prizeSum(x) + "%)" : null),
          preview: (x) => ({ text: "Totale " + prizeSum(x) + "%" + (prizeSum(x) === 100 ? "" : " · deve fare 100%"), bad: prizeSum(x) !== 100 }),
        },
        { id: "art", label: "Grafica", value: "Monetine \u00B7 legno", fields: [] },
      ];
    case "bank":
      return [
        {
          id: "startBal",
          label: "Saldo iniziale",
          title: "Saldo iniziale",
          value: fmtNum(c.startBal) + " a testa",
          fields: [{ id: "startBal", label: "Soldi del gioco a testa", kind: "int", min: 1, max: 1000000000, presets: [1000, 1500, 2000, 5000], get: (x) => x.startBal, set: (x, v) => ({ ...x, startBal: v }) }],
        },
        {
          id: "lap",
          label: "Giro completo",
          title: "Giro completo",
          value: "+" + fmtNum(c.lap) + " dalla banca",
          fields: [{ id: "lap", label: "La banca dà a ogni giro", kind: "int", min: 1, max: 1000000000, presets: [100, 200, 500], get: (x) => x.lap, set: (x, v) => ({ ...x, lap: v }) }],
        },
        { id: "art", label: "Grafica", value: "Banconote \u00B7 carta", fields: [] },
      ];
    case "sette":
      return [buyinRow(kind, c), { id: "banker", label: "Banco", value: "passa a chi fa sette e mezzo reale", fields: [] }];
    default:
      return [
        buyinRow(kind, c),
        kind === "custom"
          ? { id: "chips", label: "Fiches", value: c.chips.map((x) => fmtNum(x.value)).join(" \u00B7 "), fields: [], action: "chips" }
          : { id: "chips", label: "Fiches", value: "1 \u00B7 5 \u00B7 10 \u00B7 25", fields: [] },
      ];
  }
}

export function optsFor(kind: GameKind, c: Config): CreateOpts {
  const base = { kind, buyinUnits: c.buyinUnits, buyinCents: c.buyinCents };
  switch (kind) {
    case "poker":
      return { ...base, chips: POKER_CHIPS, levelMinutes: c.levelMin, levels: levelsFrom(c.sb, c.bb), skin: c.skin };
    case "tombola":
      return { kind, buyinUnits: c.priceCents, buyinCents: c.priceCents, chips: [], priceCents: c.priceCents, prizePcts: c.prizes };
    case "bank":
      return { kind, buyinUnits: 0, buyinCents: 0, chips: [], startBalance: c.startBal, lapBonus: c.lap };
    case "sette":
      return { ...base, chips: SETTE_CHIPS };
    case "custom":
      return { ...base, chips: c.chips };
    default:
      return { ...base, chips: FREE_CHIPS };
  }
}

// Le regole di un tavolo già creato
export function configOf(t: Table): Config {
  const d = defaultConfig(t.kind);
  const lv = t.poker?.levels?.[0];
  const money = t.kind !== "tombola" && t.kind !== "bank";
  return {
    ...d,
    buyinUnits: money ? t.buyinUnits : d.buyinUnits,
    buyinCents: money ? t.buyinCents : d.buyinCents,
    sb: lv ? lv[0] : d.sb,
    bb: lv ? lv[1] : d.bb,
    levelMin: t.poker?.levelMinutes || d.levelMin,
    skin: t.poker?.skin || d.skin,
    priceCents: t.tombola?.priceCents || d.priceCents,
    prizes: t.tombola ? t.tombola.prizes.map((p) => p.pct) : d.prizes,
    startBal: t.bank?.startBalance || d.startBal,
    lap: t.bank?.lapBonus || d.lap,
    chips: t.kind === "custom" ? t.chips : d.chips,
  };
}

// Cambia le regole di un tavolo prima di iniziare (dopo, cambierebbero i conti già fatti)
export function applyConfig(t: Table, c: Config): Result {
  if (t.status !== "lobby") return { table: t, error: "Queste regole si cambiano prima di iniziare la partita" };
  const o = optsFor(t.kind, c);
  const next: Table = { ...t, buyinUnits: o.buyinUnits, buyinCents: o.buyinCents, chips: o.chips.length ? o.chips : t.chips };
  if (t.poker) next.poker = { ...t.poker, levelMinutes: o.levelMinutes || t.poker.levelMinutes, levels: o.levels || t.poker.levels, skin: o.skin || t.poker.skin };
  if (t.tombola) next.tombola = { ...t.tombola, priceCents: o.priceCents || t.tombola.priceCents, prizes: t.tombola.prizes.map((p, i) => ({ ...p, pct: c.prizes[i] ?? p.pct })) };
  if (t.bank) next.bank = { ...t.bank, startBalance: o.startBalance || t.bank.startBalance, lapBonus: o.lapBonus || t.bank.lapBonus };
  return { table: next };
}

// Bui e durata dei livelli si possono cambiare anche a partita iniziata: valgono dalla prossima mano
export function applyBlinds(t: Table, c: Config): Result {
  if (!t.poker) return { table: t, error: "Non è un tavolo da poker" };
  if (c.bb < c.sb) return { table: t, error: "Il grande buio non può essere più piccolo del piccolo buio" };
  return { table: { ...t, poker: { ...t.poker, levels: levelsFrom(c.sb, c.bb), levelMinutes: Math.max(1, Math.round(c.levelMin)) } } };
}
