import React, { useMemo, useState } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FadeIn, Screen, TopBar } from "../components/Screen";
import { Button, Pressy, tap } from "../components/Pressy";
import { Avatar } from "../components/Avatar";
import { toast } from "../components/Toast";
import { useStore, useTable } from "../lib/store";
import { names, pokerAward } from "../lib/engine";
import { computePots, firstLeftOfDealer, replay, splitPot } from "../lib/poker";
import { fmtNum } from "../lib/format";
import { ScreenProps } from "../lib/nav";
import { colors, radius, type } from "../lib/theme";

function joinNames(list: string[]): string {
  if (list.length <= 1) return list.join("");
  return list.slice(0, -1).join(", ") + " e " + list[list.length - 1];
}

export default function ShowdownScreen({ navigation, route }: ScreenProps<"Showdown">) {
  const table = useTable(route.params?.id);
  const apply = useStore((s) => s.apply);
  const [sel, setSel] = useState<Record<number, string[]>>({});
  const insets = useSafeAreaInsets();
  const hand = table?.poker?.hand || null;
  const nm = useMemo(() => (table ? names(table) : {}), [table?.players]);
  const view = useMemo(() => (hand ? replay(hand, nm) : null), [hand, nm]);
  const pots = useMemo(() => (hand && view ? computePots(hand.seats, view.total, view.folded) : []), [hand, view]);

  if (!table || !hand || !view) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <Screen>
          <TopBar title="Nessuna mano da chiudere" onBack={() => navigation.goBack()} />
        </Screen>
      </View>
    );
  }

  const unit = Math.min(...table.chips.map((c) => c.value), 25);
  const label = (pid: string) => nm[pid] || "?";
  const winnersOf = (i: number) => (pots[i].eligible.length === 1 ? pots[i].eligible : sel[i] || []);
  const splits = pots.map((p, i) => splitPot(p.amount, winnersOf(i), hand.seats, hand.dealer, unit));
  const totals: Record<string, number> = {};
  splits.forEach((s) => Object.keys(s).forEach((k) => (totals[k] = (totals[k] || 0) + (s[k] || 0))));
  const complete = pots.every((_, i) => winnersOf(i).length > 0);
  const totalPot = pots.reduce((s, p) => s + p.amount, 0);

  const toggle = (i: number, pid: string) => {
    tap("light");
    setSel((prev) => {
      const cur = prev[i] || [];
      const on = cur.includes(pid);
      const next = { ...prev, [i]: on ? cur.filter((x) => x !== pid) : [...cur, pid] };
      if (!on) {
        // chi vince il piatto principale di solito vince anche i laterali in cui \u00E8 dentro
        for (let k = i + 1; k < pots.length; k++) if (pots[k].eligible.includes(pid) && !(next[k] || []).length) next[k] = [pid];
      }
      return next;
    });
  };

  const assign = () => {
    const r = apply(table.id, (t) => pokerAward(t, totals));
    if (r.error) return toast.error(r.error);
    tap("success");
    toast.ok("Assegnate " + fmtNum(totalPot) + " fiches");
    navigation.goBack();
  };

  const summary = Object.keys(totals)
    .filter((k) => (totals[k] || 0) > 0)
    .sort((a, b) => totals[b] - totals[a])
    .map((k) => label(k) + " +" + fmtNum(totals[k]))
    .join(" · ");

  return (
    <View style={{ flex: 1, backgroundColor: "#1B2A23", paddingTop: insets.top }}>
    <Screen
      scroll
      gradient={["#1B2A23", colors.bg]}
      footer={
        <>
          {summary ? (
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
              <Text style={[type.caption, { color: colors.muted }]}>Riceveranno</Text>
              <Text style={[type.bodyStrong, { color: colors.success, flex: 1, textAlign: "right", marginLeft: 12 }]} numberOfLines={2}>
                {summary}
              </Text>
            </View>
          ) : null}
          <Button label={complete ? "Assegna " + fmtNum(totalPot) + " fiches" : "Tocca chi ha vinto"} onPress={assign} disabled={!complete} />
        </>
      }
    >
      <TopBar subtitle={"Mano " + hand.number + " · showdown · dealer " + label(hand.dealer)} onBack={() => navigation.goBack()} />
      <FadeIn>
        <Text style={[type.display, { color: colors.text }]}>Chi ha vinto?</Text>
        <Text style={[type.body, { color: colors.muted, marginTop: 4 }]}>Tocca chi ha vinto: se sono di più, si divide.</Text>
      </FadeIn>

      {/* Riepilogo delle puntate: una riga compatta che scorre di lato */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={Platform.OS === "web"}
        style={{ marginHorizontal: -20, marginTop: 12 }}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {hand.seats.map((pid) => {
          const st = view.folded.has(pid) ? "fold" : view.allIn.has(pid) ? "all-in" : "in gioco";
          return (
            <View
              key={pid}
              accessible
              accessibilityLabel={label(pid) + ": " + fmtNum(view.total[pid] || 0) + ", " + st}
              style={{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 6, marginHorizontal: 4, minWidth: 74, opacity: st === "fold" ? 0.7 : 1 }}
            >
              <Text style={[type.caption, { color: colors.muted, fontSize: 12, lineHeight: 15 }]} numberOfLines={1}>
                {label(pid)}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                <Text style={[type.number, { color: colors.text, fontSize: 17, lineHeight: 21 }]}>{fmtNum(view.total[pid] || 0)}</Text>
                <Text style={{ fontSize: 11.5, fontWeight: "700", marginLeft: 6, color: st === "all-in" ? colors.danger : colors.faint }}>{st}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {pots.map((p, i) => {
        const winners = winnersOf(i);
        const split = splits[i];
        const lucky = winners.length > 1 ? firstLeftOfDealer(winners, hand.seats, hand.dealer) : null;
        const extra = lucky ? (split[lucky] || 0) - Math.min(...winners.map((w) => split[w] || 0)) : 0;
        const single = p.eligible.length === 1;
        const foldedIn = hand.seats.filter((s) => view.folded.has(s) && (view.total[s] || 0) > 0);
        const desc = single
          ? "Nessuno ha coperto la puntata: torna a " + label(p.eligible[0]) + "."
          : i === 0
          ? joinNames(p.eligible.map(label)) + "." + (foldedIn.length ? " Dentro anche le fiches di " + joinNames(foldedIn.map(label)) + "." : "")
          : "Solo " + joinNames(p.eligible.map(label)) + ": chi \u00E8 andato all-in prima non partecipa.";
        return (
          <View key={i} style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, marginTop: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
              <Text style={[type.section, { color: colors.text }]}>{i === 0 ? "Piatto principale" : single ? "Restituito" : "Piatto laterale" + (pots.length > 2 ? " " + i : "")}</Text>
              <Text style={[type.number, { color: colors.accent, fontSize: 26, lineHeight: 30 }]}>{fmtNum(p.amount)}</Text>
            </View>
            <Text style={[type.caption, { color: colors.muted, marginTop: 2, fontWeight: "400" }]}>{desc}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, marginTop: 6 }}>
              {p.eligible.map((pid) => {
                const on = winners.includes(pid);
                const pl = table.players.find((x) => x.id === pid);
                return (
                  <View key={pid} style={{ width: p.eligible.length >= 3 ? "33.33%" : "50%", padding: 4 }}>
                    <Pressy
                      disabled={single}
                      onPress={() => toggle(i, pid)}
                      role="checkbox"
                      checked={on}
                      accessibilityLabel={"Vince " + label(pid) + (on ? ", " + fmtNum(split[pid] || 0) : "")}
                      style={{ borderRadius: radius.md, borderWidth: 2, borderColor: on ? colors.accent : colors.border, backgroundColor: on ? "#352C1F" : colors.bg, paddingVertical: 7, paddingHorizontal: 4, alignItems: "center" }}
                    >
                      <Avatar player={pl} size={28} />
                      <Text style={[type.bodyStrong, { color: colors.text, marginTop: 3, fontSize: 14, lineHeight: 17 }]} numberOfLines={1}>
                        {label(pid)}
                      </Text>
                      <Text style={[type.number, { color: on ? colors.accent : colors.faint, fontSize: 17, lineHeight: 20 }]}>{on ? fmtNum(split[pid] || 0) : "\u2013"}</Text>
                    </Pressy>
                  </View>
                );
              })}
            </View>
            {lucky && extra > 0 ? (
              <View style={{ flexDirection: "row", backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: 10, marginTop: 6 }}>
                <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
                <Text style={[type.caption, { color: colors.text, marginLeft: 8, flex: 1, fontWeight: "400" }]}>
                  {"+" + fmtNum(extra) + " a " + label(lucky) + ": la fiche che avanza va al primo vincitore a sinistra del dealer."}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </Screen>
    </View>
  );
}
