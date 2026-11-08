import { Platform } from "react-native";
import { Table } from "./types";
import { gameOf } from "./games";
import { pokerSkins } from "./theme";
import { blindClock } from "./poker";
import { fmtEuro } from "./format";

// Indirizzo pubblico dell'app sul web ("Condividi come sito"). Il QR e il link d'invito puntano sempre qui,
// così chi inquadra entra dal browser anche quando l'host usa l'app installata o l'anteprima.
// Si può cambiare con la variabile EXPO_PUBLIC_SITE_URL (es. un dominio tuo).
const PUBLISHED_SITE = "https://appspawn-gateway-production.up.railway.app/sites/d3b599b4-f2b3-5f1c-a31b-a8db5a3ee1b5";

export function siteUrl(): string {
  const env = String(process.env.EXPO_PUBLIC_SITE_URL || "").trim();
  return (/^https:\/\//i.test(env) ? env : PUBLISHED_SITE).replace(/\/+$/, "");
}

export function joinLink(code: string): string {
  return siteUrl() + "?t=" + encodeURIComponent(code);
}

// Codice d'invito dall'indirizzo della pagina (?t=CODICE). Se il sito mostra l'app dentro una cornice,
// il codice può stare nell'indirizzo della pagina che la contiene: si guarda anche lì.
export function inviteCodeFromUrl(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const w: any = window;
  const framed = (() => {
    try {
      return w.parent && w.parent !== w;
    } catch {
      return true;
    }
  })();
  const places: (() => string)[] = [
    () => w.location.search,
    () => w.location.hash,
    () => (framed ? w.parent.location.search : ""),
    () => (framed && w.top !== w.parent ? w.top.location.search : ""),
    () => (framed && w.document?.referrer ? String(w.document.referrer) : ""),
  ];
  for (const read of places) {
    try {
      const m = String(read() || "").match(/[?&#]t=([A-Za-z0-9]{4})(?![A-Za-z0-9])/);
      if (m) return m[1].toUpperCase();
    } catch {
      // pagina di un altro sito: non si legge
    }
  }
  return null;
}

export function tableSummary(t: Table): string {
  const g = gameOf(t.kind);
  if (t.kind === "poker" && t.poker) {
    const c = blindClock(t.poker);
    return "Texas Hold'em · " + pokerSkins[t.poker.skin].label + " · bui " + c.sb + "/" + c.bb;
  }
  if (t.kind === "tombola" && t.tombola) return "Tombola · cartella " + fmtEuro(t.tombola.priceCents) + " · Monetine";
  if (t.kind === "bank") return "Gioco con banca · Banconote";
  return g.title + " · " + g.blurb.split(":")[0];
}
