import React from "react";
import { View } from "react-native";
import { Sheet } from "./Sheet";
import { MenuPlayers, MenuRow } from "./PokerMenu";
import { Player, Table } from "../lib/types";

type Props = {
  visible: boolean;
  onClose: () => void;
  table: Table;
  balances: Record<string, number>;
  onRebuy: (pid: string) => void;
  onAddPlayer: () => void;
  onRename: (p: Player) => void;
  canRename: (pid: string) => boolean;
  onRegistro: () => void;
  onEnd: () => void;
};

export function GameMenu({ visible, onClose, table, balances, onRebuy, onAddPlayer, onRename, canRename, onRegistro, onEnd }: Props) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Tavolo" subtitle={table.name + " · codice " + table.code}>
      <MenuRow icon="person-add-outline" label="Aggiungi un giocatore" sub="QR, link d'invito o chi non ha il telefono" onPress={onAddPlayer} />
      <MenuRow icon="list-outline" label="Registro dei movimenti" sub="Ogni riga si può annullare" onPress={onRegistro} />
      <MenuPlayers table={table} balances={balances} onRebuy={onRebuy} onRename={onRename} canRename={canRename} label="Giocatori e ricariche (buy-in)" />
      <View style={{ height: 12 }} />
      <MenuRow icon="cash-outline" label="Fine serata: chi paga chi" sub="Converte le fiches in euro" onPress={onEnd} />
    </Sheet>
  );
}
