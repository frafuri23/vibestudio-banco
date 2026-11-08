import React from "react";
import { Text, View } from "react-native";
import { Avatar } from "./Avatar";
import { Chip } from "./Tokens";
import { HandView } from "../lib/poker";
import { Player } from "../lib/types";
import { colors, pokerSkins, PokerSkin } from "../lib/theme";
import { fmtNum } from "../lib/format";
import { BET_H, DEALER_SIZE, layoutTable, SEAT_TEXT, SeatIn, TABLE_PAD, VBET_H } from "../lib/pokerLayout";

type Props = {
  width: number;
  players: Player[];
  seats: string[];
  me: string;
  view: HandView | null;
  dealer?: string;
  stacks: Record<string, number>;
  skin: PokerSkin;
  toCallLabel?: string;
};

const BET_CHIP = { color: "#1C1A18", stripe: "#F4EEE3" };

export function PokerTable({ width, players, seats, me, view, dealer, stacks, skin, toCallLabel }: Props) {
  const s = pokerSkins[skin] || pokerSkins.casino;
  const W = width;
  // Io in basso, gli altri in senso orario
  const order = players.map((p) => p.id);
  const meIdx = Math.max(0, order.indexOf(me));
  const rotated = [...order.slice(meIdx), ...order.slice(0, meIdx)];

  const seatIn: SeatIn[] = rotated.map((pid) => {
    const p = players.find((x) => x.id === pid);
    const isMe = pid === me;
    const bet = view?.committed[pid] || 0;
    return {
      id: pid,
      name: p?.name || "",
      isMe,
      bet,
      stack: isMe ? (bet > 0 ? "punta " + fmtNum(bet) : null) : fmtNum(stacks[pid] || 0),
      last: isMe ? undefined : view?.last[pid],
    };
  });
  const potText = fmtNum(view?.pot || 0);
  const L = layoutTable(W, seatIn, dealer, potText, toCallLabel);
  const H = L.H;
  const T = SEAT_TEXT;

  return (
    <View style={{ width: W, height: H + TABLE_PAD, alignSelf: "center" }}>
      <View
        style={{
          position: "absolute",
          left: W * 0.14,
          top: H * 0.1,
          width: W * 0.72,
          height: H * 0.8,
          borderRadius: W,
          backgroundColor: s.rim,
          padding: 12,
          shadowColor: skin === "neon" ? s.glow : "#000",
          shadowOpacity: skin === "neon" ? 0.7 : 0.4,
          shadowRadius: skin === "neon" ? 24 : 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}
      >
        <View style={{ flex: 1, borderRadius: W, backgroundColor: s.felt, overflow: "hidden" }}>
          <View style={{ position: "absolute", left: 14, right: 14, top: 14, bottom: 14, borderRadius: W, borderWidth: 1.5, borderColor: s.line }} />
          <View style={{ position: "absolute", left: "20%", right: "20%", top: "15%", bottom: "15%", borderRadius: W, backgroundColor: s.feltDeep, opacity: 0.35 }} />
        </View>
      </View>

      {/* Piatto al centro: scende del minimo necessario se le puntate di chi sta in alto lo coprirebbero */}
      <View style={{ position: "absolute", left: 0, right: 0, top: L.potTop, alignItems: "center" }} pointerEvents="none">
        <View style={{ flexDirection: "row", marginBottom: 6, height: 26 }}>
          <Chip size={26} color="#2F7A4E" stripe="#F4EEE3" />
          <View style={{ marginLeft: -9 }}>
            <Chip size={26} color="#1C1A18" stripe="#F4EEE3" />
          </View>
          <View style={{ marginLeft: -9 }}>
            <Chip size={26} color="#6A3FA0" stripe="#E8CF6A" />
          </View>
        </View>
        <Text style={{ color: "rgba(244,238,227,0.75)", fontSize: 12, lineHeight: 16, fontWeight: "700", letterSpacing: 2.5 }}>PIATTO</Text>
        <Text style={{ color: colors.text, fontSize: L.amountFs, fontWeight: "800", letterSpacing: -2, lineHeight: L.amountLh }}>{potText}</Text>
        {toCallLabel ? <Text style={{ color: "rgba(244,238,227,0.8)", fontSize: 14, lineHeight: 18 }}>{toCallLabel}</Text> : null}
      </View>

      {rotated.map((pid) => {
        const p = players.find((x) => x.id === pid);
        const pt = L.seats[pid];
        if (!p || !pt) return null;
        const inHand = seats.includes(pid);
        const folded = !!view?.folded.has(pid) || !inHand;
        const acting = view?.toAct === pid;
        const bet = view?.committed[pid] || 0;
        const last = view?.last[pid];
        const isMe = pid === me;
        const br = L.bets[pid];
        return (
          <React.Fragment key={pid}>
            <View style={{ position: "absolute", left: pt.x - L.blockW / 2, top: pt.y - L.ring / 2, width: L.blockW, alignItems: "center", opacity: folded && !isMe ? 0.55 : 1 }}>
              <View style={{ borderRadius: L.seatSize, borderWidth: 3, borderColor: acting ? colors.accent : "transparent", padding: 1 }}>
                <Avatar player={p} size={L.seatSize} />
              </View>
              <Text style={{ color: colors.text, fontSize: 13, lineHeight: T.nameLh, fontWeight: "600", marginTop: T.nameMt, maxWidth: L.blockW }} numberOfLines={1}>
                {p.name}
              </Text>
              {!isMe || bet > 0 ? (
                <Text style={{ color: colors.text, fontSize: 15, lineHeight: T.stackLh, fontWeight: "800", letterSpacing: -0.5 }} numberOfLines={1}>
                  {isMe ? "punta " + fmtNum(bet) : fmtNum(stacks[pid] || 0)}
                </Text>
              ) : null}
              {last && !isMe ? (
                <View style={{ backgroundColor: last === "Fold" ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.14)", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2, marginTop: T.lastMt, maxWidth: L.blockW }}>
                  <Text style={{ color: colors.text, fontSize: 11.5, lineHeight: T.lastH - 4, fontWeight: "700" }} numberOfLines={1}>
                    {last}
                  </Text>
                </View>
              ) : null}
            </View>
            {bet > 0 && !isMe && br && br.v ? (
              <View
                accessibilityLabel={(p.name || "Giocatore") + " punta " + fmtNum(bet)}
                style={{
                  position: "absolute",
                  left: br.x,
                  top: br.y,
                  width: br.w,
                  height: VBET_H,
                  borderRadius: 12,
                  backgroundColor: "rgba(0,0,0,0.32)",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 4,
                }}
              >
                <Chip size={20} color={BET_CHIP.color} stripe={BET_CHIP.stripe} />
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14, lineHeight: 16, marginTop: 1 }} numberOfLines={1}>
                  {fmtNum(bet)}
                </Text>
              </View>
            ) : bet > 0 && !isMe && br ? (
              <View
                accessibilityLabel={(p.name || "Giocatore") + " punta " + fmtNum(bet)}
                style={{
                  position: "absolute",
                  left: br.x,
                  top: br.y,
                  width: br.w,
                  height: BET_H,
                  borderRadius: BET_H / 2,
                  backgroundColor: "rgba(0,0,0,0.32)",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Chip size={22} color={BET_CHIP.color} stripe={BET_CHIP.stripe} />
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15, lineHeight: 18, marginLeft: 5 }} numberOfLines={1}>
                  {fmtNum(bet)}
                </Text>
              </View>
            ) : null}
          </React.Fragment>
        );
      })}

      {L.dealer ? (
        <View
          accessibilityLabel="Dealer"
          style={{ position: "absolute", left: L.dealer.x, top: L.dealer.y, width: DEALER_SIZE, height: DEALER_SIZE, borderRadius: DEALER_SIZE / 2, backgroundColor: "#F4EEE3", alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: "#1E1A15", fontWeight: "800", fontSize: 12 }}>D</Text>
        </View>
      ) : null}
    </View>
  );
}
