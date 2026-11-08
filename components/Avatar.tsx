import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Player } from "../lib/types";
import { initials } from "../lib/format";
import { colors } from "../lib/theme";

type Props = { player?: Player; size?: number; ring?: string; dim?: boolean; icon?: keyof typeof Ionicons.glyphMap; color?: string };

export function Avatar({ player, size = 40, ring, dim, icon, color }: Props) {
  const bg = color || player?.color || colors.elevated;
  const borderColor = ring || (player?.noPhone ? colors.accent : "transparent");
  const bw = ring || player?.noPhone ? Math.max(2, size * 0.06) : 0;
  const glyph = icon || (player?.isHost ? "person-outline" : undefined);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: bw,
        borderColor,
        opacity: dim ? 0.45 : 1,
      }}
    >
      {glyph ? (
        <Ionicons name={glyph} size={size * 0.46} color="#1E1A15" />
      ) : (
        <Text style={{ color: "#1E1A15", fontWeight: "800", fontSize: size * (player && initials(player.name).length > 1 ? 0.34 : 0.4) }}>{player ? initials(player.name) : "?"}</Text>
      )}
    </View>
  );
}
