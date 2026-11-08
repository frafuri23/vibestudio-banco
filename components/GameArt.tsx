import React from "react";
import { View } from "react-native";
import { Bill, Chip, Coin, PlayingCard, RingChip } from "./Tokens";
import { GameTemplate } from "../lib/games";
import { ChipDef } from "../lib/types";

const row = (overlap: number) => ({ flexDirection: "row" as const, alignItems: "center" as const, marginLeft: overlap });

export function GameArt({ art, size = 34, chips }: { art: GameTemplate["art"]; size?: number; chips?: ChipDef[] }) {
  const o = -size * 0.3;
  if (art === "chips") {
    const c = [
      ["#2F7A4E", "#F4EEE3"],
      ["#1C1A18", "#F4EEE3"],
      ["#6A3FA0", "#E8CF6A"],
      ["#E0A040", "#3A2A15"],
    ];
    return (
      <View style={{ flexDirection: "row", height: size }}>
        {c.map(([col, st], i) => (
          <View key={i} style={i ? row(o) : undefined}>
            <Chip size={size} color={col} stripe={st} />
          </View>
        ))}
      </View>
    );
  }
  if (art === "coins") {
    return (
      <View style={{ flexDirection: "row", height: size }}>
        <Coin size={size} metal="copper" />
        <View style={row(o)}>
          <Coin size={size} metal="gold" />
        </View>
        <View style={row(o)}>
          <Coin size={size} metal="gold" inner="silver" />
        </View>
      </View>
    );
  }
  if (art === "bills") {
    const w = size * 1.5;
    return (
      <View style={{ flexDirection: "row", height: size * 1.05, alignItems: "center" }}>
        <Bill width={w} color="#CFE6CF" rotate={-6} />
        <View style={row(-w * 0.55)}>
          <Bill width={w} color="#F1D9B5" rotate={-2} />
        </View>
        <View style={row(-w * 0.55)}>
          <Bill width={w} color="#C9D5F2" rotate={5} />
        </View>
      </View>
    );
  }
  if (art === "sette") {
    return (
      <View style={{ flexDirection: "row", height: size, alignItems: "center" }}>
        <Coin size={size} metal="gold" />
        <View style={row(o)}>
          <Coin size={size} metal="copper" />
        </View>
        <View style={{ marginLeft: size * 0.25 }}>
          <PlayingCard width={size * 0.7} rotate={8} />
        </View>
      </View>
    );
  }
  if (art === "custom") {
    const set = chips && chips.length ? chips.map((c) => c.color) : ["#DDB765", "#7FD1B2", "#E58A6E"];
    return (
      <View style={{ flexDirection: "row", height: size }}>
        {set.slice(0, 4).map((col, i) => (
          <View key={i} style={i ? { marginLeft: size * 0.08 } : undefined}>
            <RingChip size={size} color={col === "#1C1A18" ? "#8C8378" : col} dashed />
          </View>
        ))}
      </View>
    );
  }
  const free = ["#5A79B5", "#C2654E", "#4F8F6E", "#8C6BC0"];
  return (
    <View style={{ flexDirection: "row", height: size }}>
      {free.map((col, i) => (
        <View key={i} style={i ? row(o) : undefined}>
          <RingChip size={size} color={col} />
        </View>
      ))}
    </View>
  );
}
