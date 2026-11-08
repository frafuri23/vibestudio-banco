import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Pressy } from "./Pressy";
import { BANK, POT, undoneIds } from "../lib/ledger";
import { Table } from "../lib/types";
import { fmtNum, timeAgo } from "../lib/format";
import { radius, type } from "../lib/theme";

const LIGHT = { INK: "#1E1A15", MUTED: "#6B6255", GREEN: "#2F5E4B", RED: "#A8452B", CARD: "#FFFDF8", BORDER: "#E4DCCD", SEP: "#EEE7DA", OUTBG: "#F6E3DC", INBG: "#E1EEE7", LINK: "#2F5E4B" };
const DARK = { INK: "#F4EEE3", MUTED: "#A49B8C", GREEN: "#7FD1B2", RED: "#E58A6E", CARD: "#1D1A16", BORDER: "#2F2A24", SEP: "rgba(255,255,255,0.07)", OUTBG: "rgba(229,138,110,0.14)", INBG: "rgba(127,209,178,0.14)", LINK: "#DDB765" };

export function accName(t: Table, id: string): string {
  if (id === BANK) return "Banca";
  if (id === POT) return "Piatto";
  return t.players.find((p) => p.id === id)?.name || "?";
}

// limit = 1: solo l'ultimo movimento con "Vedi tutti" (schermate di gioco che stanno in una pagina)
export function RecentMoves({ table, perspective, onUndo, onAll, limit = 4, dark, marginTop }: { table: Table; perspective: string; onUndo: (id: string) => void; onAll: () => void; limit?: number; dark?: boolean; marginTop?: number }) {
  const { INK, MUTED, GREEN, RED, CARD, BORDER, SEP, OUTBG, INBG, LINK } = dark ? DARK : LIGHT;
  const undone = undoneIds(table.entries);
  const single = limit === 1;
  const list = [...table.entries].filter((e) => e.kind !== "undo" && e.kind !== "buyin" && !undone.has(e.id)).reverse().slice(0, limit);
  return (
    <View style={{ marginTop: marginTop ?? (single ? 16 : 24) }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: single ? 6 : 10 }}>
        <Text style={[type.section, { color: INK }]}>{single ? "Ultimo movimento" : "Ultimi movimenti"}</Text>
        {single ? (
          <Pressy onPress={onAll} hitSlop={8} accessibilityLabel="Vedi tutti i movimenti nel registro" style={{ flexDirection: "row", alignItems: "center", minHeight: 32, paddingLeft: 8 }}>
            <Text style={{ color: LINK, fontWeight: "700", fontSize: 13.5 }}>Vedi tutti</Text>
            <Ionicons name="chevron-forward" size={14} color={LINK} style={{ marginLeft: 2 }} />
          </Pressy>
        ) : (
          <Pressy onPress={onAll} style={{ paddingVertical: 6 }}>
            <Text style={[type.caption, { color: MUTED }]}>registro completo</Text>
          </Pressy>
        )}
      </View>
      <View style={{ backgroundColor: CARD, borderRadius: radius.lg, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14 }}>
        {list.length === 0 ? (
          <Text style={[type.body, { color: MUTED, paddingVertical: single ? 14 : 18, textAlign: "center" }]}>Ancora nessun movimento: il primo pagamento comparirà qui.</Text>
        ) : (
          list.map((e, i) => {
            const out = e.from === perspective;
            const inn = e.to === perspective;
            const sign = out ? -1 : inn ? 1 : 0;
            return (
              <View key={e.id} style={{ flexDirection: "row", alignItems: "center", minHeight: single ? 56 : 62, borderTopWidth: i ? 1 : 0, borderTopColor: SEP }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: out ? OUTBG : inn ? INBG : SEP }}>
                  <Ionicons name={out ? "arrow-up" : inn ? "arrow-down" : "swap-horizontal"} size={17} color={out ? RED : inn ? GREEN : MUTED} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[type.bodyStrong, { color: INK }]} numberOfLines={1}>
                    {accName(table, e.from) + " → " + accName(table, e.to) + (e.note ? " · " + e.note.toLowerCase() : "")}
                  </Text>
                  <Text style={[type.caption, { color: MUTED, fontWeight: "400" }]}>{timeAgo(e.ts)}</Text>
                </View>
                <Text style={[type.number, { color: sign < 0 ? RED : sign > 0 ? GREEN : INK, fontSize: 19 }]}>{(sign < 0 ? "−" : sign > 0 ? "+" : "") + fmtNum(e.amount)}</Text>
                <Pressy onPress={() => onUndo(e.id)} accessibilityLabel="Annulla questo movimento" style={{ marginLeft: 12, paddingVertical: 8 }}>
                  <Text style={{ color: LINK, fontWeight: "700", fontSize: 13.5, textDecorationLine: "underline" }}>Annulla</Text>
                </Pressy>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}
