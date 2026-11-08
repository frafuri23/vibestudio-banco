import React, { useMemo, useState } from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { FadeIn, TopBar } from "../components/Screen";
import { Button, IconButton, Pressy } from "../components/Pressy";
import { LiveBadge } from "../components/LiveBadge";
import { Avatar } from "../components/Avatar";
import { Bill } from "../components/Tokens";
import { Sheet } from "../components/Sheet";
import { RecentMoves } from "../components/RecentMoves";
import { usePlayerTools } from "../components/PlayerTools";
import { toast } from "../components/Toast";
import { useStore, useTable } from "../lib/store";
import { useMove } from "../lib/useMove";
import { addPlayer, append, undoEntry } from "../lib/engine";
import { bankLap, endNight } from "../lib/rules";
import { BANK, balances } from "../lib/ledger";
import { BANK_NOTES } from "../lib/games";
import { fmtNum } from "../lib/format";
import { ScreenProps } from "../lib/nav";
import { MAX_W, radius, shadow, type } from "../lib/theme";
import { useChrome } from "../lib/chrome";

const PAPER = "#F1ECE2";
const INK = "#1E1A15";
const MUTED = "#6B6255";
const GREEN = "#2F5E4B";
const LINE = "#E4DCCD";
const CATS = ["Affitto", "Acquisto", "Tassa", "Altro"];
// Da questa larghezza (iPad orizzontale, computer) saldo + ultimo movimento a sinistra, pagamento a destra:
// cos\u00ec la schermata entra in una pagina anche su finestre larghe ma basse
const WIDE = 900;

