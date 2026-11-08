import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState, FadeIn, Screen, TopBar } from "../components/Screen";
import { Button, Pressy, tap } from "../components/Pressy";
import { Avatar } from "../components/Avatar";
import { toast } from "../components/Toast";
import { NameSheet } from "../components/NameSheet";
import { useStore } from "../lib/store";
import { publish } from "../lib/live";
import { addPlayer, createTable } from "../lib/engine";
import { defaultConfig, optsFor } from "../lib/presets";
import { Evening, eveningOf, Group, groupsOf } from "../lib/history";
import { gameOf } from "../lib/games";
import { fmtEuro, timeAgo } from "../lib/format";
import { ScreenProps } from "../lib/nav";
import { GameKind, Player } from "../lib/types";
import { colors, radius, space, type } from "../lib/theme";

const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const ICONS: Record<GameKind, keyof typeof Ionicons.glyphMap> = {
  poker: "layers-outline",
  tombola: "grid-outline",
  bank: "cash-outline",
  sette: "copy-outline",
  free: "swap-horizontal",
  custom: "color-palette-outline",
};

const dateOf = (ts: number) => {
  const d = new Date(ts);
  return d.getDate() + " " + MONTHS[d.getMonth()];
};
const fake = (name: string, color: string): Player => ({ id: name, name, color, status: "ready" });
const tone = (c: number) => (c > 0 ? colors.success : c < 0 ? colors.danger : colors.muted);

