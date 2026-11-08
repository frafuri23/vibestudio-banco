import React, { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { Sheet } from "./Sheet";
import { Button } from "./Pressy";
import { NAME_MAX } from "../lib/engine";
import { colors, radius, type } from "../lib/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  initial?: string;
  placeholder?: string;
  saveLabel?: string;
  light?: boolean;
  // Restituisce un messaggio d'errore da mostrare sotto il campo, oppure null se è andato tutto bene
  onSave: (name: string) => string | null;
};

// Un campo per scrivere un nome: il tuo (profilo) o quello di un giocatore
export function NameSheet({ visible, onClose, title, subtitle, initial = "", placeholder = "Es. Andrea", saveLabel = "Salva", light, onSave }: Props) {
  const [name, setName] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const ink = light ? "#1E1A15" : colors.text;
  const accent = light ? "#2F5E4B" : colors.accent;

  useEffect(() => {
    if (visible) {
      setName(initial);
      setErr(null);
    }
  }, [visible, initial]);

  const submit = () => {
    if (!name.trim()) return;
    try {
      const e = onSave(name);
      if (e) setErr(e);
      else onClose();
    } catch (x: any) {
      setErr(x?.message || "Non sono riuscito a salvare il nome");
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={title} subtitle={subtitle} light={light}>
      <TextInput
        value={name}
        onChangeText={(v) => {
          setName(v);
          setErr(null);
        }}
        placeholder={placeholder}
        placeholderTextColor={light ? "#A79D8C" : colors.faint}
        autoFocus
        maxLength={NAME_MAX}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={submit}
        accessibilityLabel={title}
        style={{
          height: 54,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: err ? colors.danger : accent,
          color: ink,
          paddingHorizontal: 16,
          fontSize: 17,
          backgroundColor: light ? "#FFFFFF" : colors.bg,
        }}
      />
      {err ? <Text style={[type.caption, { color: light ? "#A8452B" : colors.danger, marginTop: 6 }]}>{err}</Text> : null}
      <View style={{ height: 14 }} />
      <Button label={saveLabel} onPress={submit} disabled={!name.trim()} accent={light ? "#2F5E4B" : undefined} ink={light ? "#FFFFFF" : undefined} />
    </Sheet>
  );
}
