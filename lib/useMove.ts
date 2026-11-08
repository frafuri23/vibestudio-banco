import { useCallback } from "react";
import { useStore } from "./store";
import type { Fn } from "./live";
import { addedMoves, undoMoves } from "./undo";
import { toast } from "../components/Toast";
import { tap } from "../components/Pressy";

// Esegue una mossa sul tavolo: vibrazione, messaggio di conferma e, con undo, un "Annulla" a un tocco.
export function useMove(tableId: string | undefined) {
  const apply = useStore((s) => s.apply);
  return useCallback(
    (fn: Fn, ok?: string, opts: { undo?: boolean } = {}): boolean => {
      if (!tableId) return false;
      const before = useStore.getState().tables[tableId];
      const r = apply(tableId, fn);
      if (r.error) {
        tap("error");
        toast.error(r.error);
        return false;
      }
      tap("success");
      if (!ok) return true;
      const after = useStore.getState().tables[tableId];
      const moves = opts.undo && before && after ? addedMoves(before, after) : [];
      if (!moves.length) {
        toast.ok(ok);
        return true;
      }
      toast.ok(ok, {
        label: "Annulla",
        onPress: () => {
          const u = apply(tableId, (t) => undoMoves(t, moves));
          if (u.error) {
            tap("error");
            toast.error(u.error);
          } else {
            tap();
            toast.info("Annullato: il registro ha la riga inversa");
          }
        },
      });
      return true;
    },
    [tableId, apply]
  );
}
