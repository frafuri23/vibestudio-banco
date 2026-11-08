import React, { useRef } from "react";
import { ActivityIndicator, Animated, Platform, Pressable, StyleProp, Text, View, ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadow } from "../lib/theme";

type PressyProps = {
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  hoverStyle?: ViewStyle;
  children: React.ReactNode;
  haptic?: boolean;
  scaleTo?: number;
  accessibilityLabel?: string;
  hitSlop?: number;
  // "checkbox" per le righe che si selezionano (es. i vincitori della tombola): VoiceOver e i lettori
  // di schermo sul web dicono "selezionato / non selezionato"
  role?: "button" | "checkbox";
  checked?: boolean;
  outerStyle?: StyleProp<ViewStyle>;
};

export function tap(kind: "light" | "medium" | "success" | "error" = "light") {
  if (Platform.OS === "web") return;
  try {
    if (kind === "success") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (kind === "error") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    else Haptics.impactAsync(kind === "medium" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // niente vibrazione disponibile
  }
}

export function Pressy({ onPress, disabled, style, hoverStyle, children, haptic = true, scaleTo = 0.97, accessibilityLabel, hitSlop, role = "button", checked, outerStyle }: PressyProps) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.timing(s, { toValue: v, duration: 110, useNativeDriver: true }).start();
  const isBox = role === "checkbox";
  // Sul web Invio attiva già il tocco; per una casella anche la barra spaziatrice deve funzionare
  const webKeys =
    Platform.OS === "web" && isBox
      ? {
          onKeyDown: (e: any) => {
            const k = e?.nativeEvent?.key ?? e?.key;
            if ((k === " " || k === "Spacebar") && !disabled) {
              e.preventDefault?.();
              onPress && onPress();
            }
          },
        }
      : {};
  return (
    <Animated.View style={[{ transform: [{ scale: s }] }, outerStyle]}>
      <Pressable
        {...(webKeys as any)}
        accessibilityRole={isBox ? "checkbox" : "button"}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={isBox ? { disabled: !!disabled, checked: !!checked } : { disabled: !!disabled }}
        disabled={disabled}
        hitSlop={hitSlop}
        onPressIn={() => to(scaleTo)}
        onPressOut={() => to(1)}
        onPress={() => {
          if (haptic) tap();
          onPress && onPress();
        }}
        style={(st: any) => [
          style,
          st.hovered && !disabled ? hoverStyle || { opacity: 0.92 } : null,
          st.focused ? { outlineColor: colors.accent, outlineWidth: 2, outlineStyle: "solid" } as any : null,
          disabled ? { opacity: 0.45 } : null,
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

type ButtonProps = {
  label: string;
  sub?: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  accent?: string;
  ink?: string;
};

export function Button({ label, sub, onPress, variant = "primary", icon, iconRight, disabled, loading, style, compact, accent, ink }: ButtonProps) {
  const a = accent || colors.accent;
  const bg = variant === "primary" ? a : variant === "secondary" ? colors.elevated : variant === "danger" ? colors.dangerSoft : "transparent";
  const fg = variant === "primary" ? ink || colors.accentInk : variant === "outline" ? a : variant === "danger" ? colors.danger : colors.text;
  const border = variant === "outline" ? a : variant === "ghost" ? colors.border : "transparent";
  return (
    <Pressy
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        {
          minHeight: compact ? 44 : 56,
          borderRadius: radius.lg,
          backgroundColor: bg,
          borderWidth: variant === "outline" || variant === "ghost" ? 1.5 : 0,
          borderColor: border,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: compact ? 14 : 20,
          paddingVertical: sub ? 8 : 0,
        },
        variant === "primary" && !disabled ? shadow.glow : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={{ alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {icon ? <Ionicons name={icon} size={compact ? 17 : 19} color={fg} style={{ marginRight: 8 }} /> : null}
            <Text style={{ color: fg, fontSize: compact ? 15 : 17, fontWeight: "700" }} numberOfLines={1}>
              {label}
            </Text>
            {iconRight ? <Ionicons name={iconRight} size={compact ? 17 : 19} color={fg} style={{ marginLeft: 8 }} /> : null}
          </View>
          {sub ? <Text style={{ color: fg, opacity: 0.75, fontSize: 12.5, fontWeight: "600", marginTop: 1 }}>{sub}</Text> : null}
        </View>
      )}
    </Pressy>
  );
}

export function IconButton({ name, onPress, label, size = 44, color = colors.text, bg = "rgba(0,0,0,0.25)", border = colors.border }: { name: keyof typeof Ionicons.glyphMap; onPress?: () => void; label: string; size?: number; color?: string; bg?: string; border?: string }) {
  return (
    <Pressy
      onPress={onPress}
      accessibilityLabel={label}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, borderWidth: 1, borderColor: border, alignItems: "center", justifyContent: "center" }}
    >
      <Ionicons name={name} size={size * 0.45} color={color} />
    </Pressy>
  );
}
