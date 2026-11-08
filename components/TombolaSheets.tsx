import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Sheet } from "./Sheet";
import { Avatar } from "./Avatar";
import { Button, IconButton, Pressy } from "./Pressy";
import { Player, Table } from "../lib/types";
import { colors, radius, type } from "../lib/theme";
import { fmtEuro } from "../lib/format";

const INK = "#1E1A15";
const MUTED = "#6B6255";

export function WinnerSheet({ visible, onClose, table, prizeLabel, amount, onAssign }: { visible: boolean; onClose: () => void; table: Table; prizeLabel: string; amount: number; onAssign: (ids: string[]) => void }) {
  const [sel, setSel] = useState<string[]>([]);
  useEffect(() => {
    if (visible) setSel([]);
  }, [visible]);
  const share = sel.length ? Math.floor(amount / sel.length) : 0;
  return (
    <Sheet visible={visible} onClose={onClose} title={"Chi ha fatto " + prizeLabel.toLowerCase() + "?"} subtitle="Se sono di più, il premio si divide a parti uguali" light>
      {table.players.map((p) => {
        const on = sel.includes(p.id);
        const who = p.name;
        return (
          <Pressy
            key={p.id}
            role="checkbox"
            checked={on}
            accessibilityLabel={who + (on ? ", quota " + fmtEuro(share) : "")}
            onPress={() => setSel((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))}
            style={{ flexDirection: "row", alignItems: "center", minHeight: 58, borderRadius: radius.md, paddingHorizontal: 12, marginBottom: 8, backgroundColor: on ? "#F3E6CC" : "#FFFFFF", borderWidth: 1.5, borderColor: on ? "#B98A2E" : "#E9E1D2" }}
          >
            <Avatar player={p} size={36} />
            <Text style={[type.bodyStrong, { color: INK, marginLeft: 12, flex: 1 }]} numberOfLines={1}>
              {p.name}
            </Text>
            {on ? <Text style={[type.bodyStrong, { color: "#2F6B4F", marginRight: 10 }]}>{fmtEuro(share)}</Text> : null}
            <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={24} color={on ? "#2F6B4F" : "#C9BFAE"} />
          </Pressy>
        );
      })}
      <View style={{ height: 8 }} />
      <Button label={sel.length ? "Assegna " + fmtEuro(amount) : "Scegli chi ha vinto"} disabled={!sel.length} onPress={() => onAssign(sel)} accent="#A8352B" ink="#FFFFFF" />
      {sel.length > 1 && amount - share * sel.length > 0 ? (
        <Text style={[type.caption, { color: MUTED, marginTop: 10, textAlign: "center", fontWeight: "400" }]}>
          {"Avanzano " + (amount - share * sel.length) + " centesimi: passano al premio dopo."}
        </Text>
      ) : null}
    </Sheet>
  );
}

export function CardsSheet({ player, table, onClose, onAdd, onRemove, locked, onRename }: { player: Player | null; table: Table; onClose: () => void; onAdd: () => void; onRemove: () => void; locked: boolean; onRename?: () => void }) {
  const n = player ? table.tombola?.cards[player.id] || 0 : 0;
  return (
    <Sheet visible={!!player} onClose={onClose} title={player ? (player.id === table.me ? "Le tue cartelle" : "Cartelle di " + player.name) : ""} subtitle={locked ? "Il primo premio è uscito: le cartelle sono chiuse" : fmtEuro(table.tombola?.priceCents || 100) + " l'una"} light>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12 }}>
        <IconButton name="remove" label="Togli una cartella" onPress={onRemove} size={52} color={INK} bg="#FFFFFF" border="#E4DCCD" />
        <View style={{ alignItems: "center", marginHorizontal: 28 }}>
          <Text style={[type.number, { color: INK, fontSize: 48 }]}>{n}</Text>
          <Text style={[type.caption, { color: MUTED }]}>{fmtEuro(n * (table.tombola?.priceCents || 100))}</Text>
        </View>
        <IconButton name="add" label="Aggiungi una cartella" onPress={onAdd} size={52} color={INK} bg="#FFFFFF" border="#E4DCCD" />
      </View>
      {player?.noPhone ? <Text style={[type.caption, { color: MUTED, textAlign: "center", fontWeight: "400" }]}>Senza telefono: le sue cartelle le segni tu.</Text> : null}
      {onRename && player ? (
        <Pressy
          onPress={onRename}
          accessibilityLabel={"Cambia il nome di " + player.name}
          hoverStyle={{ backgroundColor: "#F1ECE2" }}
          outerStyle={{ alignSelf: "center", marginTop: 8 }}
          style={{ flexDirection: "row", alignItems: "center", minHeight: 44, paddingHorizontal: 14, borderRadius: radius.pill }}
        >
          <Ionicons name="create-outline" size={16} color="#2F6B4F" />
          <Text style={{ color: "#2F6B4F", fontWeight: "700", fontSize: 14, marginLeft: 6 }}>{player.id === table.me ? "Cambia il tuo nome" : "Cambia il nome"}</Text>
        </Pressy>
      ) : null}
      <View style={{ height: 12 }} />
      <Button label="Fatto" onPress={onClose} accent={INK} ink="#FBF8F2" />
    </Sheet>
  );
}

