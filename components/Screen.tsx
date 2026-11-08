import React, { useEffect, useRef } from "react";
import { Animated, ScrollView, StyleProp, Text, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, MAX_W, space, type } from "../lib/theme";
import { useChrome } from "../lib/chrome";
import { IconButton } from "./Pressy";

type ScreenProps = {
  children: React.ReactNode;
  bg?: string;
  gradient?: [string, string];
  scroll?: boolean;
  footer?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  overlay?: React.ReactNode;
  maxWidth?: number; // colonna più larga su tablet/desktop (default MAX_W)
};

// Sfondo colorato a tutto schermo + margini in basso + colonna centrata su tablet/desktop.
// Il margine in alto lo applica la radice di ogni schermata (View con paddingTop: insets.top);
// qui si dichiara solo il colore del testo della barra di stato.
export function Screen({ children, bg = colors.bg, gradient, scroll, footer, contentStyle, overlay, maxWidth = MAX_W }: ScreenProps) {
  const insets = useSafeAreaInsets();
  useChrome(gradient ? gradient[0] : bg);
  const inner = [{ width: "100%" as const, maxWidth, alignSelf: "center" as const, paddingHorizontal: space.xl - 4 }, contentStyle];
  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {gradient ? <LinearGradient colors={gradient} style={{ position: "absolute", left: 0, right: 0, top: 0, height: 420 }} /> : null}
      {overlay}
      <View style={{ flex: 1 }}>
        {scroll ? (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={[{ paddingBottom: footer ? 16 : insets.bottom + 24 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={inner}>{children}</View>
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, inner]}>{children}</View>
        )}
        {footer ? (
          <View style={{ width: "100%", maxWidth, alignSelf: "center", paddingHorizontal: space.xl - 4, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 16) }}>{footer}</View>
        ) : null}
      </View>
    </View>
  );
}

export function FadeIn({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(v, { toValue: 1, duration: 280, delay, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, []);
  return (
    <Animated.View style={[style, { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

type TopBarProps = { title?: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode; light?: boolean; status?: React.ReactNode };

export function TopBar({ title, subtitle, onBack, right, light, status }: TopBarProps) {
  const fg = light ? "#1E1A15" : colors.text;
  const mu = light ? "#6B6255" : colors.muted;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 10, paddingBottom: 12, minHeight: 64 }}>
      {onBack ? (
        <IconButton name="chevron-back" label="Indietro" onPress={onBack} color={fg} bg={light ? "#FFFFFF" : "rgba(0,0,0,0.3)"} border={light ? "#E4DCCD" : colors.border} />
      ) : null}
      <View style={{ flex: 1, marginLeft: onBack ? 12 : 0, marginRight: 8 }}>
        {title ? (
          <Text style={[type.title, { color: fg, fontSize: 21, lineHeight: 24 }]} numberOfLines={2}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={[type.caption, { color: mu, marginTop: 2 }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {status ? <View style={{ marginTop: 6 }}>{status}</View> : null}
      </View>
      {right}
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; action?: React.ReactNode }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 36, paddingHorizontal: 20 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
        <Ionicons name={icon} size={28} color={colors.accent} />
      </View>
      <Text style={[type.heading, { color: colors.text, textAlign: "center" }]}>{title}</Text>
      <Text style={[type.body, { color: colors.muted, textAlign: "center", marginTop: 6 }]}>{body}</Text>
      {action ? <View style={{ marginTop: 16, alignSelf: "stretch" }}>{action}</View> : null}
    </View>
  );
}
