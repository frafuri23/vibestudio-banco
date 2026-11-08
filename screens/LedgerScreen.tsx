import React, { useEffect, useMemo, useState } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FadeIn, Screen, TopBar } from "../components/Screen";
import { Button, IconButton, Pressy } from "../components/Pressy";
import { LiveBadge } from "../components/LiveBadge";
import { Avatar } from "../components/Avatar";
import { ChipComposer } from "../components/ChipComposer";
import { GameMenu } from "../components/GameMenu";
import { usePlayerTools } from "../components/PlayerTools";
import { RecentMoves, accName } from "../components/RecentMoves";
import { Chip } from "../components/Tokens";
import { useStore, useTable } from "../lib/store";
import { useMove } from "../lib/useMove";
import { addPlayer, append, buyIn, undoEntry } from "../lib/engine";
import { endNight } from "../lib/rules";
import { balances, POT } from "../lib/ledger";
import { gameOf } from "../lib/games";
import { fmtNum } from "../lib/format";
import { ScreenProps } from "../lib/nav";
import { colors, radius, shadow, type } from "../lib/theme";

export default function LedgerScreen({ navigation, route }: ScreenProps<"Ledger">) {
  const table = useTable(route.params?.id);
  const apply = useStore((s) => s.apply);
  const doMove = useMove(route.params?.id);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string>(POT);
  const [amount, setAmount] = useState(0);
  const [menu, setMenu] = useState(false);
  const insets = useSafeAreaInsets();
  const bal = useMemo(() => (table ? balances(table.entries) : {}), [table?.entries]);
  const tools = usePlayerTools(table, {
    addNote: "Entra con un buy-in. Lo gestisci tu dal tuo telefono.",
    onAddNoPhone: (name, color) => (table ? apply(table.id, (t) => addPlayer(t, name, color, { noPhone: true })).error || null : "Tavolo non trovato"),
  });

  useEffect(() => {
    if (table && !from) setFrom(table.me);
  }, [table?.id]);
  useEffect(() => {
    setAmount(0);
    setTo((cur) => (cur === from ? POT : cur));
  }, [from]);

  if (!table) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <Screen>
          <TopBar title="Tavolo non trovato" onBack={() => navigation.goBack()} />
        </Screen>
      </View>
    );
  }

  const g = gameOf(table.kind);
  const src = from || table.me;
  const pot = bal[POT] || 0;
  // Strisce che scorrono di lato: arrivano fino al bordo dello schermo, non al margine della colonna
  const strip = { style: { marginHorizontal: -20 }, contentContainerStyle: { paddingHorizontal: 16 }, showsHorizontalScrollIndicator: Platform.OS === "web" };

  const run = (fn: Parameters<typeof apply>[1], ok?: string, undo?: boolean) => doMove(fn, ok, { undo });

  const move = () => {
    if (run((t) => append(t, { from: src, to: to === src ? POT : to, amount, kind: to === POT ? "bet" : "pay", note: to === POT ? "Nel piatto" : "Trasferimento" }), fmtNum(amount) + " da " + accName(table, src) + " a " + accName(table, to), true)) setAmount(0);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#1E1B2A", paddingTop: insets.top }}>
    <Screen
      scroll
      gradient={["#1E1B2A", colors.bg]}
      footer={<Button label={amount ? "Sposta " + fmtNum(amount) + " a " + accName(table, to) : "Tocca le fiches per l'importo"} disabled={!amount} onPress={move} />}
    >
      <TopBar title={table.name} subtitle={g.title + " · saldi e trasferimenti"} status={<LiveBadge table={table} />} onBack={() => navigation.navigate("Home")} right={<IconButton name="menu" label="Menu del tavolo" onPress={() => setMenu(true)} />} />

      <FadeIn>
        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: pot ? colors.accent : colors.border, flexDirection: "row", alignItems: "center" }, pot ? shadow.glow : null]}>
          <View style={{ flexDirection: "row" }}>
            {table.chips.slice(0, 3).map((c, i) => (
              <View key={i} style={{ marginLeft: i ? -11 : 0 }}>
                <Chip size={30} color={c.color} stripe={c.stripe} />
              </View>
            ))}
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[type.label, { color: colors.muted }]}>Piatto</Text>
            <Text style={[type.number, { color: colors.text, fontSize: 30, lineHeight: 34 }]}>{fmtNum(pot)}</Text>
          </View>
          {pot ? <Text style={[type.caption, { color: colors.accent, maxWidth: 110, textAlign: "right" }]}>Tocca chi lo vince qui sotto</Text> : null}
        </View>
        {pot ? (
          <ScrollView horizontal {...strip} style={[strip.style, { marginTop: 8 }]}>
            {table.players.map((p) => (
              <Pressy
                key={p.id}
                onPress={() => run((t) => append(t, { from: POT, to: p.id, amount: pot, kind: "win", note: "Vince il piatto" }), accName(table, p.id) + " prende il piatto", true)}
                accessibilityLabel={accName(table, p.id) + " vince il piatto"}
                style={{ flexDirection: "row", alignItems: "center", borderRadius: radius.pill, backgroundColor: colors.elevated, paddingLeft: 4, paddingRight: 12, height: 40, marginHorizontal: 4 }}
              >
                <Avatar player={p} size={32} />
                <Text style={{ color: colors.text, fontWeight: "600", marginLeft: 8 }}>{accName(table, p.id)}</Text>
              </Pressy>
            ))}
          </ScrollView>
        ) : null}
      </FadeIn>

      <Text style={[type.section, { color: colors.text, marginTop: 14, marginBottom: 8 }]}>Chi sposta le fiches?</Text>
      <ScrollView horizontal {...strip}>
        {table.players.map((p) => {
          const on = p.id === src;
          return (
            <Pressy
              key={p.id}
              onPress={() => setFrom(p.id)}
              accessibilityLabel={"Sposta le fiches di " + accName(table, p.id) + ", saldo " + fmtNum(bal[p.id] || 0)}
              outerStyle={{ marginHorizontal: 4 }}
              style={{ width: 78, borderRadius: radius.md, borderWidth: 2, borderColor: on ? colors.accent : colors.border, backgroundColor: on ? "#2A241C" : colors.surface, paddingVertical: 8, paddingHorizontal: 4, alignItems: "center" }}
            >
              <Avatar player={p} size={36} />
              <Text style={[type.caption, { color: colors.text, marginTop: 4, lineHeight: 16 }]} numberOfLines={1}>
                {accName(table, p.id)}
              </Text>
              <Text style={[type.number, { color: on ? colors.accent : colors.text, fontSize: 17, lineHeight: 21 }]} numberOfLines={1}>
                {fmtNum(bal[p.id] || 0)}
              </Text>
            </Pressy>
          );
        })}
      </ScrollView>

      {/* Verso chi: etichetta e scelte sulla stessa riga, che scorre di lato */}
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10, marginRight: -20 }}>
        <Text style={[type.caption, { color: colors.muted }]}>Verso</Text>
        <Ionicons name="arrow-forward" size={14} color={colors.muted} style={{ marginLeft: 4, marginRight: 4 }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === "web"} style={{ flex: 1 }} contentContainerStyle={{ paddingLeft: 4, paddingRight: 16 }}>
          {[POT, ...table.players.filter((p) => p.id !== src).map((p) => p.id)].map((id) => {
            const on = id === to;
            return (
              <Pressy key={id} onPress={() => setTo(id)} accessibilityLabel={"Verso " + accName(table, id)} style={{ height: 40, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accentSoft : "transparent", marginRight: 8, justifyContent: "center" }}>
                <Text style={{ color: on ? colors.accent : colors.text, fontWeight: "600" }}>{accName(table, id)}</Text>
              </Pressy>
            );
          })}
        </ScrollView>
      </View>

      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 12, marginTop: 10, borderWidth: 1, borderColor: colors.border }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
          <Text style={[type.caption, { color: colors.muted }]}>{"Importo · max " + fmtNum(bal[src] || 0)}</Text>
          <Text style={[type.number, { color: colors.accent, fontSize: 28, lineHeight: 32 }]}>{fmtNum(amount)}</Text>
        </View>
        <ChipComposer chips={table.chips} value={amount} onChange={setAmount} max={bal[src] || 0} size={50} />
      </View>

      <RecentMoves dark table={table} perspective={src} limit={1} onUndo={(id) => run((t) => undoEntry(t, id), "Movimento annullato")} onAll={() => navigation.navigate("Registro", { id: table.id })} />

      <GameMenu
        visible={menu}
        onClose={() => setMenu(false)}
        table={table}
        balances={bal}
        onRebuy={(pid) => run((t) => buyIn(t, pid), "Ricarica di " + fmtNum(table.buyinUnits), true)}
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
