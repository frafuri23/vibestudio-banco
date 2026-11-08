import React, { useEffect, useState } from "react";
import { Platform, Share, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FadeIn, Screen, TopBar } from "../components/Screen";
import { Button, Pressy, tap } from "../components/Pressy";
import { Avatar } from "../components/Avatar";
import { toast } from "../components/Toast";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { Sheet } from "../components/Sheet";
import { useStore, useTable } from "../lib/store";
import { copyText, webShare } from "../lib/clipboard";
import { endNight, hasOwnPhone, paymentRights, reopen, setPaymentStatus, settlementInfo } from "../lib/rules";
import { gameOf } from "../lib/games";
import { duration, fmtEuro, fmtNum } from "../lib/format";
import { ScreenProps } from "../lib/nav";
import { colors, radius, type } from "../lib/theme";

export default function SettlementScreen({ navigation, route }: ScreenProps<"Settlement">) {
  const table = useTable(route.params?.id);
  const apply = useStore((s) => s.apply);
  const [err, setErr] = useState<string | null>(null);
  // Pagamento di un altro giocatore di cui l'host sta per togliere la conferma
  const [undoIdx, setUndoIdx] = useState<number | null>(null);
  const [askClose, setAskClose] = useState(false);
  // Riepilogo da copiare a mano, quando né condivisione né appunti sono disponibili
  const [shareText, setShareText] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (table && !table.endedAt && table.status !== "closed") {
      const r = apply(table.id, (t) => endNight(t));
      if (r.error) setErr(r.error);
    }
  }, [table?.id]);

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
  const money = table.buyinCents > 0;
  const { rows, naive } = settlementInfo(table);
  const payments = table.payments || [];
  const paid = payments.filter((p) => p.status === "received").length;
  const pl = (id: string) => table.players.find((p) => p.id === id);
  const nm = (id: string) => pl(id)?.name || "?";
  const totalBuyins = rows.reduce((s, r) => s + r.buyins, 0);
  const elapsed = (table.endedAt || Date.now()) - table.createdAt;
  const subtitle =
    table.kind === "tombola"
      ? table.name + " · " + duration(elapsed)
      : money
      ? table.name + " · " + duration(elapsed) + " · " + totalBuyins + " buy-in (" + fmtEuro(totalBuyins * table.buyinCents).replace(",00", "") + ")"
      : table.name + " · " + duration(elapsed);

  const copyOrShow = async (text: string) => {
    if (await copyText(text)) {
      tap("success");
      toast.ok("Riepilogo copiato: incollalo nella chat del gruppo");
    } else {
      setShareText(text);
    }
  };

  const share = async () => {
    const lines = [
      "Banco · " + table.name,
      ...rows.map((r, i) => i + 1 + ". " + nm(r.pid) + "  " + (money ? fmtEuro(r.cents, true) : fmtNum(r.balance))),
      ...(payments.length ? ["", "Chi paga chi:", ...payments.map((p) => nm(p.from) + " \u2192 " + nm(p.to) + ": " + fmtEuro(p.cents) + (p.status === "received" ? " (pagato)" : ""))] : []),
    ];
    const text = lines.join("\n");
    try {
      if (Platform.OS === "web") {
        // Sul web: condivisione del browser se c'è, altrimenti (es. sul computer) si copia
        const r = await webShare(text, "Banco · " + table.name);
        if (r !== "unavailable") return;
        return await copyOrShow(text);
      }
      await Share.share({ message: text });
    } catch {
      await copyOrShow(text);
    }
  };

  if (err && !table.endedAt) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <Screen>
        <TopBar title="Non ancora" onBack={() => navigation.goBack()} />
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 18, marginTop: 10 }}>
          <Ionicons name="alert-circle-outline" size={26} color={colors.warn} />
          <Text style={[type.heading, { color: colors.text, marginTop: 8 }]}>{err}</Text>
          <Text style={[type.body, { color: colors.muted, marginTop: 6 }]}>Chiudi il gioco in corso e poi torna qui: i conti si fanno da soli.</Text>
          <View style={{ height: 14 }} />
          <Button label="Torna al tavolo" onPress={() => navigation.goBack()} />
        </View>
      </Screen>
      </View>
    );
  }

  const closed = table.status === "closed";

  const setPaid = (idx: number, received: boolean) => {
    const r = apply(table.id, (t) => setPaymentStatus(t, idx, received));
    if (r.error) {
      tap("error");
      return toast.error(r.error);
    }
    if (received) tap("success");
  };
  const undoPay = undoIdx !== null ? payments[undoIdx] : undefined;
  const undoName = undoPay ? pl(undoPay.to)?.name || "chi riceve" : "";

  // I pagamenti che riguardano chi tiene questo telefono (li fa o li riceve) vanno in cima.
  // Si tiene l'indice vero: è quello che usano le regole e il server.
  const involvesMe = (p: (typeof payments)[number]) => p.from === table.me || p.to === table.me;
  const ordered = payments.map((p, i) => ({ p, i })).sort((a, b) => Number(involvesMe(b.p)) - Number(involvesMe(a.p)));

  // Chiusura del tavolo: prima si dice cosa manca ancora
  const pending = payments.filter((p) => p.status !== "received");
  const pendingCents = pending.reduce((s, p) => s + p.cents, 0);
  const waitingFor: string[] = Array.from(new Set<string>(pending.map((p) => nm(p.to))));
  const confirmHere = pending.filter((p) => paymentRights(table, p).confirm).length;
  const listNames = (a: string[]) => (a.length <= 1 ? a[0] || "" : a.slice(0, -1).join(", ") + " e " + a[a.length - 1]);
  const closeLines = pending.length
    ? [
        (pending.length === 1 ? "C'\u00E8 ancora 1 pagamento in attesa" : "Ci sono ancora " + pending.length + " pagamenti in attesa") + ", per " + fmtEuro(pendingCents) + ".",
        (waitingFor.length > 1 ? "Devono" : "Deve") + " ancora confermare: " + listNames(waitingFor) + ".",
        ...(confirmHere ? [confirmHere === 1 ? "Uno lo puoi segnare da qui con \u00ABSegna ricevuto\u00BB." : confirmHere + " li puoi segnare da qui con \u00ABSegna ricevuto\u00BB."] : []),
        "Puoi chiudere lo stesso: il tavolo passa tra le serate passate.",
      ]
    : [
        payments.length ? "Tutti i pagamenti sono confermati." : money ? "Nessuno deve niente a nessuno." : "La classifica resta tra le serate passate.",
        "Il tavolo passa tra le serate passate e non si riapre per giocare.",
      ];

  const closeNow = () => {
    setAskClose(false);
    const r = apply(table.id, (t) => ({ ...t, status: "closed" as const }));
    if (r.error) {
      tap("error");
      return toast.error(r.error);
    }
    tap("success");
    toast.ok("Tavolo chiuso. Alla prossima!");
    navigation.navigate("Home");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#221D16", paddingTop: insets.top }}>
    <Screen
      scroll
      gradient={["#221D16", colors.bg]}
      footer={
        <View style={{ flexDirection: "row" }}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Button label="Condividi" icon="share-outline" variant="ghost" onPress={share} />
          </View>
          <View style={{ flex: 1.2 }}>
            {closed ? (
              <Button label="Torna alla home" onPress={() => navigation.navigate("Home")} />
            ) : (
              <Button label="Chiudi il tavolo" onPress={() => setAskClose(true)} />
            )}
          </View>
        </View>
      }
    >
      <TopBar
        onBack={() => navigation.goBack()}
        right={
          money ? (
            <View style={{ backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 }}>
              <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 13 }}>
                {table.kind === "tombola" ? "Montepremi in euro" : fmtNum(table.buyinUnits) + " fiches = " + fmtEuro(table.buyinCents).replace(",00", "")}
              </Text>
            </View>
          ) : null
        }
      />
      <FadeIn>
        <Text style={[type.display, { color: colors.text }]}>{money ? "Fine serata" : "Classifica"}</Text>
        <Text style={[type.caption, { color: colors.muted, marginTop: 6, fontWeight: "400" }]}>{subtitle}</Text>
      </FadeIn>

      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, marginTop: 16 }}>
        {rows.map((r, i) => {
          const pos = money ? r.cents : r.balance;
          const color = !money ? colors.text : r.cents > 0 ? colors.success : r.cents < 0 ? colors.danger : colors.muted;
          const detail = table.kind === "tombola" ? "speso " + fmtEuro(r.bought) + " · vinto " + fmtEuro(r.balance) : money ? r.buyins + " buy-in · " + fmtNum(r.balance) + " fiches" : "soldi del gioco";
          return (
            <View key={r.pid} style={{ flexDirection: "row", alignItems: "center", minHeight: 66, borderTopWidth: i ? 1 : 0, borderTopColor: colors.hairline }}>
              <Text style={[type.number, { color: i === 0 ? colors.accent : colors.muted, width: 22, fontSize: 17 }]}>{i + 1}</Text>
              <Avatar player={pl(r.pid)} size={38} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[type.bodyStrong, { color: colors.text }]} numberOfLines={1}>
                  {nm(r.pid)}
                </Text>
                <Text style={[type.caption, { color: colors.muted, fontWeight: "400" }]} numberOfLines={1}>
                  {detail}
                </Text>
              </View>
              <Text style={[type.number, { color, fontSize: 21 }]}>{money ? fmtEuro(pos, true) : fmtNum(pos)}</Text>
            </View>
          );
        })}
      </View>

      {money ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 26 }}>
            <Text style={[type.section, { color: colors.text }]}>Chi paga chi</Text>
            {payments.length ? <Text style={[type.caption, { color: colors.muted }]}>{paid + " di " + payments.length + " saldati"}</Text> : null}
          </View>
          <Text style={[type.caption, { color: colors.muted, marginTop: 4, marginBottom: 12, fontWeight: "400" }]}>
            {payments.length === 0
              ? "Nessuno deve niente a nessuno: pari!"
              : naive > payments.length
              ? "Il minimo dei pagamenti possibili: " + payments.length + " invece di " + naive + "."
              : "Il minimo dei pagamenti possibili."}
          </Text>
          {ordered.map(({ p, i }) => {
            const done = p.status === "received";
            const toMe = p.to === table.me;
            const myTurn = !done && involvesMe(p);
            const rights = paymentRights(table, p);
            const canTap = done ? rights.undo : rights.confirm;
            const receiver = pl(p.to)?.name || "?";
            const hint = done ? null : rights.forOther ? "Non ha il telefono: confermi tu" : !rights.confirm ? "Conferma " + receiver + " quando li riceve" : null;
            // Togliere la conferma data da un altro telefono: chiede prima, perché poi la può ridare solo lui
            const askFirst = done && !toMe && !!table.online && hasOwnPhone(table, p.to);
            return (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", backgroundColor: myTurn ? "#231F18" : colors.surface, borderRadius: radius.lg, borderWidth: myTurn ? 1.5 : 1, borderColor: myTurn ? colors.accent : colors.border, padding: 14, marginBottom: 10 }}>
                <Avatar player={pl(p.from)} size={32} />
                <Ionicons name="arrow-forward" size={14} color={colors.muted} style={{ marginHorizontal: 5 }} />
                <Avatar player={pl(p.to)} size={32} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  {myTurn ? (
                    <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 4 }}>
                      <Ionicons name={toMe ? "arrow-down" : "arrow-up"} size={11} color={colors.accent} style={{ marginRight: 4 }} />
                      <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "800", letterSpacing: 0.4 }}>Tocca a te</Text>
                    </View>
                  ) : null}
                  <Text style={[type.caption, { color: colors.muted, fontWeight: "400" }]} numberOfLines={1}>
                    {p.from === table.me ? "Paghi a " + nm(p.to) : nm(p.from) + " paga a " + (toMe ? "te" : nm(p.to))}
                  </Text>
                  <Text style={[type.number, { color: colors.text, fontSize: 22 }]}>{fmtEuro(p.cents)}</Text>
                  {hint ? (
                    <Text style={[type.caption, { color: rights.forOther ? colors.accent : colors.faint, fontWeight: "400", marginTop: 1 }]} numberOfLines={2}>
                      {hint}
                    </Text>
                  ) : null}
                </View>
                {canTap ? (
                  <Pressy
                    onPress={() => (done ? (askFirst ? setUndoIdx(i) : setPaid(i, false)) : setPaid(i, true))}
                    accessibilityLabel={done ? "Pagato. Tocca per segnarlo come non pagato" : rights.forOther ? "Segna ricevuto al posto di " + receiver : "Segna ricevuto"}
                    style={{ flexDirection: "row", alignItems: "center", borderRadius: radius.pill, paddingHorizontal: 12, minHeight: 44, borderWidth: done ? 0 : 1.5, borderColor: colors.accent, backgroundColor: done ? colors.successSoft : "transparent" }}
                  >
                    {done ? <Ionicons name="checkmark" size={16} color={colors.success} style={{ marginRight: 4 }} /> : null}
                    <Text style={{ color: done ? colors.success : colors.accent, fontWeight: "700", fontSize: 13.5 }}>{done ? "Pagato" : "Segna ricevuto"}</Text>
                  </Pressy>
                ) : done ? (
                  <View accessible accessibilityLabel={"Pagato, confermato da " + receiver} style={{ flexDirection: "row", alignItems: "center", borderRadius: radius.pill, paddingHorizontal: 12, minHeight: 40, backgroundColor: colors.successSoft }}>
                    <Ionicons name="checkmark" size={16} color={colors.success} style={{ marginRight: 4 }} />
                    <Text style={{ color: colors.success, fontWeight: "700", fontSize: 13.5 }}>Pagato</Text>
                  </View>
                ) : (
                  <View
                    accessible
                    accessibilityLabel={"In attesa che " + receiver + " confermi"}
                    style={{ flexDirection: "row", alignItems: "center", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6, minHeight: 40, maxWidth: 128, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elevated }}
                  >
                    <Ionicons name="hourglass-outline" size={14} color={colors.muted} style={{ marginRight: 5 }} />
                    <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 12.5, flexShrink: 1 }} numberOfLines={2}>
                      In attesa di conferma
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
          <Text style={[type.caption, { color: colors.muted, marginTop: 6, fontWeight: "400" }]}>
            L'app tiene i conti, non i soldi: si paga in contanti, con PayPal o Satispay. Conferma chi riceve; per chi non ha il telefono conferma l'host.
          </Text>
        </>
      ) : (
        <Text style={[type.caption, { color: colors.muted, marginTop: 14, fontWeight: "400" }]}>{g.title + ": qui si gioca con i soldi del gioco, niente da saldare in euro."}</Text>
      )}

      {!closed ? (
        <Pressy
          onPress={() => {
            apply(table.id, (t) => reopen(t));
            navigation.replace(g.route, { id: table.id });
          }}
          style={{ alignSelf: "center", marginTop: 18, flexDirection: "row", alignItems: "center", padding: 10 }}
        >
          <Ionicons name="play-back-outline" size={16} color={colors.muted} />
          <Text style={[type.caption, { color: colors.muted, marginLeft: 6 }]}>Riapri e continua a giocare</Text>
        </Pressy>
      ) : null}

      <ConfirmSheet
        visible={!!undoPay}
        title="Togliere la conferma?"
        subtitle={undoPay ? nm(undoPay.from) + " \u2192 " + undoName + " \u00B7 " + fmtEuro(undoPay.cents) : undefined}
        lines={["Il pagamento torna \u00ABin attesa\u00BB.", "Poi lo pu\u00F2 confermare di nuovo solo " + undoName + ", dal suo telefono."]}
        confirmLabel="Togli la conferma"
        icon="arrow-undo-outline"
        firstIcon="arrow-undo-outline"
        cancelLabel="Lascia pagato"
        onConfirm={() => {
          const i = undoIdx;
          setUndoIdx(null);
          if (i !== null) setPaid(i, false);
        }}
        onClose={() => setUndoIdx(null)}
      />
      <ConfirmSheet
        visible={askClose}
        title="Chiudere il tavolo?"
        subtitle={table.name}
        lines={closeLines}
        confirmLabel={pending.length ? "Chiudi lo stesso" : "Chiudi il tavolo"}
        cancelLabel={pending.length ? "Aspetta le conferme" : "Non ancora"}
        icon="lock-closed-outline"
        firstIcon={pending.length ? "hourglass-outline" : "checkmark-done-outline"}
        firstColor={pending.length ? colors.warn : colors.success}
        variant="primary"
        onConfirm={closeNow}
        onClose={() => setAskClose(false)}
      />
      <Sheet visible={!!shareText} onClose={() => setShareText(null)} title="Riepilogo della serata" subtitle="Selezionalo e copialo dove vuoi">
        <View style={{ backgroundColor: colors.elevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14, marginTop: 4 }}>
          <Text selectable style={[type.body, { color: colors.text }]}>
            {shareText || ""}
          </Text>
        </View>
        <View style={{ height: 14 }} />
        <Button label="Fatto" variant="ghost" onPress={() => setShareText(null)} />
      </Sheet>
    </Screen>
    </View>
  );
}
