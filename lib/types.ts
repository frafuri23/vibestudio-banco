export type GameKind = "poker" | "tombola" | "bank" | "sette" | "free" | "custom";

export type Player = {
  id: string;
  name: string;
  color: string;
  isHost?: boolean;
  noPhone?: boolean; // gestito dall'host (es. la nonna alla tombola)
  status: "ready" | "joining";
};

// Conti speciali: "bank" = il banco (infinito), "pot" = il piatto
export type Account = string;

export type EntryKind = "buyin" | "bet" | "win" | "pay" | "prize" | "lap" | "undo";

// Una riga del registro. Il registro si allunga e basta: annullare = aggiungere la riga inversa.
export type Entry = {
  id: string;
  ts: number;
  from: Account;
  to: Account;
  amount: number;
  kind: EntryKind;
  note?: string;
  undoOf?: string;
};

export type ChipDef = { value: number; color: string; stripe: string; text?: string };

export type PokerActionType = "post" | "fold" | "check" | "call" | "raise" | "allin";
export type PokerAction = { pid: string; type: PokerActionType; amount: number; entryId?: string };

export type HandStart = {
  number: number;
  dealer: string; // id del dealer
  seats: string[]; // giocatori in mano, in ordine di posto
  startStacks: Record<string, number>;
  sb: number;
  bb: number;
};

export type PokerState = {
  levelMinutes: number;
  levels: [number, number][];
  startedAt: number | null;
  pausedAt: number | null;
  pausedTotal: number;
  skin: "casino" | "notte" | "neon";
  hand: (HandStart & { actions: PokerAction[] }) | null;
  handsPlayed: number;
};

export type TombolaPrize = { key: string; label: string; pct: number; winners: string[]; paidCents: number[]; done: boolean; entryIds: string[]; carryIn: number };
export type TombolaState = { priceCents: number; cards: Record<string, number>; prizes: TombolaPrize[]; carryCents: number; started: boolean };

export type BankState = { startBalance: number; lapBonus: number; me: string };

export type SetteState = { banker: string; round: number };

export type Payment = { from: string; to: string; cents: number; status: "pending" | "received" };

export type Table = {
  id: string;
  code: string;
  name: string;
  kind: GameKind;
  createdAt: number;
  status: "lobby" | "playing" | "closed";
  players: Player[];
  entries: Entry[];
  buyinUnits: number; // fiches per buy-in
  buyinCents: number; // valore in centesimi di un buy-in (0 = non convertibile)
  chips: ChipDef[];
  me: string; // il giocatore che usa questo telefono
  poker?: PokerState;
  tombola?: TombolaState;
  bank?: BankState;
  sette?: SetteState;
  payments?: Payment[];
  endedAt?: number;
  online?: boolean; // condiviso in tempo reale (Supabase)
  version?: number; // ultima versione confermata dal server
  phones?: string[]; // giocatori che hanno un telefono al tavolo (lo dice il server, non va nello stato)
  demo?: boolean; // tavolo di esempio creato al primo avvio
};
