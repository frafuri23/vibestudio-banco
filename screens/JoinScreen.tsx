import React, { useEffect, useMemo, useState } from "react";
import { Platform, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FadeIn, Screen } from "../components/Screen";
import { Button, IconButton, Pressy, tap } from "../components/Pressy";
import { Avatar } from "../components/Avatar";
import { Chip } from "../components/Tokens";
import { toast } from "../components/Toast";
import { useStore, useTable } from "../lib/store";
import { addPlayer } from "../lib/engine";
import { findByCode } from "../lib/live";
import { uid } from "../lib/ledger";
import { tableRoute } from "../lib/nav";
import { inviteCodeFromUrl } from "../lib/tableInfo";
import { fmtEuro, fmtNum } from "../lib/format";
import { ScreenProps } from "../lib/nav";
import { Table } from "../lib/types";
import { colors, playerColors, radius, type } from "../lib/theme";

export default function JoinScreen({ navigation, route }: ScreenProps<"Join">) {
  const tables = useStore((s) => s.tables);
  const apply = useStore((s) => s.apply);
  const setMe = useStore((s) => s.setMe);
  const myName = useStore((s) => s.myName);
  const setMyName = useStore((s) => s.setMyName);
  const fromLobby = !!route.params?.id;
  const [id, setId] = useState<string | undefined>(route.params?.id);
  const [code, setCode] = useState("");
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const table = useTable(id);
  const used = useMemo(() => new Set((table?.players || []).map((p) => p.color)), [table?.players]);
  // Da questo telefono entri tu: il nome si prende dal profilo. Se l'host fa sedere un ospite, si parte vuoti.
  const [name, setName] = useState(fromLobby ? "" : myName);
  const [color, setColor] = useState(playerColors[0]);
  const [err, setErr] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const free = playerColors.find((c) => !used.has(c));
    if (free) setColor(free);
  }, [id]);

  useEffect(() => {
    if (Platform.OS !== "web" || id) return;
    const c = inviteCodeFromUrl();
    if (!c) return;
    setCode(c);
    // Si passa subito a nome e colore: il tavolo si cerca qui e poi sul server
    lookup(c);
  }, []);

  const lookup = async (c: string) => {
    const found = (Object.values(tables) as Table[]).find((t) => t.code === c && t.status !== "closed");
    if (found) return setId(found.id);
    setLooking(true);
    try {
      const remote = await findByCode(c);
      if (remote) setId(remote.id);
      else setCodeErr("Nessun tavolo aperto con questo codice. Controlla le 4 lettere.");
    } catch (e: any) {
      setCodeErr(e?.message || "Non riesco a raggiungere il banco. Riprova.");
    } finally {
      setLooking(false);
    }
  };

  const findCode = () => {
    const c = code.trim().toUpperCase();
    if (c.length < 4 || looking) return;
    lookup(c);
  };

  const sit = () => {
    if (!table) return;
    const pid = uid("p");
    const r = apply(table.id, (t) => addPlayer(t, name, color, { id: pid, status: "ready" }));
    if (r.error) {
      tap("error");
      return setErr(r.error);
    }
    tap("success");
    if (fromLobby) {
      // Ospite fatto entrare dal telefono dell'host
      toast.ok(name.trim() + " si è seduto al tavolo");
      return navigation.goBack();
    }
    // Da qui in poi questo telefono è di chi si è appena seduto
    setMe(table.id, r.info || pid);
    if (!myName) setMyName(name);
    toast.ok("Sei al tavolo, " + name.trim());
    const next = useStore.getState().tables[table.id] || table;
    const dest = tableRoute(next);
    navigation.replace(dest.name as any, dest.params);
  };

  const header = (
    <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 10, paddingBottom: 10 }}>
      <IconButton name="chevron-back" label="Indietro" onPress={() => navigation.goBack()} />
      <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 12, flex: 1 }}>
        <Chip size={26} color={colors.accent} stripe="#F4EEE3" />
        <Text style={[type.section, { color: colors.text, marginLeft: 8, letterSpacing: 1 }]}>Banco</Text>
      </View>
      <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
        <Text style={[type.caption, { color: colors.muted }]}>Niente da installare</Text>
      </View>
    </View>
  );

  if (!table) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <Screen footer={<Button label={looking ? "Cerco il tavolo…" : "Cerca il tavolo"} iconRight="arrow-forward" onPress={findCode} disabled={code.trim().length < 4 || looking} />}>
        {header}
        <FadeIn style={{ marginTop: 24 }}>
          <Text style={[type.label, { color: colors.muted }]}>Entra in un tavolo</Text>
          <Text style={[type.display, { color: colors.text, marginTop: 8 }]}>Qual è il codice?</Text>
          <Text style={[type.body, { color: colors.muted, marginTop: 8 }]}>Sono le 4 lettere che l'host vede sotto il QR.</Text>
          <TextInput
            value={code}
            onChangeText={(v) => {
              setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4));
              setCodeErr(null);
            }}
            placeholder="K7Q2"
            placeholderTextColor={colors.faint}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            onSubmitEditing={findCode}
            style={{ marginTop: 24, height: 72, borderRadius: radius.lg, borderWidth: 1.5, borderColor: codeErr ? colors.danger : colors.accent, color: colors.text, fontSize: 34, fontWeight: "800", letterSpacing: 14, textAlign: "center", backgroundColor: colors.surface }}
          />
          {codeErr ? <Text style={[type.caption, { color: colors.danger, marginTop: 8 }]}>{codeErr}</Text> : null}
        </FadeIn>
      </Screen>
      </View>
    );
  }

  const others = table.players;
  const value =
    table.kind === "tombola"
      ? { big: "2", small: "cartelle · " + fmtEuro((table.tombola?.priceCents || 100) * 2) }
      : table.kind === "bank"
      ? { big: fmtNum(table.bank?.startBalance || 1500), small: "soldi del gioco" }
      : { big: fmtNum(table.buyinUnits), small: "fiches = " + fmtEuro(table.buyinCents).replace(",00", "") };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
    <Screen scroll footer={<Button label="Siediti al tavolo" iconRight="arrow-forward" onPress={sit} disabled={!name.trim()} />}>
      {header}
      <FadeIn style={{ marginTop: 16 }}>
        <Text style={[type.label, { color: colors.muted }]}>Ti hanno invitato a</Text>
        <Text style={[type.display, { color: colors.text, marginTop: 6, fontSize: 36, lineHeight: 38 }]}>{table.name}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12 }}>
          {others.slice(0, 5).map((p, i) => (
            <View key={p.id} style={{ marginLeft: i ? -8 : 0, borderRadius: 18, borderWidth: 2, borderColor: colors.bg }}>
              <Avatar player={p} size={32} icon={p.isHost ? "star" : undefined} />
            </View>
          ))}
          <Text style={[type.body, { color: colors.muted, marginLeft: 10 }]}>{others.length + (others.length === 1 ? " giocatore ti aspetta" : " giocatori ti aspettano")}</Text>
        </View>
      </FadeIn>

      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 18, marginTop: 22 }}>
        <Text style={[type.body, { color: colors.muted }]}>Come ti chiamano al tavolo?</Text>
        <TextInput
          value={name}
          onChangeText={(v) => {
            setName(v);
            setErr(null);
          }}
          placeholder="Il tuo nome"
          placeholderTextColor={colors.faint}
          maxLength={20}
          onSubmitEditing={sit}
          style={{ marginTop: 10, height: 56, borderRadius: radius.md, borderWidth: 1.5, borderColor: err ? colors.danger : colors.accent, color: colors.text, paddingHorizontal: 16, fontSize: 18, backgroundColor: colors.bg }}
        />
        {err ? <Text style={[type.caption, { color: colors.danger, marginTop: 6 }]}>{err}</Text> : null}
        <Text style={[type.body, { color: colors.muted, marginTop: 18, marginBottom: 10 }]}>Il tuo colore</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {playerColors.map((c) => (
            <Pressy
              key={c}
              accessibilityLabel={"Colore " + c}
              onPress={() => setColor(c)}
              style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: c, marginRight: 10, marginBottom: 10, borderWidth: 3, borderColor: color === c ? colors.text : "transparent", opacity: used.has(c) && color !== c ? 0.35 : 1 }}
            >
              <View />
            </Pressy>
          ))}
        </View>
      </View>

      <LinearGradient colors={["#24503F", "#1A3A2E"]} style={{ borderRadius: radius.lg, padding: 16, marginTop: 14, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#2D5F4C" }}>
        <View style={{ borderRadius: 34, borderWidth: 3, borderColor: "rgba(255,255,255,0.75)" }}>
          <Avatar size={58} color={color} player={{ id: "x", name: name.trim() || "?", color, status: "ready" }} />
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[type.caption, { color: "rgba(244,238,227,0.75)", fontWeight: "400" }]}>Al tavolo apparirai così</Text>
          <Text style={[type.heading, { color: colors.text, fontSize: 20, marginTop: 2 }]} numberOfLines={1}>
            {name.trim() || "Il tuo nome"}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[type.number, { color: colors.text, fontSize: 28 }]}>{value.big}</Text>
          <Text style={[type.caption, { color: "rgba(244,238,227,0.75)", fontWeight: "400" }]}>{value.small}</Text>
        </View>
      </LinearGradient>

      <Text style={[type.body, { color: colors.muted, marginTop: 16 }]}>
        Le fiches le tiene il banco: vedi il tuo saldo e quello degli altri. I soldi veri si saldano solo a fine serata.
      </Text>
      <Text style={[type.caption, { color: colors.faint, marginTop: 12, textAlign: "center", fontWeight: "400" }]}>
        Storico e statistiche? Installa l'app quando vuoi: il profilo resta tuo.
      </Text>
    </Screen>
    </View>
  );
}