export default function StoricoScreen({ navigation }: ScreenProps<"Storico">) {
  const past = useStore((s) => s.past);
  const tables = useStore((s) => s.tables);
  const add = useStore((s) => s.add);
  const myName = useStore((s) => s.myName);
  const setMyName = useStore((s) => s.setMyName);
  const [open, setOpen] = useState<string | null>(null);
  // Gruppo per cui creare un tavolo appena scegli il tuo nome
  const [askFor, setAskFor] = useState<Group | null>(null);
  const shownName = (p: { name: string; me?: boolean }) => (p.me && myName ? myName : p.name);
  const insets = useSafeAreaInsets();

  const evenings = useMemo(() => {
    const fromTables = Object.values(tables)
      .map((t) => eveningOf(t))
      .filter((e): e is Evening => !!e);
    const ids = new Set(fromTables.map((e) => e.id));
    return [...fromTables, ...past.filter((e) => !ids.has(e.id))].sort((a, b) => b.date - a.date);
  }, [past, tables]);
  const groups = useMemo(() => groupsOf(evenings), [evenings]);
  const myOf = (e: Evening) => e.players.find((p) => p.me)?.cents || 0;
  const total = evenings.reduce((s, e) => s + myOf(e), 0);
  const won = evenings.filter((e) => myOf(e) > 0).length;

  const playAgain = (g: Group, hostName = myName) => {
    if (!hostName) return setAskFor(g);
    try {
      let t = createTable({ ...optsFor(g.kind, defaultConfig(g.kind)), name: g.name, hostName });
      for (const m of g.totals) {
        if (m.me) continue;
        const r = addPlayer(t, m.name, m.color, { status: "joining" });
        if (!r.error) t = r.table;
      }
      add(t);
      tap("success");
      navigation.navigate("Lobby", { id: t.id });
      publish(t.id).catch(() => {});
    } catch (e: any) {
      toast.error(e?.message || "Non sono riuscito a creare il tavolo");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#1B2A23", paddingTop: insets.top }}>
    <Screen scroll gradient={["#1B2A23", colors.bg]}>
      <TopBar title="Storico" subtitle={evenings.length + " serate \u00B7 " + groups.length + (groups.length === 1 ? " gruppo" : " gruppi")} onBack={() => navigation.goBack()} />

      <FadeIn>
        <LinearGradient colors={["#24503F", "#1A3A2E"]} style={{ borderRadius: radius.xl, padding: 20, borderWidth: 1, borderColor: "#2D5F4C" }}>
          <Text style={[type.label, { color: "rgba(244,238,227,0.72)" }]}>Il tuo bilancio</Text>
          <Text style={[type.number, { color: total < 0 ? "#F2B7A6" : colors.text, fontSize: 46, lineHeight: 52, marginTop: 6 }]}>{fmtEuro(total, true)}</Text>
          <Text style={[type.caption, { color: "rgba(244,238,227,0.72)", fontWeight: "400" }]}>somma di tutte le serate, in euro</Text>
          <View style={{ flexDirection: "row", marginTop: 18, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.12)", paddingTop: 14 }}>
            {[
              { k: "Serate", v: String(evenings.length) },
              { k: "In attivo", v: String(won) },
              { k: "Gruppi", v: String(groups.length) },
            ].map((s) => (
              <View key={s.k} style={{ flex: 1 }}>
                <Text style={[type.number, { color: colors.text, fontSize: 24 }]}>{s.v}</Text>
                <Text style={[type.caption, { color: "rgba(244,238,227,0.72)" }]}>{s.k}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>
      </FadeIn>

      {evenings.length === 0 ? (
        <EmptyState icon="time-outline" title="Ancora nessuna serata" body="Quando chiudi un tavolo, qui trovi i conti e i gruppi con cui giochi più spesso." />
      ) : null}

      {groups.length ? <Text style={[type.section, { color: colors.text, marginTop: space.xl, marginBottom: 10 }]}>I tuoi gruppi</Text> : null}
      {groups.map((g, gi) => (
        <FadeIn key={g.key} delay={60 + gi * 40} style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={ICONS[g.kind] || "people-outline"} size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[type.heading, { color: colors.text }]} numberOfLines={1}>
                {g.name}
              </Text>
              <Text style={[type.caption, { color: colors.muted }]} numberOfLines={1}>
                {g.evenings.length + (g.evenings.length === 1 ? " serata" : " serate") + " \u00B7 " + gameOf(g.kind).title + " \u00B7 ultima " + timeAgo(g.last)}
              </Text>
            </View>
          </View>
          <View style={{ marginTop: 12 }}>
            {g.totals.map((m, i) => (
              <View key={m.name + i} style={{ flexDirection: "row", alignItems: "center", minHeight: 44, borderTopWidth: i ? 1 : 0, borderTopColor: colors.hairline }}>
                <Text style={[type.caption, { color: i === 0 ? colors.accent : colors.faint, width: 20, fontWeight: "800" }]}>{i + 1}</Text>
                <Avatar player={fake(shownName(m), m.color)} size={28} />
                <Text style={[type.bodyStrong, { color: colors.text, marginLeft: 10, flex: 1 }]} numberOfLines={1}>
                  {shownName(m)}
                </Text>
                {m.wins ? <Text style={[type.caption, { color: colors.muted, marginRight: 10 }]}>{m.wins + (m.wins === 1 ? " vittoria" : " vittorie")}</Text> : null}
                <Text style={[type.bodyStrong, { color: tone(m.cents), minWidth: 76, textAlign: "right", fontVariant: ["tabular-nums"] }]}>{fmtEuro(m.cents, true)}</Text>
              </View>
            ))}
          </View>
          <View style={{ marginTop: 10 }}>
            <Button label="Nuovo tavolo con loro" icon="add" variant="outline" compact onPress={() => playAgain(g)} />
          </View>
        </FadeIn>
      ))}

      {evenings.length ? <Text style={[type.section, { color: colors.text, marginTop: space.lg, marginBottom: 10 }]}>Serate</Text> : null}
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 }}>
        {evenings.map((e, i) => {
          const mine = myOf(e);
          const expanded = open === e.id;
          const real = e.tableId && tables[e.tableId];
          return (
            <View key={e.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: colors.hairline }}>
              <Pressy
                onPress={() => (real ? navigation.navigate("Settlement", { id: e.tableId! }) : setOpen(expanded ? null : e.id))}
                accessibilityLabel={"Serata " + e.name + " del " + dateOf(e.date)}
                style={{ flexDirection: "row", alignItems: "center", minHeight: 60 }}
              >
                <Ionicons name={ICONS[e.kind] || "time-outline"} size={18} color={colors.muted} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[type.bodyStrong, { color: colors.text }]} numberOfLines={1}>
                    {e.name}
                  </Text>
                  <Text style={[type.caption, { color: colors.muted }]}>{dateOf(e.date) + " \u00B7 " + e.players.length + " giocatori"}</Text>
                </View>
                <Text style={[type.bodyStrong, { color: tone(mine), marginRight: 8, fontVariant: ["tabular-nums"] }]}>{fmtEuro(mine, true)}</Text>
                <Ionicons name={real ? "chevron-forward" : expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.faint} />
              </Pressy>
              {expanded ? (
                <View style={{ paddingBottom: 12, paddingLeft: 30 }}>
                  {[...e.players]
                    .sort((a, b) => b.cents - a.cents)
                    .map((p) => (
                      <View key={p.name} style={{ flexDirection: "row", alignItems: "center", minHeight: 30 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.color, marginRight: 10 }} />
                        <Text style={[type.caption, { color: colors.text, flex: 1 }]}>{shownName(p)}</Text>
                        <Text style={[type.caption, { color: tone(p.cents), fontVariant: ["tabular-nums"] }]}>{fmtEuro(p.cents, true)}</Text>
                      </View>
                    ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <NameSheet
        visible={!!askFor}
        onClose={() => setAskFor(null)}
        title="Come ti chiamano al tavolo?"
        subtitle="Lo vedono tutti quando entrano. Lo puoi cambiare quando vuoi."
        saveLabel="Crea il tavolo"
        onSave={(name) => {
          const r = setMyName(name);
          if (r.error) return r.error;
          const g = askFor;
          setAskFor(null);
          if (g) playAgain(g, useStore.getState().myName);
          return null;
        }}
      />
    </Screen>
    </View>
  );
}
