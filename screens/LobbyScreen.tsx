import React, { useEffect, useRef, useState } from "react";
import { Platform, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FadeIn, Screen, TopBar } from "../components/Screen";
import { Button, IconButton, Pressy, tap } from "../components/Pressy";
import { Avatar } from "../components/Avatar";
import { Sheet } from "../components/Sheet";
import { RulesCard } from "../components/RulesCard";
import { CodeRow, InviteQR, OnlineRow } from "../components/InvitePanel";
import { usePlayerTools } from "../components/PlayerTools";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { toast } from "../components/Toast";
import { useStore, useTable } from "../lib/store";
import { addPlayer, removePlayer, startGame } from "../lib/engine";
import { applyConfig, configOf } from "../lib/presets";
import { gameOf } from "../lib/games";
import { fmtEuro, fmtNum } from "../lib/format";
import { tableSummary } from "../lib/tableInfo";
import { ScreenProps } from "../lib/nav";
import { Player } from "../lib/types";
import { colors, radius, type } from "../lib/theme";

export default function LobbyScreen({ navigation, route }: ScreenProps<"Lobby">) {
  const id = route.params?.id;
  const table = useTable(id);
  const apply = useStore((s) => s.apply);
  const [renameOpen, setRenameOpen] = useState(false);
  const [draft, setDraft] = useState("");
  // Giocatore che si sta per togliere: prima si chiede conferma
  const [toRemove, setToRemove] = useState<Player | null>(null);
  const leaving = useRef(false);
  const insets = useSafeAreaInsets();
  const tools = usePlayerTools(table, {
    onAddNoPhone: (name, color) => {
      if (!table) return "Tavolo non trovato";
      const r = apply(table.id, (t) => addPlayer(t, name, color, { noPhone: true }));
      if (!r.error) toast.ok(name.trim() + " è al tavolo");
      return r.error || null;
    },
  });

  // Chi guarda da un altro telefono passa al gioco appena l'host inizia
  useEffect(() => {
    if (!table || table.status === "lobby" || leaving.current) return;
    leaving.current = true;
    navigation.replace(gameOf(table.kind).route, { id: table.id });
  }, [table?.status]);

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
  const unitInfo = table.kind === "tombola" ? "cartella " + fmtEuro(table.tombola?.priceCents || 100) : table.kind === "bank" ? "saldo iniziale " + fmtNum(table.bank?.startBalance || 0) : "buy-in " + fmtNum(table.buyinUnits) + " = " + fmtEuro(table.buyinCents).replace(",00", "");

  const start = () => {
    leaving.current = true;
    const r = apply(table.id, (t) => startGame(t));
    if (r.error) {
      leaving.current = false;
      return toast.error(r.error);
    }
    tap("success");
    navigation.replace(g.route, { id: table.id });
  };

  const alone = table.players.length < 2;

  const removeNow = () => {
    const p = toRemove;
    setToRemove(null);
    if (!p) return;
    const r = apply(table.id, (t) => removePlayer(t, p.id));
    if (r.error) {
      tap("error");
      return toast.error(r.error);
    }
    toast.ok(p.name + " non \u00E8 pi\u00F9 al tavolo");
  };

  const removeLines = (p: Player): string[] => [
    "Esce dal tavolo. La partita non \u00E8 ancora iniziata, quindi non perde niente.",
    p.noPhone
      ? "Puoi rimetterlo quando vuoi con \u00ABAggiungi chi non ha il telefono\u00BB."
      : "Se vuole tornare, rientra con il codice " + table.code + " e sceglie di nuovo nome e colore.",
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#1B2A23", paddingTop: insets.top }}>
    <Screen
      scroll
      gradient={["#1B2A23", colors.bg]}
      footer={
        <View>
          <Button label="Inizia la partita" iconRight="arrow-forward" onPress={start} disabled={alone} />
          {alone ? (
            <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 8 }}>
              <Ionicons name="information-circle-outline" size={15} color={colors.muted} />
              <Text style={[type.caption, { color: colors.muted, marginLeft: 6 }]}>Serve almeno un altro giocatore</Text>
            </View>
          ) : null}
        </View>
      }
    >
      <TopBar
        title={table.name}
        subtitle={tableSummary(table)}
        onBack={() => navigation.goBack()}
        right={
          <IconButton
            name="create-outline"
            label="Rinomina il tavolo"
            onPress={() => {
              setDraft(table.name);
              setRenameOpen(true);
            }}
          />
        }
      />

      <FadeIn style={{ marginTop: 4 }}>
        <InviteQR code={table.code} />
      </FadeIn>

      <View style={{ marginTop: 18 }}>
        <CodeRow table={table} />
      </View>

      <View style={{ marginTop: 10 }}>
        <OnlineRow table={table} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 24, marginBottom: 10 }}>
        <Text style={[type.section, { color: colors.text }]}>Al tavolo</Text>
        <Text style={[type.caption, { color: colors.muted }]}>{table.players.length + (table.players.length === 1 ? " giocatore · " : " giocatori · ") + unitInfo}</Text>
      </View>

      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16 }}>
        {table.players.map((p, i) => {
          const editable = tools.canRename(p.id);
          const isMe = p.id === table.me;
          const who = (
            <>
              <Avatar player={p} size={40} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={[type.heading, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>
                    {p.name}
                  </Text>
                  {editable ? <Ionicons name="create-outline" size={15} color={colors.faint} style={{ marginLeft: 6 }} /> : null}
                </View>
                {isMe ? <Text style={[type.caption, { color: colors.accent, fontSize: 12, lineHeight: 15 }]}>tu</Text> : null}
              </View>
            </>
          );
          return (
            <View key={p.id} style={{ flexDirection: "row", alignItems: "center", minHeight: 62, borderTopWidth: i ? 1 : 0, borderTopColor: colors.hairline }}>
              {editable ? (
                <Pressy
                  onPress={() => tools.openRename(p)}
                  accessibilityLabel={"Cambia il nome di " + p.name}
                  outerStyle={{ flex: 1, marginRight: 8 }}
                  hoverStyle={{ opacity: 0.85 }}
                  style={{ flexDirection: "row", alignItems: "center", minHeight: 56 }}
                >
                  {who}
                </Pressy>
              ) : (
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", marginRight: 8 }}>{who}</View>
              )}
              {p.isHost ? (
                <View style={{ backgroundColor: colors.accentSoft, paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill }}>
                  <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 13 }}>Banco</Text>
                </View>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {p.noPhone ? (
                    <Text style={[type.caption, { color: colors.accent }]}>Senza telefono</Text>
                  ) : p.status === "joining" ? (
                    <Text style={[type.caption, { color: colors.warn }]}>Sta entrando…</Text>
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={16} color={colors.success} />
                      <Text style={[type.caption, { color: colors.success, marginLeft: 4 }]}>Pronto</Text>
                    </>
                  )}
                  <View style={{ marginLeft: 10 }}>
                    <IconButton
                      name="close"
                      label={"Togli " + p.name}
                      size={34}
                      bg="transparent"
                      color={colors.faint}
                      onPress={() => setToRemove(p)}
                    />
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </View>

      <Pressy
        onPress={tools.openAdd}
        style={{ marginTop: 12, minHeight: 54, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#4A4238", flexDirection: "row", alignItems: "center", justifyContent: "center" }}
      >
        <Ionicons name="person-add-outline" size={18} color={colors.text} />
        <Text style={[type.bodyStrong, { color: colors.text, marginLeft: 8 }]}>Aggiungi chi non ha il telefono</Text>
      </Pressy>
      <Pressy
        onPress={() => navigation.navigate("Join", { id: table.id })}
        style={{ marginTop: 10, minHeight: 54, borderRadius: radius.lg, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}
      >
        <Ionicons name="phone-portrait-outline" size={18} color={colors.accent} />
        <Text style={[type.bodyStrong, { color: colors.accent, marginLeft: 8 }]}>Fai entrare un ospite da qui</Text>
      </Pressy>
      <Text style={[type.caption, { color: colors.faint, marginTop: 10, textAlign: "center", fontWeight: "400" }]}>
        {Platform.OS === "web" ? "Ognuno sceglie nome e colore e si siede. Tocca un nome per cambiarlo." : "L'ospite sceglie nome e colore su questo telefono e si siede. Tocca un nome per cambiarlo."}
      </Text>

      <Text style={[type.section, { color: colors.text, marginTop: 24, marginBottom: 10 }]}>Regole del tavolo</Text>
      <RulesCard
        kind={table.kind}
        cfg={configOf(table)}
        note="Si possono cambiare fino all'inizio della partita."
        onChange={(c) => {
          const r = apply(table.id, (t) => applyConfig(t, c));
          if (r.error) return r.error;
          toast.ok("Regole aggiornate");
          return null;
        }}
      />
      <Text style={[type.caption, { color: colors.faint, marginTop: 8, textAlign: "center", fontWeight: "400" }]}>Tocca una riga e scrivi il valore che vuoi</Text>

      {tools.sheets}
      <ConfirmSheet
        visible={!!toRemove}
        title={toRemove ? "Togliere " + toRemove.name + "?" : "Togliere il giocatore?"}
        subtitle={table.name}
        lines={toRemove ? removeLines(toRemove) : []}
        confirmLabel="Togli dal tavolo"
        icon="person-remove-outline"
        firstIcon="person-remove-outline"
        onConfirm={removeNow}
        onClose={() => setToRemove(null)}
      />
      <Sheet visible={renameOpen} onClose={() => setRenameOpen(false)} title="Nome del tavolo">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          maxLength={32}
          autoFocus
          placeholder="Es. Poker del giovedì"
          placeholderTextColor={colors.faint}
          style={{ height: 54, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.accent, color: colors.text, paddingHorizontal: 16, fontSize: 17, backgroundColor: colors.bg }}
        />
        <View style={{ height: 14 }} />
        <Button
          label="Salva"
          disabled={!draft.trim()}
          onPress={() => {
            apply(table.id, (t) => ({ ...t, name: draft.trim() }));
            setRenameOpen(false);
          }}
        />
      </Sheet>
    </Screen>
    </View>
  );
}
