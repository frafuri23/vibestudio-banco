import React from "react";
import { Text, View } from "react-native";
import { GameArt } from "./GameArt";
import { Pressy } from "./Pressy";
import { GameTemplate } from "../lib/games";
import { ChipDef } from "../lib/types";
import { colors, radius, shadow, type } from "../lib/theme";

export function GameCard({ game, selected, onPress, chips }: { game: GameTemplate; selected: boolean; onPress: () => void; chips?: ChipDef[] }) {
  return (
    <Pressy
      onPress={onPress}
      accessibilityLabel={game.title}
      hoverStyle={{ borderColor: selected ? colors.accent : "#4A4238" }}
      style={[
        {
          backgroundColor: selected ? "#2A241C" : colors.surface,
          borderRadius: radius.lg,
          borderWidth: 2,
          borderColor: selected ? colors.accent : colors.border,
          padding: 16,
          minHeight: 150,
        },
        selected ? shadow.glow : null,
      ]}
    >
      <View style={{ height: 40, justifyContent: "center" }}>
        <GameArt art={game.art} size={32} chips={chips} />
      </View>
      <Text style={[type.section, { color: colors.text, marginTop: 12 }]} numberOfLines={1}>
        {game.title}
      </Text>
      <Text style={[type.caption, { color: colors.muted, marginTop: 4, fontWeight: "400" }]} numberOfLines={2}>
        {game.blurb}
      </Text>
    </Pressy>
  );
}
