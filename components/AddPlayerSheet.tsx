import React, { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { Sheet } from "./Sheet";
import { Button, Pressy } from "./Pressy";
import { NAME_MAX } from "../lib/engine";
import { colors, playerColors, radius, type } from "../lib/theme";
import { Table } from "../lib/types";

type Props = { visible: boolean; onClose: () => void; table: Table; onAdd: (name: string, color: string) => string | null; title?: string; note?: string; light?: boolean };

export function AddPlayerSheet({ visible, onClose, table, onAdd, title = "Aggiungi chi non ha il telefono", note, light }: Props) {
  const used = new Set(table.players.map((p) => p.color));
  const firstFree = playerColors.find((c) => !used.has(c)) || playerColors[0];
  const [name, setName] = useState("");
  const [color, setColor] = useState(firstFree);
  const [err, setErr] = useState<string | null>(null);
  const ink = light ? "#1E1A15" : colors.text;
  const muted = light ? "#6B6255" : colors.muted;
  const accent = light ? "#2F5E4B" : colors.accent;

  useEffect(() => {
    if (visible) {
      setName("");
      setErr(null);
      setColor(firstFree);
    }
  }, [visible]);

  const submit = () => {
    if (!name.trim()) return;
    try {
      const e = onAdd(name, color);
      if (e) setErr(e);
      else onClose();
    } catch (x: any) {
      setErr(x?.message || "Non sono riuscito ad aggiungerlo");
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={title} subtitle={note || "Lo gestisci tu dal tuo telefono: puntate, premi e pagamenti."} light={light}>
      <Text style={[type.caption, { color: muted, marginBottom: 8 }]}>Nome</Text>
      <TextInput
        value={name}
        onChangeText={(v) => {
          setName(v);
          setErr(null);
        }}
        placeholder="Es. Nonna Pina"
        placeholderTextColor={light ? "#A79D8C" : colors.faint}
        autoFocus
        maxLength={NAME_MAX}
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={submit}
        style={{ height: 54, borderRadius: radius.md, borderWidth: 1.5, borderColor: err ? colors.danger : accent, color: ink, paddingHorizontal: 16, fontSize: 17, backgroundColor: light ? "#FFFFFF" : colors.bg }}
      />
      {err ? <Text style={[type.caption, { color: light ? "#A8452B" : colors.danger, marginTop: 6 }]}>{err}</Text> : null}
      <Text style={[type.caption, { color: muted, marginTop: 16, marginBottom: 10 }]}>Colore</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {playerColors.map((c) => (
          <Pressy
            key={c}
            accessibilityLabel={"Colore " + c}
            onPress={() => setColor(c)}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c, marginRight: 10, marginBottom: 10, borderWidth: 3, borderColor: color === c ? ink : "transparent" }}
          >
            <View />
          </Pressy>
        ))}
      </View>
      <View style={{ height: 8 }} />
      <Button label="Aggiungi al tavolo" icon="person-add-outline" onPress={submit} disabled={!name.trim()} accent={light ? accent : undefined} ink={light ? "#FFFFFF" : undefined} />
    </Sheet>
  );
}
