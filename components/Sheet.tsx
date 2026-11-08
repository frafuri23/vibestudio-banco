import React from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, MAX_W, radius, type } from "../lib/theme";
import { IconButton } from "./Pressy";

type Props = { visible: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; light?: boolean };

export function Sheet({ visible, onClose, title, subtitle, children, light }: Props) {
  const insets = useSafeAreaInsets();
  const bg = light ? "#FBF8F2" : colors.surface;
  const fg = light ? "#1E1A15" : colors.text;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable accessibilityLabel="Chiudi" onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }} />
        <View
          style={{
            backgroundColor: bg,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom, 16),
            maxHeight: "86%",
            width: "100%",
            maxWidth: MAX_W + 40,
            alignSelf: "center",
            borderWidth: 1,
            borderColor: light ? "#E4DCCD" : colors.border,
          }}
        >
          <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: light ? "#D8CFBF" : colors.border, marginBottom: 8 }} />
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={[type.section, { color: fg, fontSize: 19 }]}>{title}</Text>
              {subtitle ? <Text style={[type.caption, { color: light ? "#6B6255" : colors.muted, marginTop: 2 }]}>{subtitle}</Text> : null}
            </View>
            <IconButton name="close" label="Chiudi" onPress={onClose} size={40} color={fg} bg={light ? "#FFFFFF" : colors.elevated} border={light ? "#E4DCCD" : colors.border} />
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 6 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
