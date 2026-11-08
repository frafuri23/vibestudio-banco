import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Pressy } from "./Pressy";
import { GameArt } from "./GameArt";
import { gameOf } from "../lib/games";
import { Table } from "../lib/types";
import { colors, radius, type } from "../lib/theme";
import { timeAgo } from "../lib/format";

export function statusOf(t: Table): { label: string; color: string } {
  if (t.status === "closed") return { label: "Chiuso", color: colors.faint };
  if (t.endedAt) return { label: "Si fanno i conti", color: colors.accent };
  if (t.status === "lobby") return { label: "In attesa", color: colors.warn };
  return { label: "In corso", color: colors.success };
}

// demoBadge: false dentro il gruppo "Esempi" della Home, dove si sa già che sono esempi
type Props = { table: Table; onPress: () => void; onDelete?: () => void; demoBadge?: boolean };

export function TableCard({ table, onPress, onDelete, demoBadge = true }: Props) {
  const g = gameOf(table.kind);
  const st = statusOf(table);
  const n = table.players.length;
  const badge = !!table.demo && demoBadge;
  return (
    <View style={{ marginBottom: 10 }}>
      <Pressy
        onPress={onPress}
        accessibilityLabel={"Apri " + table.name + (table.demo ? ", tavolo di esempio" : "") + ", " + st.label.toLowerCase() + ", " + n + (n === 1 ? " giocatore" : " giocatori")}
        hoverStyle={{ borderColor: "#4A4238" }}
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: 14,
          paddingLeft: 14,
          paddingRight: onDelete ? 54 : 12,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <View style={{ width: onDelete ? 52 : 60, height: 40, alignItems: "flex-start", justifyContent: "center", overflow: "hidden" }}>
          <GameArt art={g.art} size={g.art === "bills" ? 24 : 18} chips={table.chips} />
        </View>
        <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
          {/* Riga 1: nome (+ "Esempio") e, a destra, quanti giocatori: un numero piccolo invece delle iniziali, così il nome ha spazio */}
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={[type.bodyStrong, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>
              {table.name}
            </Text>
            {badge ? (
              <View style={{ paddingHorizontal: 7, paddingVertical: 1, borderRadius: radius.pill, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: "rgba(221,183,101,0.35)", marginLeft: 6, flexShrink: 0 }}>
                <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "800", letterSpacing: 0.4 }}>Esempio</Text>
              </View>
            ) : null}
            <View style={{ flex: 1, minWidth: 8 }} />
            <View
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
              style={{ flexDirection: "row", alignItems: "center", flexShrink: 0, height: 22, paddingHorizontal: 7, borderRadius: radius.pill, backgroundColor: colors.elevated }}
            >
              <Ionicons name="people" size={12} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", marginLeft: 4 }}>{n}</Text>
            </View>
          </View>
          {/* Riga 2: lo stato ha tutta la larghezza e, se serve, va a capo invece di essere tagliato */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", marginTop: 4 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: st.color, marginRight: 6, marginTop: 6 }} />
            <Text style={[type.caption, { color: colors.muted, flex: 1 }]} numberOfLines={2}>
              {st.label + " · " + g.title + " · " + timeAgo(table.createdAt)}
            </Text>
          </View>
        </View>
        {onDelete ? null : <Ionicons name="chevron-forward" size={18} color={colors.faint} style={{ marginLeft: 8 }} />}
      </Pressy>
      {onDelete ? (
        <View pointerEvents="box-none" style={{ position: "absolute", right: 6, top: 0, bottom: 0, justifyContent: "center" }}>
          <Pressy
            onPress={onDelete}
            accessibilityLabel={"Elimina " + table.name}
            hoverStyle={{ backgroundColor: colors.dangerSoft }}
            style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="trash-outline" size={19} color={colors.muted} />
          </Pressy>
        </View>
      ) : null}
    </View>
  );
}
