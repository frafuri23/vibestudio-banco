import React, { useEffect, useMemo, useState } from "react";
import { LayoutChangeEvent, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { IconButton, Pressy, tap } from "../components/Pressy";
import { PokerTable } from "../components/PokerTable";
import { PokerPanel, panelHeight } from "../components/PokerPanel";
import { fitTableWidth, minTableWidth, tableHeight } from "../lib/pokerLayout";
import { PokerMenu } from "../components/PokerMenu";
import { usePlayerTools } from "../components/PlayerTools";
import { RulesSheet } from "../components/RulesSheet";
import { applyBlinds, blindsRow, configOf } from "../lib/presets";
import { LiveBadge } from "../components/LiveBadge";
import { toast } from "../components/Toast";
import { useStore, useTable } from "../lib/store";
import { addPlayer, buyIn, names, pokerAct, pokerAward, pokerUndo, startHand, togglePause } from "../lib/engine";
import { endNight } from "../lib/rules";
import { blindClock, replay, STREETS } from "../lib/poker";
import { balances, POT } from "../lib/ledger";
import { fmtNum, mmss } from "../lib/format";
import { ScreenProps } from "../lib/nav";
import { colors, MAX_W, pokerSkins, radius, type } from "../lib/theme";
import { useChrome } from "../lib/chrome";
import { PokerActionType } from "../lib/types";

const STREET_IT = ["preflop", "flop", "turn", "river", "showdown"];

export default function PokerScreen({ navigation, route }: ScreenProps<"Poker">) {
  const id = route.params?.id;
  const table = useTable(id);
  const apply = useStore((s) => s.apply);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [, setTick] = useState(0);
  const [menu, setMenu] = useState(false);
  const [blinds, setBlinds] = useState(false);
  // Misure reali (0 = non ancora misurate): altezza visibile, intestazione e pannello delle puntate
  const [vpH, setVpH] = useState(0);
  const [headH, setHeadH] = useState(0);
  const [panelH, setPanelH] = useState(0);
  const nPlayers = table?.players.length || 0;
  const capW = Math.min(width - 24, MAX_W - 40, 440);
  // Pannello più stretto sui telefoni bassi (iPhone 13/14/15, SE, finestre basse sul web) e quando,
  // con il pannello normale, nemmeno il tavolo più piccolo ci starebbe (tanti giocatori)
  const normalFree = height - insets.top - 106 - panelHeight(false, insets.bottom) - 16;
  const compact = height - insets.top - insets.bottom < 800 || tableHeight(minTableWidth(capW, nPlayers), nPlayers) > normalFree;

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  // Il pannello si misura come il più alto visto finora: se cambia modalità o larghezza si riparte
  useEffect(() => setPanelH(0), [compact, width]);

  const measure = (set: React.Dispatch<React.SetStateAction<number>>, keepMax?: boolean) => (e: LayoutChangeEvent) => {
    const h = Math.round(e?.nativeEvent?.layout?.height || 0);
    if (!h) return;
    set((cur) => (keepMax ? Math.max(cur, h) : Math.abs(cur - h) > 1 ? h : cur));
  };

  const hand = table?.poker?.hand || null;
  const nm = useMemo(() => (table ? names(table) : {}), [table?.players]);
  const view = useMemo(() => (hand ? replay(hand, nm) : null), [hand, nm]);
  const bal = useMemo(() => (table ? balances(table.entries) : {}), [table?.entries]);
  useChrome(table?.poker ? pokerSkins[table.poker.skin]?.bgTop || colors.bg : colors.bg);
  const tools = usePlayerTools(table, {
    addNote: "Entra con un buy-in e gioca dalla prossima mano.",
    onAddNoPhone: (name, color) => {
      if (!table) return "Tavolo non trovato";
      const r = apply(table.id, (t) => addPlayer(t, name, color, { noPhone: true }));
      if (!r.error) toast.ok(name.trim() + " si siede con " + fmtNum(table.buyinUnits));
      return r.error || null;
    },
  });

  if (!table || !table.poker) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 20, alignItems: "center" }}>
        <Text style={[type.heading, { color: colors.text }]}>Tavolo non trovato</Text>
        <Pressy onPress={() => navigation.navigate("Home")} style={{ marginTop: 12, padding: 12 }}>
          <Text style={{ color: colors.accent, fontWeight: "700" }}>Torna alla home</Text>
        </Pressy>
      </View>
    );
  }

  const ps = table.poker;
  const skin = pokerSkins[ps.skin];
  const clock = blindClock(ps);
  const actor = view?.toAct ? table.players.find((p) => p.id === view.toAct) : undefined;
  // Il tavolo prende lo spazio che resta fra intestazione e pannello: così tavolo e pulsanti stanno
  // in una pagina. Se nemmeno alla larghezza minima ci sta (iPhone SE con 7 o più giocatori) il tavolo
  // si rimpicciolisce tutto insieme, scritte comprese, invece di far scorrere la schermata.
  const areaPad = compact ? 8 : 16;
  const freeH = (vpH || height - insets.top) - (headH || 54 + (compact ? 48 : 52)) - Math.max(panelHeight(compact, insets.bottom), panelH) - areaPad;
  const tableW = fitTableWidth(capW, freeH, nPlayers);
  const tableH = tableHeight(tableW, nPlayers);
  const tableScale = Math.max(0.55, Math.min(1, freeH / tableH));

  const run = (fn: Parameters<typeof apply>[1], ok?: () => void) => {
    const r = apply(table.id, fn);
    if (r.error) {
      tap("error");
      toast.error(r.error);
      return false;
    }
    ok && ok();
    return true;
  };

  const act = (t: PokerActionType, amount = 0) => run((x) => pokerAct(x, t, amount), () => tap(t === "fold" ? "light" : "medium"));

  const status = (() => {
    if (!view) return "In attesa della prossima mano";
    if (view.winnerByFold) return "Mano chiusa: tutti hanno passato";
    if (view.street >= 4) return "Showdown: scoprite le carte";
    const who = actor ? (actor.id === table.me ? "tocca a te" : "tocca a " + actor.name) : "";
    return [...view.feed, who].filter(Boolean).join(" · ");
  })();

  const canUndo = !!hand && hand.actions.some((a) => a.type !== "post");
  const toCall = view && actor ? Math.max(0, view.currentBet - (view.committed[actor.id] || 0)) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: skin.bgTop, paddingTop: insets.top }}>
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient colors={[skin.bgTop, colors.bg]} style={{ position: "absolute", left: 0, right: 0, top: 0, height: 360 }} />
      <ScrollView onLayout={measure(setVpH)} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={{ width: "100%", maxWidth: MAX_W, alignSelf: "center", paddingHorizontal: 20, flex: 1 }}>
          <View onLayout={measure(setHeadH)}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 10 }}>
            <IconButton name="chevron-back" label="Indietro" onPress={() => navigation.navigate("Home")} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[type.title, { color: colors.text, fontSize: 19, lineHeight: 21 }]} numberOfLines={1}>
                {table.name}
              </Text>
              <Text style={[type.caption, { color: colors.muted }]} numberOfLines={1}>
                {"Mano " + (hand?.number || ps.handsPlayed) + " · " + (view ? STREET_IT[view.street] : "pausa") + " · livello " + (clock.level + 1)}
              </Text>
            </View>
            <Pressy
              onPress={() => apply(table.id, (t) => togglePause(t))}
              accessibilityLabel="Pausa o riprendi il timer dei bui"
              style={{ flexDirection: "row", alignItems: "center", height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, backgroundColor: "rgba(0,0,0,0.25)", marginRight: 8 }}
            >
              <Ionicons name={clock.paused ? "pause" : "time-outline"} size={16} color={colors.muted} />
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15, marginLeft: 6 }}>{clock.sb + "/" + clock.bb}</Text>
              <View style={{ width: 1, height: 16, backgroundColor: colors.border, marginHorizontal: 8 }} />
              <Text style={{ color: colors.accent, fontWeight: "800", fontSize: 15, fontVariant: ["tabular-nums"] }}>{mmss(clock.remaining)}</Text>
            </Pressy>
            <IconButton name="menu" label="Menu del tavolo" onPress={() => setMenu(true)} />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: radius.pill, paddingLeft: 8, paddingRight: 6, minHeight: 40, marginTop: compact ? 8 : 12 }}>
            <View style={{ marginRight: 6 }}>
              <LiveBadge table={table} dotOnly />
            </View>
            <Text style={[type.caption, { color: colors.text, flex: 1, fontWeight: "500" }]} numberOfLines={1}>
              {status}
            </Text>
            {canUndo ? (
              <Pressy onPress={() => run((t) => pokerUndo(t), () => toast.info("Ultima mossa annullata"))} accessibilityLabel="Annulla l'ultima mossa" style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 10, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.08)" }}>
                <Ionicons name="arrow-undo" size={14} color={colors.accent} />
                <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 12.5, marginLeft: 4 }}>Annulla</Text>
              </Pressy>
            ) : null}
          </View>
          </View>

          <View style={{ flex: 1, justifyContent: "center", paddingVertical: areaPad / 2 }}>
            {/* Riquadro già della misura finale; dentro, il tavolo intero scalato attorno al centro */}
            <View style={{ width: tableW * tableScale, height: tableH * tableScale, alignSelf: "center" }}>
              <View
                style={{
                  width: tableW,
                  height: tableH,
                  marginLeft: -(tableW * (1 - tableScale)) / 2,
                  marginTop: -(tableH * (1 - tableScale)) / 2,
                  transform: [{ scale: tableScale }],
                }}
              >
                <PokerTable
                  width={tableW}
                  players={table.players}
                  seats={hand?.seats || []}
                  me={table.me}
                  view={view}
                  dealer={hand?.dealer}
                  stacks={bal}
                  skin={ps.skin}
                  toCallLabel={toCall > 0 ? "Da chiamare: " + fmtNum(toCall) : undefined}
                />
              </View>
            </View>
          </View>
        </View>
        <View onLayout={measure(setPanelH, true)} style={{ width: "100%", maxWidth: MAX_W, alignSelf: "center" }}>
          <PokerPanel
            table={table}
            view={view}
            actor={actor}
            compact={compact}
            bottomInset={insets.bottom}
            onAct={act}
            onFoldWin={() => view?.winnerByFold && run((t) => pokerAward(t, { [view.winnerByFold!]: bal[POT] || 0 }), () => tap("success"))}
            onShowdown={() => navigation.navigate("Showdown", { id: table.id })}
            onNewHand={() => run((t) => startHand(t))}
          />
        </View>
      </ScrollView>

      <PokerMenu
        visible={menu}
        onClose={() => setMenu(false)}
        table={table}
        balances={bal}
        onSkin={(s) => apply(table.id, (t) => ({ ...t, poker: { ...t.poker!, skin: s } }))}
        onPause={() => {
          apply(table.id, (t) => togglePause(t));
          setMenu(false);
        }}
        onBlinds={() => {
          setMenu(false);
          setBlinds(true);
        }}
        onRebuy={(pid) => run((t) => buyIn(t, pid), () => toast.ok("Ricarica di " + fmtNum(table.buyinUnits) + " fiches"))}
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
          const ok = run((t) => endNight(t));
          if (ok) {
            setMenu(false);
            navigation.navigate("Settlement", { id: table.id });
          }
        }}
      />
      <RulesSheet
        row={blinds ? blindsRow(configOf(table), true) : null}
        cfg={configOf(table)}
        note="I nuovi bui valgono dalla prossima mano."
        onClose={() => setBlinds(false)}
        onSave={(c) => {
          const r = apply(table.id, (t) => applyBlinds(t, c));
          if (r.error) return r.error;
          toast.ok("Bui aggiornati: " + fmtNum(c.sb) + "/" + fmtNum(c.bb) + ", livelli di " + c.levelMin + " min");
          return null;
        }}
      />
      {tools.sheets}
    </View>
    </View>
  );
}