export default function BankScreen({ navigation, route }: ScreenProps<"Bank">) {
  const table = useTable(route.params?.id);
  const move = useMove(route.params?.id);
  const setBankView = useStore((s) => s.setBankView);
  const apply = useStore((s) => s.apply);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const [to, setTo] = useState<string>(BANK);
  const [amount, setAmount] = useState(0);
  const [cat, setCat] = useState(CATS[0]);
  const [who, setWho] = useState(false);
  const bal = useMemo(() => (table ? balances(table.entries) : {}), [table?.entries]);
  useChrome(PAPER, true);
  const tools = usePlayerTools(table, {
    light: true,
    addNote: "Riceve il saldo iniziale. Lo gestisci tu dal tuo telefono.",
    onAddNoPhone: (name, color) => {
      if (!table) return "Tavolo non trovato";
      const r = apply(table.id, (t) => addPlayer(t, name, color, { noPhone: true }));
      if (!r.error) toast.ok(name.trim() + " \u00E8 al tavolo con " + fmtNum(table.bank?.startBalance || 0));
      return r.error || null;
    },
  });

  if (!table || !table.bank) {
    return (
      <View style={{ flex: 1, backgroundColor: PAPER, paddingTop: insets.top, paddingHorizontal: 20 }}>
        <TopBar title="Tavolo non trovato" onBack={() => navigation.goBack()} light />
      </View>
    );
  }

  const me = table.bank.me || table.me;
  const meP = table.players.find((p) => p.id === me);
  const isHost = me === table.me;
  const others = table.players.filter((p) => p.id !== me);
  // "alla banca" / "a Giulia"
  const target = to === BANK ? "alla banca" : "a " + (table.players.find((p) => p.id === to)?.name || "?");
  const myBal = bal[me] || 0;

  const pay = () => {
    if (move((t) => append(t, { from: me, to: to === me ? BANK : to, amount, kind: "pay", note: cat }), "Pagati " + fmtNum(amount) + " " + target, { undo: true })) setAmount(0);
  };

  const balanceCard = (
    <FadeIn>
      <View style={[{ backgroundColor: "#FFFDF8", borderRadius: radius.lg, paddingHorizontal: 18, paddingVertical: 14, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: LINE }, shadow.soft, { shadowOpacity: 0.08 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[type.caption, { color: MUTED }]} numberOfLines={1}>
            {(isHost ? "Il tuo saldo" : "Saldo di " + (meP?.name || "?")) + " · soldi del gioco"}
          </Text>
          <Text style={[type.number, { color: INK, fontSize: 40, lineHeight: 44 }]}>{fmtNum(myBal)}</Text>
        </View>
        <View style={{ width: 100, height: 58 }}>
          <View style={{ position: "absolute", left: 0, top: 16 }}><Bill width={70} color="#EBCFD6" rotate={-10} /></View>
          <View style={{ position: "absolute", left: 12, top: 8 }}><Bill width={70} color="#CFE6DD" rotate={-4} /></View>
          <View style={{ position: "absolute", left: 26, top: 4 }}><Bill width={70} color="#F1D9B5" rotate={6} value={50} /></View>
        </View>
      </View>
    </FadeIn>
  );

  const recent = (
    <RecentMoves table={table} perspective={me} limit={1} onUndo={(id) => move((t) => undoEntry(t, id), "Movimento annullato")} onAll={() => navigation.navigate("Registro", { id: table.id })} />
  );

  const composer = (
    <>
      <Text style={[type.section, { color: INK, marginTop: wide ? 0 : 14, marginBottom: 8 }]}>Paga a</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
        {[BANK, ...others.map((p) => p.id)].map((id) => {
          const p = table.players.find((x) => x.id === id);
          const on = to === id;
          return (
            <Pressy key={id} onPress={() => setTo(id)} accessibilityLabel={"Paga a " + (p?.name || "Banca")} style={{ alignItems: "center", marginRight: 12, width: 62 }}>
              <View style={{ borderRadius: 31, borderWidth: 3, borderColor: on ? GREEN : "transparent", padding: 2 }}>
                {id === BANK ? <Avatar size={46} color={INK} icon="business" /> : <Avatar player={p} size={46} />}
              </View>
              <Text style={[type.caption, { color: on ? GREEN : INK, marginTop: 4, fontWeight: on ? "700" : "500" }]} numberOfLines={1}>
                {id === BANK ? "Banca" : p?.name}
              </Text>
            </Pressy>
          );
        })}
      </ScrollView>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
        <IconButton name="remove" label="Meno 10" size={50} color={INK} bg="#FFFFFF" border={LINE} onPress={() => setAmount((a) => Math.max(0, a - 10))} />
        <View style={{ alignItems: "center", flex: 1 }}>
          <Text style={[type.number, { color: INK, fontSize: 46, lineHeight: 50 }]}>{fmtNum(amount)}</Text>
          <Text style={[type.caption, { color: MUTED, fontWeight: "400" }]} numberOfLines={1}>
            {cat.toLowerCase() + " " + target}
          </Text>
        </View>
        <IconButton name="add" label="Più 10" size={50} color={INK} bg="#FFFFFF" border={LINE} onPress={() => setAmount((a) => a + 10)} />
      </View>

      <View style={{ flexDirection: "row", marginTop: 12, marginHorizontal: -4 }}>
        {BANK_NOTES.map((n) => (
          <View key={n} style={{ flex: 1, paddingHorizontal: 4 }}>
            <Pressy onPress={() => setAmount((a) => a + n)} hoverStyle={{ backgroundColor: "#FFFFFF" }} style={{ height: 44, borderRadius: radius.md, backgroundColor: "#FBF8F2", borderWidth: 1, borderColor: LINE, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: INK, fontWeight: "700", fontSize: 16 }}>{"+" + n}</Text>
            </Pressy>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10 }}>
        {CATS.map((c) => {
          const on = c === cat;
          return (
            <Pressy key={c} onPress={() => setCat(c)} style={{ height: 42, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: on ? INK : "transparent", borderWidth: 1, borderColor: on ? INK : "#CFC5B4", marginRight: 8, marginBottom: 8, justifyContent: "center" }}>
              <Text style={{ color: on ? "#FBF8F2" : INK, fontWeight: "600", fontSize: 15 }}>{c}</Text>
            </Pressy>
          );
        })}
      </View>

      <View style={{ marginTop: 2 }}>
        <Button label={amount ? "Paga " + fmtNum(amount) + " " + target : "Scegli quanto pagare"} disabled={!amount} onPress={pay} accent={GREEN} ink="#FFFFFF" />
      </View>
      <View style={{ flexDirection: "row", marginTop: 8 }}>
        <Pressy
          onPress={() => move((t) => bankLap(t, me), "Giro completo: +" + table.bank!.lapBonus + " dalla banca", { undo: true })}
          outerStyle={{ flex: 1, marginRight: 8 }}
          style={{ minHeight: 48, borderRadius: radius.md, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#BFB4A2", flexDirection: "row", alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="refresh" size={17} color={INK} />
          <Text style={{ color: INK, fontWeight: "600", fontSize: 14.5, marginLeft: 6 }}>{"Giro completo +" + table.bank.lapBonus}</Text>
        </Pressy>
        <Pressy
          disabled={!amount}
          onPress={() => move((t) => append(t, { from: BANK, to: me, amount, kind: "pay", note: "Dalla banca" }), "Incassati " + fmtNum(amount), { undo: true }) && setAmount(0)}
          outerStyle={{ flex: 1 }}
          style={{ minHeight: 48, borderRadius: radius.md, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#BFB4A2", flexDirection: "row", alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="arrow-down" size={17} color={INK} />
          <Text style={{ color: INK, fontWeight: "600", fontSize: 14.5, marginLeft: 6 }}>Incassa dalla banca</Text>
        </Pressy>
      </View>
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: PAPER, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 12 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={{ width: "100%", maxWidth: wide ? 1040 : MAX_W, alignSelf: "center", paddingHorizontal: wide ? 32 : 20 }}>
          <TopBar
            light
            title="Gioco con banca"
            subtitle={table.name + " · grafica Banconote"}
            status={<LiveBadge table={table} light />}
            onBack={() => navigation.navigate("Home")}
            right={
              <View style={{ flexDirection: "row" }}>
                <IconButton name="people-outline" label="Giocatori: chi sta giocando, nomi e nuovi arrivi" onPress={() => setWho(true)} color={INK} bg="#FFFFFF" border={LINE} />
                <View style={{ width: 8 }} />
                <IconButton name="flag-outline" label="Fine partita" color={INK} bg="#FFFFFF" border={LINE} onPress={() => move((t) => endNight(t), "Classifica finale") && navigation.navigate("Settlement", { id: table.id })} />
              </View>
            }
          />

          {wide ? (
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              <View style={{ flex: 1, marginRight: 28 }}>
                {balanceCard}
                {recent}
              </View>
              <View style={{ flex: 1.15 }}>{composer}</View>
            </View>
          ) : (
            <>
              {balanceCard}
              {composer}
              {recent}
            </>
          )}
        </View>
      </ScrollView>

      <Sheet visible={who} onClose={() => setWho(false)} title="Chi sta giocando?" subtitle="Un solo telefono? Passatevelo: scegli chi paga" light>
        {table.players.map((p) => (
          <View key={p.id} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Pressy
              onPress={() => {
                setBankView(table.id, p.id);
                setTo(BANK);
                setWho(false);
              }}
              accessibilityLabel={"Gioca " + p.name + ", saldo " + fmtNum(bal[p.id] || 0)}
              outerStyle={{ flex: 1 }}
              style={{ flexDirection: "row", alignItems: "center", minHeight: 58, borderRadius: radius.md, paddingHorizontal: 12, backgroundColor: p.id === me ? "#E6EFE9" : "#FFFFFF", borderWidth: 1, borderColor: p.id === me ? GREEN : LINE }}
            >
              <Avatar player={p} size={36} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[type.bodyStrong, { color: INK }]} numberOfLines={1}>
                  {p.name}
                </Text>
                {p.id === table.me ? <Text style={[type.caption, { color: GREEN, fontSize: 12, lineHeight: 15 }]}>tu</Text> : null}
              </View>
              <Text style={[type.bodyStrong, { color: MUTED }]}>{fmtNum(bal[p.id] || 0)}</Text>
            </Pressy>
            {tools.canRename(p.id) ? (
              <View style={{ marginLeft: 8 }}>
                <IconButton
                  name="create-outline"
                  label={"Cambia il nome di " + p.name}
                  color={INK}
                  bg="#FFFFFF"
                  border={LINE}
                  onPress={() => {
                    setWho(false);
                    tools.openRename(p);
                  }}
                />
              </View>
            ) : null}
          </View>
        ))}
        <Pressy
          onPress={() => {
            setWho(false);
            tools.openInvite();
          }}
          accessibilityLabel="Aggiungi un giocatore: QR, link o senza telefono"
          style={{ minHeight: 54, marginTop: 4, borderRadius: radius.md, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#BFB4A2", flexDirection: "row", alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="person-add-outline" size={18} color={INK} />
          <Text style={{ color: INK, fontWeight: "600", fontSize: 15, marginLeft: 8 }}>Aggiungi un giocatore</Text>
        </Pressy>
      </Sheet>
      {tools.sheets}
    </View>
  );
}
