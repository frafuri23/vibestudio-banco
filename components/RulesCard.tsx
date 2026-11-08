import React, { useState } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Pressy } from "./Pressy";
import { RulesSheet } from "./RulesSheet";
import { ChipSetSheet } from "./ChipSetSheet";
import { toast } from "./Toast";
import { Config, nextSkin, Row, rowsFor } from "../lib/presets";
import { ChipDef, GameKind } from "../lib/types";
import { colors, radius, type } from "../lib/theme";

type Props = {
  kind: GameKind;
  cfg: Config;
  // Restituisce un messaggio d'errore se il cambio non è possibile
  onChange: (c: Config) => string | null | void;
  note?: string;
};

// Le regole del gioco a righe: ogni riga si tocca e si scrive il valore che si vuole
export function RulesCard({ kind, cfg, onChange, note }: Props) {
  const rows = rowsFor(kind, cfg);
  const [editId, setEditId] = useState<string | null>(null);
  const [chips, setChips] = useState<ChipDef[] | null>(null);
  const editing = rows.find((r) => r.id === editId) || null;

  const tell = (r: string | null | void) => {
    if (typeof r === "string" && r) toast.error(r);
  };

  const open = (r: Row) => {
    if (r.action === "skin") return tell(onChange({ ...cfg, skin: nextSkin(cfg.skin) }));
    if (r.action === "chips") return setChips(cfg.chips);
    if (r.fields.length) setEditId(r.id);
  };

  const closeChips = () => {
    const c = chips;
    setChips(null);
    if (c && JSON.stringify(c) !== JSON.stringify(cfg.chips)) tell(onChange({ ...cfg, chips: c }));
  };

  return (
    <>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 18 }}>
        {rows.map((r, i) => {
          const tappable = !!r.action || r.fields.length > 0;
          const icon = r.action === "skin" ? "swap-vertical" : "create-outline";
          return (
            <Pressy
              key={r.id}
              haptic={tappable}
              disabled={false}
              onPress={() => open(r)}
              accessibilityLabel={r.label + ": " + r.value + (tappable ? ". Tocca per cambiare" : "")}
              style={{ flexDirection: "row", alignItems: "center", minHeight: 52, borderTopWidth: i ? 1 : 0, borderTopColor: colors.hairline }}
            >
              <Text style={[type.body, { color: colors.muted, width: 110 }]}>{r.label}</Text>
              <Text style={[type.bodyStrong, { color: colors.text, flex: 1, textAlign: "right" }]} numberOfLines={2}>
                {r.value}
              </Text>
              {tappable ? <Ionicons name={icon} size={16} color={colors.accent} style={{ marginLeft: 8 }} /> : <View style={{ width: 24 }} />}
            </Pressy>
          );
        })}
      </View>

      <RulesSheet row={editing} cfg={cfg} onClose={() => setEditId(null)} onSave={onChange} note={note} />
      <ChipSetSheet visible={!!chips} onClose={closeChips} chips={chips || cfg.chips} onChange={setChips} />
    </>
  );
}
