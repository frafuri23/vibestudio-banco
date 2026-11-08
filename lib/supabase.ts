import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";

// Solo URL + anon key: le scritture passano dalle funzioni SQL lato server (banco_create / banco_join / banco_commit),
// che controllano chi chiama, versione e saldi. Nessuna chiave segreta nell'app.
export const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh?.();
  else supabase.auth.stopAutoRefresh?.();
});

// Identità di questo telefono (o browser) sul server: un accesso anonimo di Supabase, creato la prima volta
// e conservato. Il server la usa (auth.uid()) per sapere chi è seduto a quale tavolo: niente nome, email o password.
// Chi accede con email e password (lib/account.ts) usa invece la sessione del suo account.
let pending: Promise<string> | null = null;

export function ensureUser(): Promise<string> {
  if (!pending) {
    const p = (async () => {
      const { data } = await supabase.auth.getSession();
      const existing = data?.session?.user?.id;
      if (existing) return existing;
      const { data: d, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      const id = d?.user?.id;
      if (!id) throw new Error("Accesso al server non riuscito");
      return id;
    })();
    pending = p;
    // Se non riesce si riprova alla prossima chiamata
    p.catch(() => {
      if (pending === p) pending = null;
    });
  }
  return pending;
}

// Sessione chiusa, scaduta o cambiata (accesso all'account): la prossima chiamata rilegge l'identità
try {
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT" || event === "SIGNED_IN" || event === "USER_UPDATED") pending = null;
  });
} catch {
  // ascolto non disponibile: ensureUser rilegge comunque la sessione la prima volta
}
