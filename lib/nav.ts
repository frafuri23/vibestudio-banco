import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { gameOf } from "./games";
import { Table } from "./types";

export type RootStackParamList = {
  Home: undefined;
  Lobby: { id: string };
  Join: { id?: string };
  Poker: { id: string };
  Showdown: { id: string };
  Settlement: { id: string };
  Tombola: { id: string };
  Bank: { id: string };
  Sette: { id: string };
  Ledger: { id: string };
  Registro: { id: string };
  Storico: undefined;
  Account: undefined;
};

export type ScreenProps<K extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, K>;

// Dove si va per un tavolo, in base al suo stato
export function tableRoute(t: Table): { name: keyof RootStackParamList; params: { id: string } } {
  if (t.status === "lobby") return { name: "Lobby", params: { id: t.id } };
  if (t.endedAt || t.status === "closed") return { name: "Settlement", params: { id: t.id } };
  return { name: gameOf(t.kind).route, params: { id: t.id } };
}
