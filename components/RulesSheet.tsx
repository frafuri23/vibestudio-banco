import React, { useEffect, useState } from "react";
import { Platform, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Sheet } from "./Sheet";
import { Button, Pressy } from "./Pressy";
import { Config, Field, fieldLabel, fieldText, parseField, rangeText, Row } from "../lib/presets";
import { colors, radius, type } from "../lib/theme";

type Props = { row: Row | null; cfg: Config; onClose: () => void; onSave: (c: Config) => string | null | void; note?: string };

const noOutline = Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null;

// Modifica libera dei valori di una riga delle regole (buy-in, bui, cartella, premi, saldo iniziale…)
export function RulesSheet({ row, cfg, onClose, onSave, note }: Props) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  useEffect(() => {
    if (!row) return;
    const d: Record<string, string> = {};
    row.fields.forEach((f) => (d[f.id] = fieldText(f, f.get(cfg))));
    setDraft(d);
    setErr(null);
  }, [row?.id]);

  // Configurazione con i valori scritti finora (quelli validi), per l'anteprima sotto i campi
  const live = (() => {
    let c = cfg;
    if (!row) return c;
    for (const f of row.fields) {
      const v = parseField(f, draft[f.id] ?? "");
      if (v !== null && v >= f.min && v <= f.max) c = f.set(c, v);
    }
    return c;
  })();
  const preview = row?.preview ? row.preview(live) : null;

  const setField = (f: Field, text: string) => {
    setErr(null);
    setDraft((d) => ({ ...d, [f.id]: text }));
  };

  const save = () => {
    if (!row) return;
    let next = cfg;
    for (const f of row.fields) {
      const v = parseField(f, draft[f.id] ?? "");
      if (v === null) return setErr("Scrivi un numero in «" + f.label + "»");
      if (v < f.min || v > f.max) return setErr(f.label + ": " + rangeText(f));
      next = f.set(next, v);
    }
    const e = row.check ? row.check(next) : null;
    if (e) return setErr(e);
    try {
      const r = onSave(next);
      if (typeof r === "string" && r) return setErr(r);
      onClose();
    } catch (x: any) {
      setErr(x?.message || "Non sono riuscito a salvare");
    }
  };

  const input = (f: Field, compact?: boolean) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        height: compact ? 48 : 54,
        width: compact ? 120 : undefined,
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderColor: focus === f.id ? colors.accent : colors.border,
        backgroundColor: colors.bg,
        paddingHorizontal: 14,
      }}
    >
      {f.kind === "euro" ? <Text style={{ color: colors.muted, fontSize: 18, fontWeight: "700", marginRight: 6 }}>{"\u20AC"}</Text> : null}
      <TextInput
        value={draft[f.id] ?? ""}
        onChangeText={(t) => setField(f, t)}
        onFocus={() => setFocus(f.id)}
        onBlur={() => setFocus((x) => (x === f.id ? null : x))}
        keyboardType={f.kind === "euro" ? "decimal-pad" : "number-pad"}
        returnKeyType="done"
        onSubmitEditing={save}
        selectTextOnFocus
        maxLength={12}
        accessibilityLabel={f.label}
        placeholder="0"
        placeholderTextColor={colors.faint}
        style={[{ flex: 1, minWidth: 0, color: colors.text, fontSize: compact ? 18 : 20, fontWeight: "700", textAlign: compact ? "right" : "left", paddingVertical: 0 }, noOutline]}
      />
      {f.suffix ? <Text style={{ color: colors.muted, fontSize: 15, fontWeight: "600", marginLeft: 6 }}>{f.suffix}</Text> : null}
    </View>
  );

  return (
    <Sheet visible={!!row} onClose={onClose} title={row?.title || row?.label || "Regole"} subtitle="Scrivi il valore che vuoi">
      {row?.fields.map((f) =>
        row.compact ? (
          <View key={f.id} style={{ flexDirection: "row", alignItems: "center", minHeight: 56 }}>
            <Text style={[type.bodyStrong, { color: colors.text, flex: 1 }]}>{f.label}</Text>
            {input(f, true)}
          </View>
        ) : (
          <View key={f.id} style={{ marginBottom: 16 }}>
            <Text style={[type.label, { color: colors.muted, marginBottom: 8 }]}>{f.label}</Text>
            {input(f)}
            {f.presets.length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
                {f.presets.map((p) => {
                  const on = parseField(f, draft[f.id] ?? "") === p;
                  return (
                    <Pressy
                      key={p}
                      onPress={() => setField(f, fieldText(f, p))}
                      accessibilityLabel={f.label + " " + fieldLabel(f, p)}
                      style={{
                        minWidth: 44,
                        height: 36,
                        paddingHorizontal: 12,
                        borderRadius: 18,
                        marginRight: 8,
                        marginBottom: 6,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: on ? colors.accent : colors.border,
                        backgroundColor: on ? colors.accentSoft : colors.elevated,
                      }}
                    >
                      <Text style={{ color: on ? colors.accent : colors.text, fontWeight: "700", fontSize: 13.5 }}>{fieldLabel(f, p)}</Text>
                    </Pressy>
                  );
                })}
              </View>
            ) : null}
            {f.hint ? <Text style={[type.caption, { color: colors.muted, marginTop: 4, fontWeight: "400" }]}>{f.hint}</Text> : null}
          </View>
        )
      )}

      {preview ? (
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: row?.compact ? 8 : 0, marginBottom: 12 }}>
          <Ionicons name={preview.bad ? "alert-circle-outline" : "information-circle-outline"} size={16} color={preview.bad ? colors.warn : colors.muted} />
          <Text style={[type.caption, { color: preview.bad ? colors.warn : colors.muted, marginLeft: 6, flex: 1 }]}>{preview.text}</Text>
        </View>
      ) : null}
      {err ? (
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: 12, marginBottom: 12 }}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <Text style={[type.caption, { color: colors.danger, marginLeft: 8, flex: 1 }]}>{err}</Text>
        </View>
      ) : null}
      <Button label="Salva" onPress={save} />
      {note ? <Text style={[type.caption, { color: colors.faint, textAlign: "center", marginTop: 10, fontWeight: "400" }]}>{note}</Text> : null}
    </Sheet>
  );
}
