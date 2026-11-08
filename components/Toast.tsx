import React, { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { create } from "zustand";
import { colors, radius, shadow } from "../lib/theme";

type ToastAction = { label: string; onPress: () => void };
type ToastMsg = { id: number; text: string; tone: "ok" | "error" | "info"; action?: ToastAction };
const useToastStore = create<{ msg: ToastMsg | null; show: (text: string, tone?: ToastMsg["tone"], action?: ToastAction) => void; clear: () => void }>((set) => ({
  msg: null,
  show: (text, tone = "info", action) => set({ msg: { id: Date.now(), text, tone, action } }),
  clear: () => set({ msg: null }),
}));

// action: un pulsante dentro il messaggio (es. "Annulla" dopo un pagamento); il messaggio resta più a lungo
export const toast = {
  ok: (t: string, action?: ToastAction) => useToastStore.getState().show(t, "ok", action),
  error: (t: string) => useToastStore.getState().show(t, "error"),
  info: (t: string) => useToastStore.getState().show(t, "info"),
};

export function ToastHost() {
  const msg = useToastStore((s) => s.msg);
  const clear = useToastStore((s) => s.clear);
  const insets = useSafeAreaInsets();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!msg) return;
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    const ms = msg.action ? 5000 : msg.tone === "error" ? 3200 : 2300;
    const t = setTimeout(() => {
      Animated.timing(v, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => clear());
    }, ms);
    return () => clearTimeout(t);
  }, [msg?.id]);
  if (!msg) return null;
  const tint = msg.tone === "error" ? colors.danger : msg.tone === "ok" ? colors.success : colors.accent;
  const icon = msg.tone === "error" ? "alert-circle" : msg.tone === "ok" ? "checkmark-circle" : "information-circle";
  const action = msg.action;
  // Con un'azione il messaggio è toccabile: sta in basso, sopra il pulsante fisso della schermata,
  // così non copre Indietro / Menu / Fine partita della barra in alto. Senza azione resta in alto e non blocca i tocchi.
  const pos = action ? { bottom: insets.bottom + 90 } : { top: insets.top + 8 };
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, ...pos, alignItems: "center", paddingHorizontal: 16 }}>
      <Animated.View
        pointerEvents={action ? "auto" : "none"}
        accessibilityLiveRegion="polite"
        style={[
          {
            opacity: v,
            transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [action ? 12 : -12, 0] }) }],
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.elevated,
            borderRadius: radius.pill,
            paddingVertical: action ? 4 : 11,
            paddingLeft: 16,
            paddingRight: action ? 4 : 16,
            borderWidth: 1,
            borderColor: colors.border,
            maxWidth: 520,
          },
          shadow.soft,
        ]}
      >
        <Ionicons name={icon as any} size={18} color={tint} style={{ marginRight: 8 }} />
        <Text style={{ color: colors.text, fontSize: 14.5, fontWeight: "600", flexShrink: 1, paddingVertical: action ? 7 : 0 }}>{msg.text}</Text>
        {action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={() => {
              clear();
              action.onPress();
            }}
            style={(st: any) => ({
              marginLeft: 12,
              minHeight: 40,
              paddingHorizontal: 14,
              borderRadius: radius.pill,
              backgroundColor: st.pressed || st.hovered ? "rgba(221,183,101,0.24)" : colors.accentSoft,
              flexDirection: "row",
              alignItems: "center",
              ...(st.focused ? ({ outlineColor: colors.accent, outlineWidth: 2, outlineStyle: "solid" } as any) : null),
            })}
          >
            <Ionicons name="arrow-undo" size={14} color={colors.accent} />
            <Text style={{ color: colors.accent, fontWeight: "800", fontSize: 14, marginLeft: 5 }}>{action.label}</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}
