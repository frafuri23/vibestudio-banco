import React, { useEffect, useMemo, useState } from "react";
import { Platform, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { FadeIn, Screen } from "../components/Screen";
import { Button, IconButton, Pressy } from "../components/Pressy";
import { GameCard } from "../components/GameCard";
import { statusOf, TableCard } from "../components/TableCard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { RulesCard } from "../components/RulesCard";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { NameSheet } from "../components/NameSheet";
import { Avatar } from "../components/Avatar";
import { Chip } from "../components/Tokens";
import { toast } from "../components/Toast";
import { GAMES } from "../lib/games";
import { cleanConfig, Config, defaultConfig, optsFor } from "../lib/presets";
import { createTable, HOST_COLOR, LEGACY_HOST } from "../lib/engine";
import { useStore } from "../lib/store";
import { publish } from "../lib/live";
import { inviteCodeFromUrl } from "../lib/tableInfo";
import { isDemoEvening } from "../lib/history";
import { useAccount } from "../lib/account";
import { ScreenProps, tableRoute } from "../lib/nav";
import { GameKind, Table } from "../lib/types";
import { colors, radius, space, type } from "../lib/theme";

const RULES_KEY = "banco.rules.v1";

export default function HomeScreen({ navigation }: ScreenProps<"Home">) {
  const tables = useStore((s) => s.tables);
  const order = useStore((s) => s.order);
  const add = useStore((s) => s.add);
  const remove = useStore((s) => s.remove);
  const removeDemos = useStore((s) => s.removeDemos);
  const demoEvenings = useStore((s) => s.past.filter((e) => isDemoEvening(e)).length);
  const [toDelete, setToDelete] = useState<Table | null>(null);
  const [askDemos, setAskDemos] = useState(false);
  // Gruppo "Esempi": chiuso all'avvio, così in cima restano i tavoli veri
  const [demosOpen, setDemosOpen] = useState(false);
  const myName = useStore((s) => s.myName);
  const setMyName = useStore((s) => s.setMyName);
  const accountEmail = useAccount((s) => s.email);
  const accountStatus = useAccount((s) => s.status);
  // "create": dopo il nome si crea subito il tavolo; "profile": si cambia solo il nome
  const [askName, setAskName] = useState<null | "create" | "profile">(null);
  const pastCount = useStore((s) => s.past.length);
  const [kind, setKind] = useState<GameKind>("poker");
  // Regole scelte per ogni gioco, ricordate su questo telefono per la prossima serata
  const [cfgs, setCfgs] = useState<Partial<Record<GameKind, Config>>>({});
  const cfgOf = (k: GameKind) => cfgs[k] || defaultConfig(k);
  const cfg = cfgOf(kind);
  const { width } = useWindowDimensions();
  // Da tablet orizzontale in su: due colonne (tavoli a sinistra, nuovo tavolo a destra)
  const wide = width >= 980;
  const cols = wide ? 3 : width < 340 ? 1 : 2;
  const insets = useSafeAreaInsets();

  // Link d'invito sul web: ?t=CODICE porta dritto alla schermata dell'ospite
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (inviteCodeFromUrl()) navigation.navigate("Join", {});
  }, []);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(RULES_KEY)
      .then((raw) => {
        if (!alive || !raw) return;
        const saved = JSON.parse(raw);
        const next: Partial<Record<GameKind, Config>> = {};
        GAMES.forEach((g) => {
          if (saved && saved[g.kind]) next[g.kind] = cleanConfig(g.kind, saved[g.kind]);
        });
        setCfgs((cur) => ({ ...next, ...cur }));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const setCfg = (c: Config) => {
    setCfgs((cur) => {
      const next = { ...cur, [kind]: c };
      AsyncStorage.setItem(RULES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const open = useMemo(() => order.map((id) => tables[id]).filter((t) => t && t.status !== "closed"), [order, tables]);
  const past = useMemo(() => order.map((id) => tables[id]).filter((t) => t && t.status === "closed"), [order, tables]);
  const game = GAMES.find((g) => g.kind === kind)!;
  const demoTables = useMemo(() => order.map((id) => tables[id]).filter((t) => t && t.demo), [order, tables]);
  const hasDemos = demoTables.length > 0;
  const mine = useMemo(() => open.filter((t) => !t.demo), [open]);
  const openDemos = useMemo(() => open.filter((t) => t.demo), [open]);

  const demoLines = (): string[] => {
    const n = demoTables.length;
    const lines = [(n === 1 ? "Tolgo il tavolo di esempio" : "Tolgo i " + n + " tavoli di esempio") + " da questo telefono."];
    if (demoEvenings) lines.push("Tolgo anche " + (demoEvenings === 1 ? "la serata di esempio" : "le " + demoEvenings + " serate di esempio") + " dello storico.");
    lines.push("I tuoi tavoli e le tue serate restano. Gli esempi non tornano pi\u00F9.");
    return lines;
  };

  const removeDemosNow = () => {
    setAskDemos(false);
    try {
      const r = removeDemos();
      toast.ok(r.tables + r.evenings ? "Esempi tolti: ora ci sono solo le tue serate" : "Non c'erano esempi da togliere");
    } catch (e: any) {
      toast.error(e?.message || "Non sono riuscito a togliere gli esempi");
    }
  };

  const deleteNow = () => {
    const t = toDelete;
    setToDelete(null);
    if (!t) return;
    try {
      remove(t.id);
      toast.ok("«" + t.name + "» eliminato da questo telefono");
    } catch (e: any) {
      toast.error(e?.message || "Non sono riuscito a eliminare il tavolo");
    }
  };

  const deleteLines = (t: Table): string[] => {
    const lines = ["Lo togli da questo telefono."];
    if ((t.entries || []).length) lines.push("I suoi movimenti non finiranno nei conti di fine serata né nello storico.");
    lines.push(t.online ? "Il registro sul server resta: chi ha il codice " + t.code + " può ancora aprirlo." : "Il tavolo non è online, quindi non si potrà recuperare.");
    return lines;
  };

  // Tavoli in cui questo telefono è l'host e si chiama ancora "Tu"
  const legacyCount = useMemo(
    () => order.map((id) => tables[id]).filter((t) => t && t.status !== "closed" && t.players.some((p) => p.id === t.me && p.isHost && p.name === LEGACY_HOST)).length,
    [order, tables]
  );

  const saveName = (name: string): string | null => {
    const r = setMyName(name);
    if (r.error) return r.error;
    const clean = useStore.getState().myName;
    toast.ok(r.renamed ? "Ciao " + clean + ": nome aggiornato in " + (r.renamed === 1 ? "1 tavolo" : r.renamed + " tavoli") : "Ciao " + clean + ": al tavolo ti vedono cos\u00EC");
    if (askName === "create") setTimeout(() => createNow(clean), 0);
    return null;
  };

  const createNow = (hostName = myName) => {
    if (!hostName) return setAskName("create");
    try {
      const t = createTable({ ...optsFor(kind, cfg), hostName });
      add(t);
      navigation.navigate("Lobby", { id: t.id });
      // Il tavolo va subito in tempo reale; se Supabase non risponde resta su questo telefono
      publish(t.id).catch(() => {});
    } catch (e: any) {
      toast.error(e?.message || "Non sono riuscito a creare il tavolo");
    }
  };

  const cta = <Button label={"Crea il tavolo · " + game.title} iconRight="arrow-forward" onPress={() => createNow()} />;
  const LEFT_W = 400;
  const GAP = 32;
  // Su schermo largo il pulsante resta fisso in basso, allineato alla colonna di destra
  const footer = wide ? (
    <View style={{ flexDirection: "row" }}>
      <View style={{ width: LEFT_W + GAP }} />
      <View style={{ flex: 1 }}>{cta}</View>
    </View>
  ) : (
    cta
  );

  const header = (
      <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 12, paddingBottom: 18 }}>
        <Chip size={34} color={colors.accent} stripe="#F4EEE3" />
        <Text style={[type.title, { color: colors.text, marginLeft: 10, flex: 1, letterSpacing: 1 }]}>Banco</Text>
        <Pressy
          onPress={() => navigation.navigate("Account")}
          accessibilityLabel={accountEmail ? "Account: " + accountEmail : "Account: accedi o registrati per salvare i dati"}
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: accountEmail ? "rgba(127,209,178,0.5)" : colors.border, backgroundColor: "rgba(0,0,0,0.25)" }}
        >
          {myName ? (
            <Avatar player={{ id: "me", name: myName, color: HOST_COLOR, status: "ready" }} size={34} />
          ) : (
            <Ionicons name="person-outline" size={20} color={colors.text} />
          )}
          {accountEmail ? (
            <View style={{ position: "absolute", right: -2, bottom: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.success, borderWidth: 2, borderColor: "#221D16", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="cloud-done" size={9} color="#13110E" />
            </View>
          ) : null}
        </Pressy>
        <View style={{ width: 8 }} />
        <IconButton name="time-outline" label="Storico e gruppi" onPress={() => navigation.navigate("Storico")} />
        <View style={{ width: 8 }} />
        <IconButton name="enter-outline" label="Entra in un tavolo con il codice" onPress={() => navigation.navigate("Join", {})} />
      </View>
  );

  // Finché non c'è un nome: chi entra nei tuoi tavoli vedrebbe "Tu"
  const nameBanner = myName ? null : (
    <FadeIn style={{ marginBottom: space.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: "rgba(221,183,101,0.35)", padding: 14 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="person-outline" size={20} color={colors.accent} />
        </View>
        <View style={{ flex: 1, marginLeft: 12, marginRight: 10 }}>
          <Text style={[type.bodyStrong, { color: colors.text }]}>Come ti chiamano al tavolo?</Text>
          <Text style={[type.caption, { color: colors.muted, fontWeight: "400" }]}>
            {legacyCount ? "Scrivi il nome che vuoi far vedere a tutti." : "Lo vedono tutti quando entrano nei tuoi tavoli."}
          </Text>
        </View>
        <Button label="Scegli" compact onPress={() => setAskName("profile")} />
      </View>
    </FadeIn>
  );

  // "Togli gli esempi": accanto ai tavoli aperti, oppure accanto alle serate passate se non ce ne sono
  const demoButton =
    hasDemos || demoEvenings ? (
      <Pressy
        onPress={() => setAskDemos(true)}
        accessibilityLabel="Togli gli esempi"
        hoverStyle={{ backgroundColor: colors.accentSoft }}
        style={{ flexDirection: "row", alignItems: "center", minHeight: 44, marginVertical: -14, marginRight: -10, paddingHorizontal: 10, borderRadius: radius.pill }}
      >
        <Ionicons name="close-circle-outline" size={16} color={colors.accent} />
        <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 13, marginLeft: 5 }}>Togli gli esempi</Text>
      </Pressy>
    ) : null;

  const sectionHead = (label: string, right: React.ReactNode) => (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, minHeight: 16 }}>
      <Text style={[type.label, { color: colors.muted }]}>{label}</Text>
      {right}
    </View>
  );

  const openTable = (t: Table) => navigation.navigate(tableRoute(t).name as any, tableRoute(t).params);

  const myTables = mine.length ? (
        <FadeIn>
          {sectionHead("Al tavolo adesso", null)}
          {mine.map((t) => (
            <TableCard key={t.id} table={t} onPress={() => openTable(t)} onDelete={() => setToDelete(t)} />
          ))}
        </FadeIn>
      ) : wide ? (
        <FadeIn>
          <Text style={[type.label, { color: colors.muted, marginBottom: 10 }]}>Al tavolo adesso</Text>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 20, alignItems: "center" }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <Ionicons name="albums-outline" size={24} color={colors.accent} />
            </View>
            <Text style={[type.heading, { color: colors.text, textAlign: "center" }]}>Nessun tavolo aperto</Text>
            <Text style={[type.caption, { color: colors.muted, textAlign: "center", marginTop: 4, fontWeight: "400" }]}>Scegli un gioco e crea il tavolo, oppure entra con un codice.</Text>
          </View>
        </FadeIn>
      ) : null;

  // Tavoli di esempio raccolti in un gruppo che si apre con un tocco
  const nDemos = openDemos.length;
  const demosGroup = nDemos ? (
    <FadeIn delay={40} style={{ marginTop: wide ? space.md : space.xl }}>
      {sectionHead("Esempi", demoButton)}
      <Pressy
        onPress={() => setDemosOpen((v) => !v)}
        accessibilityLabel={(demosOpen ? "Chiudi" : "Apri") + " gli esempi: " + (nDemos === 1 ? "1 tavolo" : nDemos + " tavoli")}
        hoverStyle={{ borderColor: "#4A4238" }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: "#4A4238",
          padding: 14,
          minHeight: 64,
          marginBottom: demosOpen ? 10 : 0,
        }}
      >
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="albums-outline" size={20} color={colors.accent} />
        </View>
        <View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
          <Text style={[type.bodyStrong, { color: colors.text }]}>{nDemos === 1 ? "1 tavolo di esempio" : nDemos + " tavoli di esempio"}</Text>
          <Text style={[type.caption, { color: colors.muted, fontWeight: "400" }]} numberOfLines={2}>
            {demosOpen ? "Tocca per chiuderli" : "Per provare l'app · tocca per vederli"}
          </Text>
        </View>
        <Ionicons name={demosOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.faint} />
      </Pressy>
      {demosOpen ? (
        <FadeIn>
          {openDemos.map((t) => (
            <TableCard key={t.id} table={t} demoBadge={false} onPress={() => openTable(t)} onDelete={() => setToDelete(t)} />
          ))}
        </FadeIn>
      ) : null}
    </FadeIn>
  ) : null;

  // Su schermo largo gli esempi stanno nella colonna dei tavoli; sul telefono sotto la scelta del gioco
  const openSection = (
    <>
      {myTables}
      {wide ? demosGroup : null}
    </>
  );

  const pickerSection = (
    <>
      <FadeIn delay={60} style={{ marginTop: mine.length && !wide ? space.xl : 0 }}>
        <Text style={[type.display, { color: colors.text }]}>A cosa giocate stasera?</Text>
        <Text style={[type.body, { color: colors.muted, marginTop: 6 }]}>Il gioco sceglie regole e grafica del tavolo.</Text>
      </FadeIn>

      <FadeIn delay={120} style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6, marginTop: space.lg }}>
        {GAMES.map((g) => (
          <View key={g.kind} style={{ width: (100 / cols + "%") as any, padding: 6 }}>
            <GameCard game={g} selected={g.kind === kind} onPress={() => setKind(g.kind)} chips={g.kind === "custom" ? cfgOf("custom").chips : undefined} />
          </View>
        ))}
      </FadeIn>
    </>
  );

  const settingsSection = (
    <>
      <View style={{ marginTop: space.lg }}>
        <RulesCard kind={kind} cfg={cfg} onChange={setCfg} />
      </View>
      <Text style={[type.caption, { color: colors.faint, marginTop: 8, textAlign: "center" }]}>Tocca una riga e scrivi il valore che vuoi</Text>
    </>
  );

  const pastSection = (
      <View style={{ marginTop: space.xl }}>
        {sectionHead("Serate passate", nDemos ? null : demoButton)}
        {past.map((t) => (
          <TableCard key={t.id} table={t} onPress={() => navigation.navigate("Settlement", { id: t.id })} />
        ))}
        <Pressy
          onPress={() => navigation.navigate("Storico")}
          accessibilityLabel="Apri lo storico e i gruppi"
          hoverStyle={{ borderColor: "#4A4238" }}
          style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, minHeight: 64 }}
        >
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="people-outline" size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[type.bodyStrong, { color: colors.text }]}>Storico e gruppi</Text>
            <Text style={[type.caption, { color: colors.muted }]}>{pastCount + past.length + " serate · chi è avanti nel tuo gruppo"}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </Pressy>
        <Pressy
          onPress={() => navigation.navigate("Account")}
          accessibilityLabel={accountEmail ? "Apri l'account" : "Salva i tuoi dati: accedi o registrati"}
          hoverStyle={{ borderColor: "#4A4238" }}
          outerStyle={{ marginTop: 10 }}
          style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: accountEmail ? colors.border : "rgba(221,183,101,0.35)", padding: 14, minHeight: 64 }}
        >
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: accountEmail ? colors.successSoft : colors.accentSoft, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={accountEmail ? "cloud-done-outline" : "cloud-upload-outline"} size={20} color={accountEmail ? colors.success : colors.accent} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[type.bodyStrong, { color: colors.text }]}>{accountEmail ? "Account" : "Salva i tuoi dati"}</Text>
            <Text style={[type.caption, { color: colors.muted }]} numberOfLines={1}>
              {accountEmail
                ? (accountStatus === "error" ? "Non salvato · " : accountStatus === "saving" ? "Salvataggio… · " : "Salvato · ") + accountEmail
                : "Registrati o accedi: li ritrovi su ogni telefono"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </Pressy>
      </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#221D16", paddingTop: insets.top }}>
    <Screen scroll gradient={["#221D16", colors.bg]} maxWidth={wide ? 1120 : undefined} footer={footer}>
      {header}
      {nameBanner}
      {wide ? (
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View style={{ width: LEFT_W, marginRight: GAP }}>
            {openSection}
            {pastSection}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            {pickerSection}
            {settingsSection}
          </View>
        </View>
      ) : (
        <>
          {openSection}
          {pickerSection}
          {settingsSection}
          {demosGroup}
          {pastSection}
        </>
      )}

      <ConfirmSheet
        visible={!!toDelete}
        title="Eliminare il tavolo?"
        subtitle={toDelete ? toDelete.name + " · " + statusOf(toDelete).label : undefined}
        lines={toDelete ? deleteLines(toDelete) : []}
        confirmLabel="Elimina il tavolo"
        onConfirm={deleteNow}
        onClose={() => setToDelete(null)}
      />
      <NameSheet
        visible={!!askName}
        onClose={() => setAskName(null)}
        title={myName ? "Il tuo nome" : "Come ti chiamano al tavolo?"}
        subtitle={
          askName === "create"
            ? "Sei l'host: gli altri ti vedono con questo nome."
            : legacyCount
            ? "Lo metto anche al posto di \u00AB" + LEGACY_HOST + "\u00BB nei tavoli che hai creato."
            : "Lo cambio anche nei tavoli aperti in cui sei seduto con questo telefono."
        }
        initial={myName}
        saveLabel={askName === "create" ? "Salva e continua" : "Salva il nome"}
        onSave={saveName}
      />
      <ConfirmSheet
        visible={askDemos}
        title="Togliere gli esempi?"
        subtitle="Tavoli e serate creati al primo avvio per mostrarti l'app"
        lines={demoLines()}
        confirmLabel="Sì, togli tutti gli esempi"
        onConfirm={removeDemosNow}
        onClose={() => setAskDemos(false)}
      />
    </Screen>
    </View>
  );
}
