import React, { useState } from "react";
import { Platform, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { FadeIn, TopBar } from "../components/Screen";
import { Button, Pressy, tap } from "../components/Pressy";
import { Sheet } from "../components/Sheet";
import { LiveBadge } from "../components/LiveBadge";
import { Avatar } from "../components/Avatar";
import { Coin } from "../components/Tokens";
import { CardsSheet, WinnerSheet } from "../components/TombolaSheets";
import { usePlayerTools } from "../components/PlayerTools";
import { toast } from "../components/Toast";
import { useStore, useTable } from "../lib/store";
import { addCard, addPlayer, removeCard } from "../lib/engine";
import { currentPrizeIndex, endNight, prizeBase, prizeWonBy, tombolaAward, tombolaTotal, tombolaUndo } from "../lib/rules";
import { fmtEuro } from "../lib/format";
import { ScreenProps } from "../lib/nav";
import { colors, MAX_W, radius, type } from "../lib/theme";
import { useChrome } from "../lib/chrome";
import { Player } from "../lib/types";

const PAPER = "#F3E9DC";
const INK = "#1E1A15";
const MUTED = "#6B6255";
const RED = "#A8352B";
const GREEN = "#2F6B4F";
const CREAM = "#F4EEE3";
const GOLD = "#E2BF6E";
const SOFT = "rgba(244,238,227,0.75)";

// Il mucchietto di monete accanto al montepremi (posizione e misura di ognuna)
const PILE: { x: number; y: number; s: number; metal: "gold" | "copper"; inner?: "silver" }[] = [
  { x: 17, y: 0, s: 24, metal: "gold", inner: "silver" },
  { x: 35, y: 8, s: 26, metal: "gold" },
  { x: 0, y: 20, s: 30, metal: "gold", inner: "silver" },
  { x: 22, y: 26, s: 25, metal: "copper" },
  { x: 45, y: 29, s: 21, metal: "copper" },
];

function InfoRow({ icon, children }: { icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", paddingVertical: 10 }}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
        <Ionicons name={icon} size={16} color={colors.accent} />
      </View>
      <Text style={[type.body, { color: colors.text, flex: 1, paddingTop: 5 }]}>{children}</Text>
    </View>
  );
}

export default function TombolaScreen({ navigation, route }: ScreenProps<"Tombola">) {
  const table = useTable(route.params?.id);
  const apply = useStore((s) => s.apply);
  const insets = useSafeAreaInsets();
  const [pick, setPick] = useState(false);
  const [cardsOf, setCardsOf] = useState<Player | null>(null);
  const [info, setInfo] = useState(false);
  // Da 900 px (iPad orizzontale, computer): montepremi e premi a sinistra, giocatori a destra,
  // così la schermata entra in una pagina anche su finestre larghe ma basse
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  useChrome(table?.tombola ? "#4A3226" : "#2A1D16");
  // Chi non ha il telefono entra con 1 cartella; chi entra col codice se le compra dal suo nome
  const tools = usePlayerTools(table, {
    addNote: "Entra con 1 cartella. Lo gestisci tu dal tuo telefono.",
    onAddNoPhone: (name, color) => {
      if (!table) return "Tavolo non trovato";
      let pid: string | undefined;
      const r = apply(table.id, (t) => {
        const a = addPlayer(t, name, color, { noPhone: true });
        if (a.error) return a;
        pid = a.info;
        return addCard(a.table, a.info!);
      });
      if (!r.error && pid) toast.ok(name.trim() + " gioca con 1 cartella");
      return r.error || null;
    },
  });

  if (!table || !table.tombola) {
    return (
      <View style={{ flex: 1, backgroundColor: "#2A1D16", paddingTop: insets.top, paddingHorizontal: 20 }}>
        <TopBar title="Tavolo non trovato" onBack={() => navigation.goBack()} />
      </View>
    );
  }

  const tb = table.tombola;
  const total = tombolaTotal(table);
  const cards = (Object.values(tb.cards) as number[]).reduce((s: number, c: number) => s + c, 0);
  const idx = currentPrizeIndex(table);
  const current = idx >= 0 ? tb.prizes[idx] : null;
  const currentAmount = idx >= 0 ? prizeBase(table, idx) + tb.carryCents : 0;
  const noPhone = table.players.filter((p) => p.noPhone).length;
  const locked = tb.prizes.some((p) => p.done);
  const nm = (id: string) => table.players.find((p) => p.id === id)?.name || "?";

  const run = (fn: Parameters<typeof apply>[1], ok?: string) => {
    const r = apply(table.id, fn);
    if (r.error) {
      tap("error");
      toast.error(r.error);
      return false;
    }
    if (ok) toast.ok(ok);
    return true;
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#4A3226", paddingTop: insets.top }}>
      <LinearGradient colors={["#4A3226", "#2E2019", "#241812"]} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, flexDirection: "row", opacity: 0.07 }}>
        {Array.from({ length: 18 }).map((_, i) => (
          <View key={i} style={{ flex: 1, borderRightWidth: i % 3 === 0 ? 2 : 1, borderRightColor: "#000" }} />
        ))}
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 16 }} showsVerticalScrollIndicator={false}>
        <View style={{ width: "100%", maxWidth: wide ? 1040 : MAX_W, alignSelf: "center", paddingHorizontal: wide ? 32 : 20 }}>
          <TopBar
            onBack={() => navigation.navigate("Home")}
            title={table.name}
            subtitle={table.players.length + " giocatori · " + cards + " cartelle" + (noPhone ? " · " + noPhone + " senza telefono" : "")}
            status={<LiveBadge table={table} />}
            right={
              <Pressy
                onPress={() => setInfo(true)}
                accessibilityLabel="Info: come funzionano premi, divisione e giocatori senza telefono"
                hoverStyle={{ backgroundColor: "rgba(0,0,0,0.4)" }}
                style={{ flexDirection: "row", alignItems: "center", height: 44, borderRadius: 22, paddingLeft: 10, paddingRight: 14, backgroundColor: "rgba(0,0,0,0.25)", borderWidth: 1, borderColor: colors.border }}
              >
                <Ionicons name="information-circle-outline" size={20} color={GOLD} />
                <Text style={{ color: GOLD, fontWeight: "700", fontSize: 14, marginLeft: 5 }}>Info</Text>
              </Pressy>
            }
          />

          <View style={wide ? { flexDirection: "row", alignItems: "flex-start" } : undefined}>
          <View style={wide ? { flex: 1, marginRight: 28 } : undefined}>
          {/* Montepremi su una riga: monetine, cifra e cartelle × prezzo */}
          <FadeIn>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <View style={{ width: 66, height: 52 }}>
                {PILE.map((c, i) => (
                  <View key={i} style={{ position: "absolute", left: c.x, top: c.y }}>
                    <Coin size={c.s} metal={c.metal} inner={c.inner} />
                  </View>
                ))}
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={[type.label, { color: "rgba(244,238,227,0.7)" }]}>Montepremi</Text>
                <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap" }}>
                  <Text style={[type.number, { color: GOLD, fontSize: 36, lineHeight: 40, marginRight: 10 }]}>{fmtEuro(total)}</Text>
                  <Text style={[type.caption, { color: SOFT, fontWeight: "400" }]} numberOfLines={1}>
                    {cards + " cartelle × " + fmtEuro(tb.priceCents)}
                  </Text>
                </View>
              </View>
            </View>
          </FadeIn>

          {/* Premi: "in palio" su una riga, premio in corso e premi vinti con una riga in più */}
          <View style={{ backgroundColor: PAPER, borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 4 }}>
            {tb.prizes.map((p, i) => {
              const isCur = i === idx;
              const amount = p.done ? p.paidCents.reduce((s, x) => s + x, 0) : isCur ? currentAmount : prizeBase(table, i);
              return (
                <View key={p.key} style={{ flexDirection: "row", alignItems: "center", minHeight: 44, paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: "rgba(30,26,21,0.12)" }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text numberOfLines={1}>
                      <Text style={[type.section, { color: isCur ? RED : INK, fontSize: 17, lineHeight: 20 }]}>{p.label}</Text>
                      <Text style={{ color: MUTED, fontSize: 12.5 }}>{"  " + p.pct + "%" + (!p.done && !isCur ? " · in palio" : "")}</Text>
                    </Text>
                    {p.done ? (
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 1 }}>
                        <Ionicons name="checkmark" size={13} color={GREEN} />
                        <Text style={[type.caption, { color: GREEN, marginLeft: 4, flex: 1, fontSize: 12.5, lineHeight: 16 }]} numberOfLines={1}>
                          {p.winners.map(nm).join(" e ") + (p.winners.length > 1 ? " · " + fmtEuro(p.paidCents[1] || 0) + " a testa" : "")}
                        </Text>
                      </View>
                    ) : isCur ? (
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 1 }}>
                        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: RED, marginRight: 6 }} />
                        <Text style={[type.caption, { color: RED, fontSize: 12.5, lineHeight: 16 }]}>Si gioca adesso</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[type.number, { color: p.done ? MUTED : INK, fontSize: 20 }]}>{fmtEuro(amount)}</Text>
                </View>
              );
            })}
          </View>

          <View style={{ marginTop: 12 }}>
            {current ? (
              <Button label={"Chi ha fatto " + current.label.toLowerCase() + "?"} onPress={() => setPick(true)} accent={RED} ink="#FFFFFF" />
            ) : (
              <Button
                label="Fine serata: chi paga chi"
                iconRight="arrow-forward"
                onPress={() => {
                  if (run((t) => endNight(t))) navigation.navigate("Settlement", { id: table.id });
                }}
              />
            )}
          </View>

          </View>

          <View style={wide ? { flex: 1 } : undefined}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: wide ? 0 : 12, minHeight: 40 }}>
            <Text style={[type.section, { color: CREAM }]}>Giocatori</Text>
            {!locked ? (
              <Pressy onPress={tools.openInvite} hitSlop={6} accessibilityLabel="Aggiungi un giocatore: QR, link o senza telefono" style={{ flexDirection: "row", alignItems: "center", minHeight: 40, paddingHorizontal: 4 }}>
                <Ionicons name="person-add-outline" size={15} color={GOLD} />
                <Text style={[type.caption, { color: GOLD, marginLeft: 5 }]}>Aggiungi</Text>
              </Pressy>
            ) : (
              <Pressy onPress={() => run((t) => tombolaUndo(t), "Ultimo premio annullato")} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", minHeight: 40, paddingHorizontal: 4 }}>
                <Ionicons name="arrow-undo" size={14} color={SOFT} />
                <Text style={[type.caption, { color: SOFT, marginLeft: 6 }]}>Annulla l'ultimo premio</Text>
              </Pressy>
            )}
          </View>

          {/* Striscia dei giocatori: scorre di lato (sul telefono fino al bordo dello schermo), tocca per le cartelle */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={Platform.OS === "web"}
            style={{ marginHorizontal: wide ? -2 : -20 }}
            contentContainerStyle={{ paddingHorizontal: wide ? 0 : 16, paddingTop: 4, paddingBottom: 4 }}
          >
            {table.players.map((p) => {
              const won = prizeWonBy(table, p.id);
              const nCards = tb.cards[p.id] || 0;
              return (
                <Pressy
                  key={p.id}
                  onPress={() => setCardsOf(p)}
                  accessibilityLabel={"Cartelle di " + p.name + ": " + nCards + (won ? ", ha vinto " + fmtEuro(won) : "")}
                  style={{ width: 70, alignItems: "center", marginHorizontal: 2, paddingVertical: 2 }}
                >
                  <Avatar player={p} size={42} ring={p.noPhone ? GOLD : undefined} />
                  <Text style={[type.caption, { color: CREAM, marginTop: 4, lineHeight: 16 }]} numberOfLines={1}>
                    {p.name.split(" ")[0]}
                  </Text>
                  <Text style={{ color: won ? GOLD : "rgba(244,238,227,0.5)", fontWeight: "700", fontSize: 12.5, lineHeight: 16 }}>{won ? "+" + fmtEuro(won) : nCards + " cart."}</Text>
                </Pressy>
              );
            })}
          </ScrollView>
          </View>
          </View>
        </View>
      </ScrollView>

      <Sheet visible={info} onClose={() => setInfo(false)} title="Come funziona" subtitle="Tombola · grafica Monetine">
        <InfoRow icon="ellipse-outline">
          {"Bordo dorato: giocatori senza telefono, li segni tu." + (noPhone ? " Ora sono " + noPhone + "." : "")}
        </InfoRow>
        <InfoRow icon="people-outline">Premio vinto in più persone? Si divide in parti uguali; il centesimo che avanza passa al premio dopo.</InfoRow>
        <InfoRow icon="albums-outline">Tocca un giocatore nella striscia per vedere e cambiare le sue cartelle (finché non esce il primo premio).</InfoRow>
      </Sheet>
      <WinnerSheet
        visible={pick}
        onClose={() => setPick(false)}
        table={table}
        prizeLabel={current?.label || ""}
        amount={currentAmount}
        onAssign={(ids) => {
          const label = current?.label || "Premio";
          const fem = /a$/i.test(label.trim());
          if (run((t) => tombolaAward(t, ids), label + (fem ? " assegnata" : " assegnato"))) {
            tap("success");
            setPick(false);
          }
        }}
      />
      <CardsSheet
        player={cardsOf}
        table={table}
        locked={locked}
        onClose={() => setCardsOf(null)}
        onAdd={() => cardsOf && run((t) => addCard(t, cardsOf.id))}
        onRemove={() => cardsOf && run((t) => removeCard(t, cardsOf.id))}
        onRename={
          cardsOf && tools.canRename(cardsOf.id)
            ? () => {
                const p = cardsOf;
                setCardsOf(null);
                tools.openRename(p);
              }
            : undefined
        }
      />
      {tools.sheets}
    </View>
  );
}
