import React, { useMemo } from "react";
import { FlatList, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { TopBar, EmptyState } from "../components/Screen";
import { Pressy, tap } from "../components/Pressy";
import { Avatar } from "../components/Avatar";
import { accName } from "../components/RecentMoves";
import { toast } from "../components/Toast";
import { useStore, useTable } from "../lib/store";
import { undoEntry } from "../lib/engine";
import { balances, BANK, POT, undoneIds } from "../lib/ledger";
import { fmtNum, timeAgo } from "../lib/format";
import { ScreenProps } from "../lib/nav";
import { colors, MAX_W, radius, type } from "../lib/theme";
import { useChrome } from "../lib/chrome";
import { Entry, Table } from "../lib/types";

const KIND: Record<string, string> = { buyin: "Buy-in", bet: "Puntata", win: "Vincita", pay: "Pagamento", prize: "Premio", lap: "Giro", undo: "Annullamento" };

function canUndo(t: Table, e: Entry, undone: Set<string>): boolean {
  if (e.kind === "undo" || undone.has(e.id)) return false;
  if (t.kind === "poker" && (e.kind === "bet" || e.kind === "win")) return false; // si annullano dal tavolo
  if (t.kind === "tombola") return false; // cartelle e premi si gestiscono dalla tombola
  if (e.kind === "buyin" && t.status === "playing" && t.kind !== "bank") return true;
  return true;
}

export default function RegistroScreen({ navigation, route }: ScreenProps<"Registro">) {
  const table = useTable(route.params?.id);
  const apply = useStore((s) => s.apply);
  const insets = useSafeAreaInsets();
  useChrome(colors.bg);
  const data = useMemo(() => (table ? [...table.entries].reverse() : []), [table?.entries]);
  const undone = useMemo(() => (table ? undoneIds(table.entries) : new Set<string>()), [table?.entries]);
  const bal = useMemo(() => (table ? balances(table.entries) : {}), [table?.entries]);

  if (!table) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top, paddingHorizontal: 20 }}>
        <TopBar title="Tavolo non trovato" onBack={() => navigation.goBack()} />
      </View>
    );
  }

  const unit = table.kind === "tombola" ? "cent." : table.kind === "bank" ? "" : "fiches";

  const header = (
    <View>
      <TopBar title="Registro" subtitle={table.name + " · " + table.entries.length + " righe"} onBack={() => navigation.goBack()} />
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14 }}>
        <Text style={[type.label, { color: colors.muted, marginBottom: 10 }]}>Saldi = somma delle righe</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {table.players.map((p) => (
            <View key={p.id} style={{ flexDirection: "row", alignItems: "center", width: "50%", paddingVertical: 5 }}>
              <Avatar player={p} size={26} />
              <Text style={[type.caption, { color: colors.text, marginLeft: 8, flex: 1 }]} numberOfLines={1}>
                {accName(table, p.id)}
              </Text>
              <Text style={[type.bodyStrong, { color: colors.text, marginRight: 12 }]}>{fmtNum(bal[p.id] || 0)}</Text>
            </View>
          ))}
          {bal[POT] ? (
            <View style={{ flexDirection: "row", alignItems: "center", width: "50%", paddingVertical: 5 }}>
              <Ionicons name="ellipse" size={22} color={colors.accent} />
              <Text style={[type.caption, { color: colors.text, marginLeft: 10, flex: 1 }]}>Piatto</Text>
              <Text style={[type.bodyStrong, { color: colors.accent, marginRight: 12 }]}>{fmtNum(bal[POT] || 0)}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Text style={[type.caption, { color: colors.faint, marginTop: 10, marginBottom: 14, fontWeight: "400" }]}>
        Il registro si allunga e basta: annullare aggiunge la riga inversa, così resta tutto visibile a tutti.
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <FlatList
        data={data}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={header}
        ListEmptyComponent={<EmptyState icon="list-outline" title="Ancora nessun movimento" body="Buy-in, puntate e pagamenti compariranno qui, uno per riga." />}
        contentContainerStyle={{ width: "100%", maxWidth: MAX_W, alignSelf: "center", paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}
        renderItem={({ item: e }) => {
          const isUndone = undone.has(e.id);
          const isUndo = e.kind === "undo";
          return (
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, opacity: isUndone ? 0.5 : 1 }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: isUndo ? colors.dangerSoft : e.from === BANK ? colors.accentSoft : colors.elevated }}>
                <Ionicons name={isUndo ? "arrow-undo" : e.from === BANK ? "add" : e.to === POT ? "arrow-down" : "swap-horizontal"} size={16} color={isUndo ? colors.danger : colors.accent} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[type.bodyStrong, { color: colors.text, textDecorationLine: isUndone ? "line-through" : "none" }]} numberOfLines={1}>
                  {accName(table, e.from) + " → " + accName(table, e.to)}
                </Text>
                <Text style={[type.caption, { color: colors.muted, fontWeight: "400" }]} numberOfLines={1}>
                  {(e.note || KIND[e.kind]) + " · " + timeAgo(e.ts) + (isUndone ? " · annullato" : "")}
                </Text>
              </View>
              <Text style={[type.number, { color: colors.text, fontSize: 17, marginLeft: 8 }]}>{fmtNum(e.amount) + (unit ? " " : "")}</Text>
              {canUndo(table, e, undone) ? (
                <Pressy
                  onPress={() => {
                    const r = apply(table.id, (t) => undoEntry(t, e.id));
                    if (r.error) {
                      tap("error");
                      toast.error(r.error);
                    } else toast.ok("Riga annullata");
                  }}
                  accessibilityLabel="Annulla questa riga"
                  style={{ marginLeft: 10, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.elevated }}
                >
                  <Ionicons name="arrow-undo-outline" size={16} color={colors.accent} />
                </Pressy>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}
