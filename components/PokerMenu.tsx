import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Sheet } from "./Sheet";
import { Pressy } from "./Pressy";
import { Avatar } from "./Avatar";
import { Player, Table } from "../lib/types";
import { colors, pokerSkins, PokerSkin, radius, type } from "../lib/theme";
import { fmtNum } from "../lib/format";

type Props = {
  visible: boolean;
  onClose: () => void;
  table: Table;
  balances: Record<string, number>;
  onSkin: (s: PokerSkin) => void;
  onPause: () => void;
  onBlinds: () => void;
  onRebuy: (pid: string) => void;
  onAddPlayer: () => void;
  onRename: (p: Player) => void;
  canRename: (pid: string) => boolean;
  onRegistro: () => void;
  onEnd: () => void;
};

export function MenuRow({ icon, label, sub, onPress, tint }: { icon: keyof typeof Ionicons.glyphMap; label: string; sub?: string; onPress: () => void; tint?: string }) {
  return (
    <Pressy onPress={onPress} style={{ flexDirection: "row", alignItems: "center", minHeight: 56, borderRadius: radius.md, paddingHorizontal: 12, backgroundColor: colors.elevated, marginBottom: 8 }}>
      <Ionicons name={icon} size={20} color={tint || colors.accent} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[type.bodyStrong, { color: tint || colors.text }]}>{label}</Text>
        {sub ? <Text style={[type.caption, { color: colors.muted, fontWeight: "400" }]}>{sub}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.faint} />
    </Pressy>
  );
}

// Elenco dei giocatori nel menu: tocca il nome per cambiarlo, "+" per la ricarica
export function MenuPlayers({ table, balances, onRebuy, onRename, canRename, label }: { table: Table; balances: Record<string, number>; onRebuy: (pid: string) => void; onRename: (p: Player) => void; canRename: (pid: string) => boolean; label: string }) {
  const anyEditable = table.players.some((p) => canRename(p.id));
  return (
    <>
      <Text style={[type.label, { color: colors.muted, marginTop: 14 }]}>{label}</Text>
      {anyEditable ? <Text style={[type.caption, { color: colors.faint, fontWeight: "400", marginTop: 2, marginBottom: 4 }]}>Tocca un nome per cambiarlo</Text> : <View style={{ height: 6 }} />}
      {table.players.map((p) => {
        const editable = canRename(p.id);
        const isMe = p.id === table.me;
        const tag = isMe ? "tu" : p.noPhone ? "senza telefono" : null;
        const who = (
          <>
            <Avatar player={p} size={32} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={[type.bodyStrong, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>
                  {p.name}
                </Text>
                {editable ? <Ionicons name="create-outline" size={14} color={colors.faint} style={{ marginLeft: 6 }} /> : null}
              </View>
              {tag ? <Text style={[type.caption, { color: isMe ? colors.accent : colors.muted, fontSize: 12, lineHeight: 15 }]}>{tag}</Text> : null}
            </View>
          </>
        );
        return (
          <View key={p.id} style={{ flexDirection: "row", alignItems: "center", minHeight: 52 }}>
            {editable ? (
              <Pressy
                onPress={() => onRename(p)}
                accessibilityLabel={"Cambia il nome di " + p.name}
                outerStyle={{ flex: 1, marginRight: 6 }}
                hoverStyle={{ backgroundColor: colors.elevated }}
                style={{ flexDirection: "row", alignItems: "center", minHeight: 48, borderRadius: radius.md, paddingRight: 6 }}
              >
                {who}
              </Pressy>
            ) : (
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", marginRight: 6 }}>{who}</View>
            )}
            <Text style={[type.caption, { color: colors.muted, marginRight: 10 }]}>{fmtNum(balances[p.id] || 0)}</Text>
            <Pressy
              onPress={() => onRebuy(p.id)}
              accessibilityLabel={"Ricarica di " + fmtNum(table.buyinUnits) + " per " + p.name}
              style={{ borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.accent, paddingHorizontal: 12, minHeight: 36, justifyContent: "center" }}
            >
              <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 13 }}>{"+ " + fmtNum(table.buyinUnits)}</Text>
            </Pressy>
          </View>
        );
      })}
    </>
  );
}

export function PokerMenu({ visible, onClose, table, balances, onSkin, onPause, onBlinds, onRebuy, onAddPlayer, onRename, canRename, onRegistro, onEnd }: Props) {
  const ps = table.poker!;
  const first = ps.levels?.[0] || [0, 0];
  return (
    <Sheet visible={visible} onClose={onClose} title="Tavolo" subtitle={table.name + " · codice " + table.code}>
      <Text style={[type.label, { color: colors.muted, marginBottom: 8 }]}>Grafica</Text>
      <View style={{ flexDirection: "row", marginBottom: 18 }}>
        {(Object.keys(pokerSkins) as PokerSkin[]).map((k) => {
          const s = pokerSkins[k];
          const on = ps.skin === k;
          return (
            <Pressy key={k} onPress={() => onSkin(k)} style={{ flex: 1, marginRight: 8 }}>
              <View style={{ borderRadius: radius.md, borderWidth: 2, borderColor: on ? colors.accent : colors.border, padding: 8, backgroundColor: colors.elevated }}>
                <View style={{ height: 42, borderRadius: 21, backgroundColor: s.rim, padding: 4 }}>
                  <View style={{ flex: 1, borderRadius: 18, backgroundColor: s.felt, borderWidth: 1, borderColor: s.line }} />
                </View>
                <Text style={[type.caption, { color: on ? colors.accent : colors.text, textAlign: "center", marginTop: 6 }]}>{s.label}</Text>
              </View>
            </Pressy>
          );
        })}
      </View>

      <MenuRow icon={ps.pausedAt ? "play" : "pause"} label={ps.pausedAt ? "Riprendi il timer" : "Metti in pausa il timer"} sub={"I bui salgono ogni " + ps.levelMinutes + " minuti"} onPress={onPause} />
      <MenuRow icon="options-outline" label="Bui e livelli" sub={"Si parte da " + fmtNum(first[0]) + "/" + fmtNum(first[1]) + " · cambiali quando vuoi"} onPress={onBlinds} />
      <MenuRow icon="person-add-outline" label="Aggiungi un giocatore" sub="QR, link d'invito o chi non ha il telefono" onPress={onAddPlayer} />
      <MenuRow icon="list-outline" label="Registro dei movimenti" sub="Ogni puntata, buy-in e vincita" onPress={onRegistro} />

      <MenuPlayers table={table} balances={balances} onRebuy={onRebuy} onRename={onRename} canRename={canRename} label="Giocatori e ricariche (rebuy)" />

      <View style={{ height: 12 }} />
      <MenuRow icon="cash-outline" label="Fine serata: chi paga chi" sub="Converte le fiches in euro" onPress={onEnd} />
    </Sheet>
  );
}
