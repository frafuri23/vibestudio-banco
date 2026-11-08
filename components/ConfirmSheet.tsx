import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Sheet } from "./Sheet";
import { Button } from "./Pressy";
import { colors, type } from "../lib/theme";

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  lines: string[];
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  // Icona del pulsante e della prima riga (default: cestino e telefono, per le eliminazioni)
  icon?: keyof typeof Ionicons.glyphMap;
  firstIcon?: keyof typeof Ionicons.glyphMap;
  // Colore dell'icona della prima riga (default: rosso, per le eliminazioni)
  firstColor?: string;
  // "primary" per le conferme che non cancellano niente (es. chiudere il tavolo)
  variant?: "danger" | "primary";
  cancelLabel?: string;
};

// Conferma prima di un'azione che non si annulla (es. eliminare un tavolo)
export function ConfirmSheet({
  visible,
  title,
  subtitle,
  lines,
  confirmLabel,
  onConfirm,
  onClose,
  icon = "trash-outline",
  firstIcon = "phone-portrait-outline",
  firstColor = colors.danger,
  variant = "danger",
  cancelLabel = "Annulla",
}: Props) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} subtitle={subtitle}>
      <View style={{ backgroundColor: colors.elevated, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginTop: 4 }}>
        {lines.map((l, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", marginTop: i ? 10 : 0 }}>
            <Ionicons name={i === 0 ? firstIcon : "information-circle-outline"} size={17} color={i === 0 ? firstColor : colors.muted} style={{ marginTop: 2, marginRight: 10 }} />
            <Text style={[type.body, { color: i === 0 ? colors.text : colors.muted, flex: 1 }]}>{l}</Text>
          </View>
        ))}
      </View>
      <View style={{ height: 16 }} />
      <Button label={confirmLabel} icon={icon} variant={variant} onPress={onConfirm} />
      <View style={{ height: 10 }} />
      <Button label={cancelLabel} variant="ghost" onPress={onClose} />
    </Sheet>
  );
}
