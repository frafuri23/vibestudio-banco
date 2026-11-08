import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Avatar } from "./Avatar";
import { Button } from "./Pressy";
import { ChipComposer } from "./ChipComposer";
import { HandView } from "../lib/poker";
import { Player, PokerActionType, Table } from "../lib/types";
import { colors, radius, type } from "../lib/theme";
import { fmtNum } from "../lib/format";

type Props = {
  table: Table;
  view: HandView | null;
  actor?: Player;
  onAct: (t: PokerActionType, amount?: number) => void;
  onFoldWin: () => void;
  onShowdown: () => void;
  onNewHand: () => void;
  bottomInset: number;
  // Telefoni bassi: cifre più piccole, fiches un po' più piccole e niente frase di aiuto
  compact?: boolean;
};

// Altezza del pannello quando tocca a qualcuno, lo stato più alto. Tutti gli stati la usano come
// altezza minima: il tavolo si dimensiona su questa e non cambia misura fra una mano e l'altra.
export function panelHeight(compact: boolean, bottomInset: number): number {
  const pb = Math.max(bottomInset, 16);
  return compact ? 12 + 50 + 10 + 50 + 10 + 56 + pb + 2 : 18 + 56 + 14 + 58 + 10 + 18 + 12 + 56 + pb + 2;
}

export function PokerPanel({ table, view, actor, onAct, onFoldWin, onShowdown, onNewHand, bottomInset, compact = false }: Props) {
  const [bet, setBet] = useState(0);
  const actorId = actor?.id;
  useEffect(() => setBet(0), [actorId, view?.street, table.poker?.hand?.actions.length]);

  const wrap = (children: React.ReactNode) => (
    <View
      style={{
        backgroundColor: colors.surface,
        borderTopLeftRadius: radius.xl,
        borderTopRightRadius: radius.xl,
        paddingHorizontal: 20,
        paddingTop: compact ? 12 : 18,
        paddingBottom: Math.max(bottomInset, 16),
        borderWidth: 1,
        borderColor: colors.border,
        minHeight: panelHeight(compact, bottomInset),
        justifyContent: "flex-end",
      }}
    >
      {children}
    </View>
  );

  if (!view) {
    return wrap(
      <>
        <Text style={[type.heading, { color: colors.text }]}>Nessuna mano in corso</Text>
        <Text style={[type.body, { color: colors.muted, marginTop: 4, marginBottom: compact ? 10 : 14 }]}>Servono almeno due giocatori con fiches. Ricarica qualcuno dal menu o chiudi la serata.</Text>
        <Button label="Nuova mano" icon="refresh" onPress={onNewHand} />
      </>
    );
  }

  if (view.winnerByFold) {
    const w = table.players.find((p) => p.id === view.winnerByFold);
    return wrap(
      <>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
          <Avatar player={w} size={44} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={[type.caption, { color: colors.muted }]}>Tutti gli altri hanno passato</Text>
            <Text style={[type.heading, { color: colors.text, fontSize: 19 }]}>{(w?.id === table.me ? "Vinci tu" : (w?.name || "?") + " vince") + " " + fmtNum(view.pot)}</Text>
          </View>
        </View>
        <Button label="Assegna e prossima mano" iconRight="arrow-forward" onPress={onFoldWin} />
      </>
    );
  }

  if (view.street >= 4 || !actor) {
    return wrap(
      <>
        <Text style={[type.heading, { color: colors.text, fontSize: 19 }]}>Showdown</Text>
        <Text style={[type.body, { color: colors.muted, marginTop: 4, marginBottom: compact ? 10 : 14 }]}>Scoprite le carte e toccate chi ha vinto: i piatti laterali li calcolo io.</Text>
        <Button label="Chi ha vinto?" iconRight="arrow-forward" onPress={onShowdown} />
      </>
    );
  }

  const isMe = actor.id === table.me;
  const stack = view.stack[actor.id] || 0;
  const committed = view.committed[actor.id] || 0;
  const toCall = Math.max(0, view.currentBet - committed);
  const callAmt = Math.min(toCall, stack);
  const opening = view.currentBet === 0;
  const raiseLabel =
    bet === 0 ? (opening ? "Punta" : "Rilancia") : bet >= stack ? "All-in " + fmtNum(stack) : (opening ? "Punta " : "Rilancia a ") + fmtNum(committed + bet);
  const raiseSub = bet === 0 ? "da " + fmtNum(view.minRaiseTo) + " in su" : undefined;
  const numStyle = compact ? { fontSize: 28, lineHeight: 32 } : { fontSize: 34, lineHeight: 38 };

  return wrap(
    <>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          {!isMe ? <Avatar player={actor} size={34} /> : null}
          <View style={{ marginLeft: isMe ? 0 : 10 }}>
            <Text style={[type.caption, { color: colors.muted }]}>{isMe ? "Il tuo stack" : "Tocca a " + actor.name}</Text>
            <Text style={[type.number, { color: colors.text }, numStyle]}>{fmtNum(stack)}</Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[type.caption, { color: colors.muted }]}>Stai puntando</Text>
          <Text style={[type.number, { color: colors.accent }, numStyle]}>{fmtNum(bet)}</Text>
        </View>
      </View>
      <View style={{ marginTop: compact ? 10 : 14 }}>
        <ChipComposer chips={table.chips} value={bet} onChange={setBet} max={stack} size={compact ? 50 : 58} />
      </View>
      {!compact ? <Text style={[type.caption, { color: colors.muted, textAlign: "center", marginTop: 10, fontWeight: "400" }]}>Tocca le fiches per comporre la puntata</Text> : null}
      <View style={{ flexDirection: "row", marginTop: compact ? 10 : 12 }}>
        <View style={{ flex: 0.8 }}>
          <Button label="Fold" variant="ghost" onPress={() => onAct("fold")} />
        </View>
        <View style={{ flex: 1.1, marginHorizontal: 8 }}>
          <Button label={toCall === 0 ? "Check" : callAmt >= stack ? "All-in " + fmtNum(callAmt) : "Chiama " + fmtNum(callAmt)} variant="secondary" onPress={() => onAct(toCall === 0 ? "check" : "call")} />
        </View>
        <View style={{ flex: 1.3 }}>
          <Button
            label={raiseLabel}
            sub={raiseSub}
            variant={bet > 0 ? "primary" : "secondary"}
            onPress={() => (bet > 0 ? onAct("raise", bet) : setBet(Math.min(stack, Math.max(0, view.minRaiseTo - committed))))}
            style={bet > 0 ? undefined : { backgroundColor: "#3A3122" }}
          />
        </View>
      </View>
    </>
  );
}
