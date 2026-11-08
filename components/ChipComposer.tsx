import React from "react";
import { View } from "react-native";
import { ChipDef } from "../lib/types";
import { Chip } from "./Tokens";
import { IconButton, Pressy, tap } from "./Pressy";
import { colors } from "../lib/theme";

type Props = { chips: ChipDef[]; value: number; onChange: (v: number) => void; max: number; size?: number };

export function ChipComposer({ chips, value, onChange, max, size = 62 }: Props) {
  const sorted = [...chips].sort((a, b) => a.value - b.value).slice(0, 5);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      {sorted.map((c) => {
        const disabled = value + c.value > max && value < max;
        return (
          <Pressy
            key={c.value + c.color}
            haptic={false}
            scaleTo={0.9}
            accessibilityLabel={"Aggiungi " + c.value}
            onPress={() => {
              tap("light");
              onChange(Math.min(max, value + c.value));
            }}
            disabled={value >= max || (disabled && false)}
            style={{ borderRadius: size / 2 }}
          >
            <Chip size={size} color={c.color} stripe={c.stripe} value={c.value} textColor={c.text} dim={disabled} />
          </Pressy>
        );
      })}
      <IconButton name="close" label="Azzera la puntata" onPress={() => onChange(0)} size={Math.min(52, size * 0.85)} bg="transparent" border={colors.border} />
    </View>
  );
}
