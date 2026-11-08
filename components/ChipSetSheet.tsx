import React, { useEffect, useState } from "react";
import { Platform, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Sheet } from "./Sheet";
import { Chip } from "./Tokens";
import { Button, IconButton, Pressy } from "./Pressy";
import { CHIP_PALETTE, CHIP_VALUES, stripeFor } from "../lib/games";
import { ChipDef } from "../lib/types";
import { colors, radius, type } from "../lib/theme";
import { fmtNum } from "../lib/format";

type Props = { visible: boolean; onClose: () => void; chips: ChipDef[]; onChange: (c: ChipDef[]) => void };

// Valore della fiche scritto a mano (qualsiasi numero intero da 1 in su)
function ValueInput({ value, onValue }: { value: number; onValue: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);
  return (
    <TextInput
      value={focused ? text : fmtNum(value)}
      onChangeText={(t) => {
        setText(t);
        const v = parseInt(t.replace(/\D/g, ""), 10);
        if (v > 0 && v <= 100000000) onValue(v);
      }}
      onFocus={() => {
        setText(String(value));
        setFocused(true);
      }}
      onBlur={() => setFocused(false)}
      keyboardType="number-pad"
      selectTextOnFocus
      maxLength={10}
      accessibilityLabel="Valore della fiche"
      style={[
        type.number,
        { color: colors.text, fontSize: 24, minWidth: 88, maxWidth: 120, height: 44, textAlign: "center", borderBottomWidth: 1.5, borderBottomColor: focused ? colors.accent : "transparent", paddingVertical: 0 },
        Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null,
      ]}
    />
  );
}

export function ChipSetSheet({ visible, onClose, chips, onChange }: Props) {
  const update = (i: number, patch: Partial<ChipDef>) => onChange(chips.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  // + e − saltano al valore "tondo" successivo, anche partendo da un valore scritto a mano
  const step = (i: number, dir: 1 | -1) => {
    const v = chips[i].value;
    const next = dir > 0 ? CHIP_VALUES.find((x) => x > v) : [...CHIP_VALUES].reverse().find((x) => x < v);
    if (next !== undefined) update(i, { value: next });
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Il tuo set" subtitle="Stessi colori e valori delle fiches che avete a casa">
      {chips.map((c, i) => (
        <View key={i} style={{ backgroundColor: colors.elevated, borderRadius: radius.lg, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Chip size={52} color={c.color} stripe={c.stripe} value={c.value} textColor={c.text} />
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
              <IconButton name="remove" label="Valore più basso" size={40} onPress={() => step(i, -1)} />
              <ValueInput value={c.value} onValue={(v) => update(i, { value: v })} />
              <IconButton name="add" label="Valore più alto" size={40} onPress={() => step(i, 1)} />
            </View>
            {chips.length > 2 ? <IconButton name="trash-outline" label="Togli fiche" size={40} color={colors.danger} onPress={() => onChange(chips.filter((_, k) => k !== i))} /> : null}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 12 }}>
            {CHIP_PALETTE.map((col) => (
              <Pressy
                key={col}
                accessibilityLabel={"Colore " + col}
                onPress={() => update(i, { color: col, stripe: stripeFor(col), text: col === "#F1ECE2" || col === "#E0A040" ? "#2A2111" : undefined })}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: col,
                  marginRight: 8,
                  marginBottom: 6,
                  borderWidth: 2,
                  borderColor: c.color === col ? colors.accent : "rgba(255,255,255,0.12)",
                }}
              >
                <View />
              </Pressy>
            ))}
          </View>
        </View>
      ))}
      {chips.length < 5 ? (
        <Button
          variant="ghost"
          icon="add-circle-outline"
          label="Aggiungi una fiche"
          compact
          onPress={() => onChange([...chips, { value: CHIP_VALUES[Math.min(CHIP_VALUES.length - 1, chips.length + 6)], color: CHIP_PALETTE[(chips.length + 4) % CHIP_PALETTE.length], stripe: "#F4EEE3" }])}
        />
      ) : null}
      <View style={{ height: 10 }} />
      <Button label="Fatto" onPress={onClose} />
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12 }}>
        <Ionicons name="information-circle-outline" size={16} color={colors.muted} />
        <Text style={[type.caption, { color: colors.muted, marginLeft: 6, flex: 1 }]}>Tocca un colore per cambiarlo. Per il valore usa + e − oppure tocca il numero e scrivilo.</Text>
      </View>
    </Sheet>
  );
}
