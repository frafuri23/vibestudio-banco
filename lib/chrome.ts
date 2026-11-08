import { useCallback, useSyncExternalStore } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { colors } from "./theme";

// Colore della fascia sotto la barra di stato (gestita una volta sola in App.tsx)
// e colore del testo della barra di stato: ogni schermata dichiara il suo quando prende il focus.
export type Chrome = { color: string; darkText: boolean };

let state: Chrome = { color: colors.bg, darkText: false };
const subs = new Set<() => void>();

export function setChrome(next: Chrome) {
  if (next.color === state.color && next.darkText === state.darkText) return;
  state = next;
  subs.forEach((f) => f());
}

function subscribe(f: () => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

const read = () => state;

export function useChromeState(): Chrome {
  return useSyncExternalStore(subscribe, read, read);
}

export function useChrome(color: string, darkText = false) {
  useFocusEffect(
    useCallback(() => {
      setChrome({ color, darkText });
    }, [color, darkText])
  );
}
