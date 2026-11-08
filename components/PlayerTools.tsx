import React, { useState } from "react";
import { InviteSheet } from "./InvitePanel";
import { AddPlayerSheet } from "./AddPlayerSheet";
import { NameSheet } from "./NameSheet";
import { toast } from "./Toast";
import { useStore } from "../lib/store";
import { canRename, cleanName, renamePlayer } from "../lib/engine";
import { Player, Table } from "../lib/types";

type Opts = {
  // Aggiunge chi non ha il telefono (ogni gioco ha il suo modo: buy-in, una cartella, …). Errore o null.
  onAddNoPhone: (name: string, color: string) => string | null;
  addNote?: string;
  light?: boolean;
};

// Fogli comuni alle schermate di gioco: invito (QR + link), aggiunta senza telefono e cambio del nome.
// Va chiamato prima di qualsiasi return della schermata; finché il tavolo non c'è non mostra nulla.
export function usePlayerTools(table: Table | undefined, opts: Opts) {
  const apply = useStore((s) => s.apply);
  const [invite, setInvite] = useState(false);
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<Player | null>(null);

  const rename = (p: Player, name: string): string | null => {
    if (!table) return "Tavolo non trovato";
    const clean = cleanName(name);
    if (clean === p.name) return null;
    if (!canRename(table, p.id)) return "Il nome di " + p.name + " lo cambia lui stesso o l'host";
    const r = apply(table.id, (t) => renamePlayer(t, p.id, clean));
    if (r.error) return r.error;
    if (p.id === table.me) {
      // Il nome scelto per te diventa anche quello del profilo, se non ne avevi uno o era lo stesso
      const st = useStore.getState();
      if (!st.myName || st.myName === p.name) st.setMyName(clean);
      toast.ok("Ora al tavolo ti chiami " + clean);
    } else toast.ok(p.name + " ora si chiama " + clean);
    return null;
  };

  const sheets = table ? (
    <>
      <InviteSheet
        visible={invite}
        onClose={() => setInvite(false)}
        table={table}
        light={opts.light}
        onNoPhone={() => {
          setInvite(false);
          setAdding(true);
        }}
      />
      <AddPlayerSheet
        visible={adding}
        onClose={() => setAdding(false)}
        table={table}
        light={opts.light}
        note={opts.addNote}
        onAdd={opts.onAddNoPhone}
      />
      <NameSheet
        visible={!!renaming}
        onClose={() => setRenaming(null)}
        light={opts.light}
        title={renaming && renaming.id === table.me ? "Il tuo nome" : "Nome di " + (renaming?.name || "")}
        subtitle="Lo vedono tutti al tavolo. Saldi e movimenti restano uguali."
        initial={renaming?.name || ""}
        saveLabel="Salva il nome"
        onSave={(name) => (renaming ? rename(renaming, name) : null)}
      />
    </>
  ) : null;

  return {
    openInvite: () => setInvite(true),
    openAdd: () => setAdding(true),
    openRename: (p: Player) => setRenaming(p),
    canRename: (pid: string) => !!table && canRename(table, pid),
    sheets,
  };
}
