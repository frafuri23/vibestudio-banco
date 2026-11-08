import { Platform } from "react-native";

// Condivisione e appunti per il browser (sito pubblicato e anteprima).
// Sull'app installata si usa sempre la condivisione di sistema (Share di react-native).

type WebShareResult = "shared" | "cancel" | "unavailable";

// Condivisione del browser, se c'è (telefono, alcuni computer). "cancel" = chiusa da chi la usa.
export async function webShare(text: string, title?: string): Promise<WebShareResult> {
  if (Platform.OS !== "web") return "unavailable";
  const nav: any = typeof navigator !== "undefined" ? navigator : null;
  if (!nav || typeof nav.share !== "function") return "unavailable";
  try {
    await nav.share({ title, text });
    return "shared";
  } catch (e: any) {
    return e?.name === "AbortError" ? "cancel" : "unavailable";
  }
}

// Copia negli appunti del browser. true se è riuscito.
export async function copyText(text: string): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  const g: any = typeof globalThis !== "undefined" ? globalThis : {};
  try {
    if (g.navigator?.clipboard?.writeText) {
      await g.navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // appunti non permessi (es. dentro un riquadro): si prova il metodo classico
  }
  try {
    const d = g.document;
    if (!d || !d.body || typeof d.createElement !== "function") return false;
    const ta = d.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    d.body.appendChild(ta);
    ta.select();
    const ok = typeof d.execCommand === "function" ? d.execCommand("copy") : false;
    d.body.removeChild(ta);
    return !!ok;
  } catch {
    return false;
  }
}
