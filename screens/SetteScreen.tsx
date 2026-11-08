import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FadeIn, Screen, TopBar } from "../components/Screen";
import { Button, IconButton, Pressy, tap } from "../components/Pressy";
import { LiveBadge } from "../components/LiveBadge";
import { Avatar } from "../components/Avatar";
import { GameMenu } from "../components/GameMenu";
import { usePlayerTools } from "../components/PlayerTools";
import { PlayingCard, Coin } from "../components/Tokens";
import { toast } from "../components/Toast";
import { useStore, useTable } from "../lib/store";
import { addPlayer, buyIn } from "../lib/engine";
import { endNight, passBanker, SetteResult, setteRound } from "../lib/rules";
import { balances } from "../lib/ledger";
import { fmtNum } from "../lib/format";
import { ScreenProps } from "../lib/nav";
import { colors, radius, type } from "../lib/theme";

type Outcome = SetteResult["outcome"];
const OUT: { key: Outcome; label: string }[] = [
  { key: "lose", label: "Perde" },
  { key: "win", label: "Vince" },
  { key: "real", label: "7½ reale" },
];

export default function SetteScreen({ navigation, route }: ScreenProps<"Sette">) {
  const table = useTable(route.params?.id);
  const apply = useStore((s) => s.apply);
  const [bets, setBets] = useState<Record<string, number>>({});
  const [outs, setOuts] = useState<Record<string, Outcome>>({});
  const [menu, setMenu] = useState(false);
  const insets = useSafeAreaInsets();
  const bal = useMemo(() => (table ? balances(table.entries) : {}), [table?.entries]);
  const tools = usePlayerTools(table, {
    addNote: "Entra con un buy-in. Lo gestisci tu dal tuo telefono.",
    onAddNoPhone: (name, color) => (table ? apply(table.id, (t) => addPlayer(t, name, color, { noPhone: true })).error || null : "Tavolo non trovato"),
  });

  if (!table || !table.sette) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <Screen>
          <TopBar title="Tavolo non trovato" onBack={() => navigation.goBack()} />
        </Screen>
      </View>
    );
  }

  const st = table.sette;
  const banker = table.players.find((p) => p.id === st.banker);
  const step = Math.min(...table.chips.map((c) => c.value), 10);
  const nm = (id: string) => table.players.find((p) => p.id === id)?.name || "?";
  const punters = table.players.filter((p) => p.id !== st.banker);
  const active = punters.filter((p) => (bets[p.id] || 0) > 0);
  const missing = active.filter((p) => !outs[p.id]);

  const run = (fn: Parameters<typeof apply>[1], ok?: string) => {
    const r = apply(table.id, fn);
    if (r.error) {
      tap("error");
      toast.error(r.error);
      return null;
    }
    if (ok || r.info) toast.ok(r.info || ok!);
    return r;
  };

  const close = () => {
    const results = active.map((p) => ({ pid: p.id, bet: bets[p.id], outcome: outs[p.id] }));
    if (run((t) => setteRound(t, results), "Mano chiusa")) {
      tap("success");
      setBets({});
      setOuts({});
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#2E1A1C", paddingTop: insets.top }}>
    <Screen
      scroll
      gradient={["#2E1A1C", colors.bg]}
      footer={<Button label={!active.length ? "Componi le puntate" : missing.length ? "Segna chi vince e chi perde" : "Chiudi la mano"} disabled={!active.length || missing.length > 0} onPress={close} />}
    >
      <TopBar title={table.name} subtitle={"Mano " + st.round + " · il banco è di " + nm(st.banker)} status={<LiveBadge table={table} />} onBack={() => navigation.navigate("Home")} right={<IconButton name="menu" label="Menu del tavolo" onPress={() => setMenu(true)} />} />

      <FadeIn>
        <View style={{ backgroundColor: "#3A2124", borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#55302F" }}>
          <Avatar player={banker} size={46} ring={colors.accent} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[type.label, { color: "rgba(244,238,227,0.7)" }]}>Il banco</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap" }}>
              <Text style={[type.heading, { color: colors.text, fontSize: 18, marginRight: 8 }]} numberOfLines={1}>
                {nm(st.banker)}
              </Text>
              <Text style={[type.number, { color: colors.accent, fontSize: 22, lineHeight: 26 }]}>{fmtNum(bal[st.banker] || 0)}</Text>
            </View>
          </View>
          <View style={{ alignItems: "center", flexDirection: "row" }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginRight: 10 }}>
              <Coin size={22} metal="gold" />
              <View style={{ marginLeft: 4 }}>
                <PlayingCard width={17} rotate={8} />
              </View>
            </View>
            <Pressy onPress={() => apply(table.id, (t) => passBanker(t))} accessibilityLabel="Passa il banco al prossimo giocatore" style={{ flexDirection: "row", alignItems: "center", borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.accent, paddingHorizontal: 12, minHeight: 40 }}>
              <Ionicons name="repeat" size={15} color={colors.accent} />
              <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 13, marginLeft: 4 }}>Passa</Text>
            </Pressy>
          </View>
        </View>
      </FadeIn>

      <Text style={[type.section, { color: colors.text, marginTop: 14, marginBottom: 8 }]}>Puntate contro il banco</Text>
      {punters.map((p) => {
        const b = bets[p.id] || 0;
        const stack = bal[p.id] || 0;
        return (
          <View key={p.id} style={{ backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: b ? colors.accent : colors.border, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Avatar player={p} size={34} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[type.bodyStrong, { color: colors.text, lineHeight: 19 }]} numberOfLines={1}>
                  {nm(p.id)}
                </Text>
                <Text style={[type.caption, { color: colors.muted, fontWeight: "400", fontSize: 12, lineHeight: 15 }]} numberOfLines={1}>
                  {fmtNum(stack) + " fiches"}
                </Text>
              </View>
              <IconButton name="remove" label={"Meno " + step + " a " + nm(p.id)} size={40} onPress={() => setBets((x) => ({ ...x, [p.id]: Math.max(0, b - step) }))} />
              <Text style={[type.number, { color: b ? colors.accent : colors.faint, fontSize: 21, minWidth: 60, textAlign: "center" }]}>{fmtNum(b)}</Text>
              <IconButton name="add" label={"Più " + step + " a " + nm(p.id)} size={40} onPress={() => setBets((x) => ({ ...x, [p.id]: Math.min(stack, b + step) }))} />
            </View>
            {b > 0 ? (
              <View style={{ flexDirection: "row", marginTop: 7, marginBottom: 1, backgroundColor: colors.bg, borderRadius: radius.sm, padding: 3 }}>
                {OUT.map((o) => {
                  const on = outs[p.id] === o.key;
                  const tint = o.key === "lose" ? colors.danger : colors.success;
                  return (
                    <Pressy key={o.key} onPress={() => setOuts((x) => ({ ...x, [p.id]: o.key }))} accessibilityLabel={nm(p.id) + ": " + o.label} outerStyle={{ flex: 1 }} style={{ flex: 1 }}>
                      <View style={{ minHeight: 38, borderRadius: radius.sm - 2, alignItems: "center", justifyContent: "center", backgroundColor: on ? (o.key === "lose" ? colors.dangerSoft : colors.successSoft) : "transparent" }}>
                        <Text style={{ color: on ? tint : colors.muted, fontWeight: "700", fontSize: 14 }}>{o.label}</Text>
                      </View>
                    </Pressy>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}
      <Text style={[type.caption, { color: colors.faint, marginTop: 2, fontWeight: "400", fontSize: 12.5, lineHeight: 17 }]}>Chi fa sette e mezzo reale prende il doppio e diventa il banco. Il banco vince i pari.</Text>

      <GameMenu
        visible={menu}
        onClose={() => setMenu(false)}
        table={table}
        balances={bal}
        onRebuy={(pid) => run((t) => buyIn(t, pid), "Ricarica di " + fmtNum(table.buyinUnits))}
        onAddPlayer={() => {
          setMenu(false);
          tools.openInvite();
        }}
        onRename={(p) => {
          setMenu(false);
          tools.openRename(p);
        }}
        canRename={tools.canRename}
        onRegistro={() => {
          setMenu(false);
          navigation.navigate("Registro", { id: table.id });
        }}
        onEnd={() => {
          if (run((t) => endNight(t))) {
            setMenu(false);
            navigation.navigate("Settlement", { id: table.id });
          }
        }}
      />
      {tools.sheets}
    </Screen>
    </View>
  );
}
