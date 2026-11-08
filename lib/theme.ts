import { Platform, TextStyle } from "react-native";

// Palette di base: scura, da sala da gioco, con un solo accento oro.
export const colors = {
  bg: "#13110E",
  surface: "#1D1A16",
  elevated: "#27231E",
  border: "#2F2A24",
  hairline: "rgba(255,255,255,0.07)",
  text: "#F4EEE3",
  muted: "#A49B8C",
  faint: "#6E665A",
  accent: "#DDB765",
  accentInk: "#2A2111",
  accentSoft: "rgba(221,183,101,0.14)",
  success: "#7FD1B2",
  successSoft: "rgba(127,209,178,0.14)",
  warn: "#E8B44C",
  danger: "#E58A6E",
  dangerSoft: "rgba(229,138,110,0.14)",
  felt: "#1F4A3A",
  feltDeep: "#163629",
  wood: "#3A2A20",
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 10, md: 14, lg: 20, xl: 26, pill: 999 };

const condensed: TextStyle = {
  fontWeight: "800",
  textTransform: "uppercase",
  letterSpacing: Platform.OS === "web" ? -0.4 : -0.6,
};

export const type = {
  display: { ...condensed, fontSize: 32, lineHeight: 34 } as TextStyle,
  title: { ...condensed, fontSize: 24, lineHeight: 27 } as TextStyle,
  section: { ...condensed, fontSize: 17, lineHeight: 20, letterSpacing: 0 } as TextStyle,
  heading: { fontSize: 17, lineHeight: 22, fontWeight: "700" } as TextStyle,
  body: { fontSize: 15, lineHeight: 21, fontWeight: "400" } as TextStyle,
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: "600" } as TextStyle,
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "500" } as TextStyle,
  label: { fontSize: 12, lineHeight: 16, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase" } as TextStyle,
  number: { fontWeight: "800", letterSpacing: -1, fontVariant: ["tabular-nums"] } as TextStyle,
};

export const shadow = {
  soft: {
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  glow: {
    shadowColor: "#DDB765",
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
};

// Colori dei giocatori (avatar + scelta del colore all'ingresso)
export const playerColors = ["#6FC0A8", "#6E8DEB", "#E58A63", "#B490EC", "#DB8FB0", "#B1D27B", "#7FC0E4", "#D7C49E", "#E07A5F"];

// Temi del tavolo da poker (i "Tweaks")
export type PokerSkin = "casino" | "notte" | "neon";
export const pokerSkins: Record<PokerSkin, { label: string; felt: string; feltDeep: string; rim: string; line: string; glow: string; bgTop: string }> = {
  casino: { label: "Casinò", felt: "#25594A", feltDeep: "#1A4236", rim: "#3B2A1F", line: "rgba(255,255,255,0.08)", glow: "rgba(0,0,0,0)", bgTop: "#1A2A23" },
  notte: { label: "Blu notte", felt: "#1F3F66", feltDeep: "#152B48", rim: "#1C2230", line: "rgba(180,210,255,0.12)", glow: "rgba(0,0,0,0)", bgTop: "#141C2A" },
  neon: { label: "Neon", felt: "#17121F", feltDeep: "#0E0B14", rim: "#E0559B", line: "rgba(98,230,255,0.45)", glow: "#E0559B", bgTop: "#1A1022" },
};

export const MAX_W = 560;
