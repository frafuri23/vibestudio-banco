import { ChipDef, GameKind } from "./types";

export type GameTemplate = {
  kind: GameKind;
  title: string;
  blurb: string;
  route: "Poker" | "Tombola" | "Bank" | "Sette" | "Ledger";
  art: "chips" | "coins" | "bills" | "sette" | "free" | "custom";
};

export const GAMES: GameTemplate[] = [
  { kind: "poker", title: "Poker", blurb: "Hold'em e Omaha: bui, side pot, timer", route: "Poker", art: "chips" },
  { kind: "tombola", title: "Tombola", blurb: "Cartelle e premi, da ambo a tombola", route: "Tombola", art: "coins" },
  { kind: "bank", title: "Gioco con banca", blurb: "Banca infinita, affitti, pagamenti al volo", route: "Bank", art: "bills" },
  { kind: "sette", title: "Sette e mezzo", blurb: "Puntate contro il banco, che gira", route: "Sette", art: "sette" },
  { kind: "free", title: "Libero", blurb: "Qualsiasi gioco: saldi e trasferimenti", route: "Ledger", art: "free" },
  { kind: "custom", title: "Il tuo set", blurb: "Colori e valori delle tue fiches vere", route: "Ledger", art: "custom" },
];

export function gameOf(kind: GameKind): GameTemplate {
  return GAMES.find((g) => g.kind === kind) || GAMES[0];
}

export const POKER_CHIPS: ChipDef[] = [
  { value: 25, color: "#2F7A4E", stripe: "#F4EEE3" },
  { value: 100, color: "#1C1A18", stripe: "#F4EEE3" },
  { value: 500, color: "#6A3FA0", stripe: "#E8CF6A" },
  { value: 1000, color: "#E0A040", stripe: "#3A2A15", text: "#3A2A15" },
];

export const SETTE_CHIPS: ChipDef[] = [
  { value: 10, color: "#2C6FB0", stripe: "#F4EEE3" },
  { value: 50, color: "#B4483A", stripe: "#F4EEE3" },
  { value: 100, color: "#1C1A18", stripe: "#E8CF6A" },
  { value: 500, color: "#6A3FA0", stripe: "#E8CF6A" },
];

export const FREE_CHIPS: ChipDef[] = [
  { value: 1, color: "#5A79B5", stripe: "#E9EEF8" },
  { value: 5, color: "#C2654E", stripe: "#F8E9E4" },
  { value: 10, color: "#4F8F6E", stripe: "#E5F3EB" },
  { value: 25, color: "#8C6BC0", stripe: "#EFE8F8" },
];

export const CHIP_PALETTE = ["#2F7A4E", "#1C1A18", "#6A3FA0", "#E0A040", "#B4483A", "#2C6FB0", "#F1ECE2", "#D46A9A", "#3BA3A0"];
export const CHIP_VALUES = [1, 2, 5, 10, 20, 25, 50, 100, 250, 500, 1000, 5000];

export const CUSTOM_CHIPS: ChipDef[] = [
  { value: 5, color: "#F1ECE2", stripe: "#B4483A", text: "#2A2111" },
  { value: 25, color: "#B4483A", stripe: "#F4EEE3" },
  { value: 100, color: "#2C6FB0", stripe: "#F4EEE3" },
  { value: 500, color: "#1C1A18", stripe: "#E8CF6A" },
];

export function stripeFor(color: string): string {
  return color === "#F1ECE2" ? "#B4483A" : color === "#E0A040" ? "#3A2A15" : "#F4EEE3";
}

export const BANK_NOTES = [10, 50, 100, 500];

export const TOMBOLA_PRIZES = [
  { key: "ambo", label: "Ambo", pct: 10 },
  { key: "terno", label: "Terno", pct: 15 },
  { key: "quaterna", label: "Quaterna", pct: 20 },
  { key: "cinquina", label: "Cinquina", pct: 25 },
  { key: "tombola", label: "Tombola", pct: 30 },
];

export const WEEKDAYS = ["domenica", "luned\u00EC", "marted\u00EC", "mercoled\u00EC", "gioved\u00EC", "venerd\u00EC", "sabato"];

export function defaultTableName(kind: GameKind, d = new Date()): string {
  const day = WEEKDAYS[d.getDay()];
  switch (kind) {
    case "poker":
      return "Poker del " + day;
    case "tombola":
      return "Tombola di " + day;
    case "bank":
      return "Serata in famiglia";
    case "sette":
      return "Sette e mezzo";
    case "custom":
      return "Le nostre fiches";
    default:
      return "Serata di " + day;
  }
}

export function makeCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}
