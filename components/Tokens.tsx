import React from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Defs, G, LinearGradient, Rect, Stop } from "react-native-svg";
import { fmtNum } from "../lib/format";

type ChipProps = { size: number; color: string; stripe: string; value?: number; textColor?: string; dim?: boolean };

export function Chip({ size, color, stripe, value, textColor, dim }: ChipProps) {
  const label = value !== undefined ? (value >= 10000 ? Math.round(value / 1000) + "k" : fmtNum(value)) : "";
  const fs = label.length >= 5 ? size * 0.2 : label.length >= 4 ? size * 0.23 : size * 0.28;
  return (
    <View style={{ width: size, height: size, opacity: dim ? 0.4 : 1 }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx={50} cy={50} r={48} fill={color} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <G key={i} transform={`rotate(${i * 60} 50 50)`}>
            <Rect x={45} y={2} width={10} height={15} rx={1.5} fill={stripe} />
          </G>
        ))}
        <Circle cx={50} cy={50} r={33} fill="none" stroke={stripe} strokeWidth={2.5} strokeDasharray="7 6" opacity={0.85} />
        <Circle cx={50} cy={50} r={28} fill={color} />
        <Circle cx={50} cy={50} r={48} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth={2} />
      </Svg>
      {label ? (
        <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: textColor || "#FFFFFF", fontWeight: "800", fontSize: fs, letterSpacing: -0.5 }} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const COIN = {
  gold: ["#F3D88A", "#C99A35"],
  silver: ["#F1F2F4", "#A4A9B0"],
  copper: ["#E3A07A", "#A35A36"],
};

export function Coin({ size, metal, inner }: { size: number; metal: keyof typeof COIN; inner?: keyof typeof COIN }) {
  const [a, b] = COIN[metal];
  const [c, d] = COIN[inner || metal];
  const id = "coin-" + metal + "-" + (inner || metal);
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={id + "o"} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={a} />
          <Stop offset="1" stopColor={b} />
        </LinearGradient>
        <LinearGradient id={id + "i"} x1="1" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={c} />
          <Stop offset="1" stopColor={d} />
        </LinearGradient>
      </Defs>
      <Circle cx={50} cy={52} r={47} fill="rgba(0,0,0,0.25)" />
      <Circle cx={50} cy={50} r={47} fill={`url(#${id}o)`} />
      <Circle cx={50} cy={50} r={33} fill={`url(#${id}i)`} />
      <Circle cx={50} cy={50} r={33} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={2} />
    </Svg>
  );
}

export function Bill({ width, color, value, rotate = 0 }: { width: number; color: string; value?: number; rotate?: number }) {
  const h = width * 0.56;
  return (
    <View style={{ width, height: h, transform: [{ rotate: rotate + "deg" }] }}>
      <Svg width={width} height={h} viewBox="0 0 100 56">
        <Rect x={1} y={1} width={98} height={54} rx={5} fill={color} stroke="rgba(0,0,0,0.12)" strokeWidth={1} />
        <Rect x={6} y={6} width={88} height={44} rx={3} fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth={1} />
        <Circle cx={72} cy={28} r={13} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={1.6} />
      </Svg>
      {value !== undefined ? (
        <View style={{ position: "absolute", left: 0.59 * width, width: 0.26 * width, top: 0, height: h, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: width * 0.12, fontWeight: "800", color: "#3A3024" }}>{value}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function PlayingCard({ width, rotate = 0 }: { width: number; rotate?: number }) {
  const h = width * 1.4;
  return (
    <View style={{ width, height: h, transform: [{ rotate: rotate + "deg" }] }}>
      <Svg width={width} height={h} viewBox="0 0 50 70">
        <Rect x={1} y={1} width={48} height={68} rx={6} fill="#C2463A" />
        <Rect x={5} y={5} width={40} height={60} rx={4} fill="#FBF6EE" />
        <Circle cx={25} cy={35} r={6} fill="#C2463A" />
      </Svg>
    </View>
  );
}

export function RingChip({ size, color, dashed }: { size: number; color: string; dashed?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {dashed ? (
        <>
          <Circle cx={50} cy={50} r={44} fill="none" stroke={color} strokeWidth={7} strokeDasharray="14 12" />
          <Circle cx={50} cy={50} r={13} fill={color} />
        </>
      ) : (
        <>
          <Circle cx={50} cy={50} r={47} fill={color} />
          <Circle cx={50} cy={50} r={28} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={7} />
        </>
      )}
    </Svg>
  );
}
