import React, { useState } from "react";
import { ActivityIndicator, Image, Platform, Share, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Sheet } from "./Sheet";
import { Button, Pressy, tap } from "./Pressy";
import { toast } from "./Toast";
import { publish } from "../lib/live";
import { joinLink } from "../lib/tableInfo";
import { fmtNum } from "../lib/format";
import { Table } from "../lib/types";
import { colors, radius, type } from "../lib/theme";

// Colori del pannello: scuro (tavoli verdi) o chiaro (carta del gioco con banca)
const DARK = { ink: colors.text, muted: colors.muted, faint: colors.faint, box: colors.elevated, card: colors.surface, border: colors.border, accent: colors.accent, ok: colors.success, okBg: "rgba(110,191,139,0.10)", okBorder: "rgba(110,191,139,0.28)" };
const LIGHT = { ink: "#1E1A15", muted: "#6B6255", faint: "#8A8070", box: "#F1ECE2", card: "#FFFFFF", border: "#E4DCCD", accent: "#2F5E4B", ok: "#2F5E4B", okBg: "rgba(47,94,75,0.08)", okBorder: "rgba(47,94,75,0.25)" };
type Pal = typeof DARK;
const palOf = (light?: boolean): Pal => (light ? LIGHT : DARK);

export function qrUrl(code: string): string {
  return "https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=0&data=" + encodeURIComponent(joinLink(code));
}

// Manda il link d'invito. Dove il foglio di condivisione non c'è (alcuni browser) copia il link.
export async function shareInvite(t: Table): Promise<void> {
  const link = joinLink(t.code);
  try {
    await Share.share({ message: "Vieni al tavolo \u00AB" + t.name + "\u00BB su Banco. Codice: " + t.code + "\n" + link });
    return;
  } catch (e: any) {
    if (e?.name === "AbortError") return; // chiuso senza condividere
  }
  if (Platform.OS === "web") {
    try {
      const nav: any = typeof navigator !== "undefined" ? navigator : null;
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(link);
        toast.ok("Link copiato: incollalo nella chat del gruppo");
        return;
      }
    } catch {
      // appunti non disponibili in questa pagina
    }
  }
  toast.info("Condivisione non disponibile qui: detta il codice " + t.code);
}

// Cosa trova chi entra a partita iniziata
export function joinNote(t: Table): string {
  if (t.status === "lobby") return "Ognuno sceglie nome e colore e si siede.";
  if (t.kind === "poker") return "Chi entra riceve " + fmtNum(t.buyinUnits) + " fiches e gioca dalla prossima mano.";
  if (t.kind === "tombola") return "Chi entra si compra le cartelle toccando il suo nome, fino al primo premio.";
  if (t.kind === "bank") return "Chi entra riceve " + fmtNum(t.bank?.startBalance || 0) + " soldi del gioco.";
  return "Chi entra riceve il buy-in di " + fmtNum(t.buyinUnits) + " fiches.";
}

export function InviteQR({ code, size = 216, light }: { code: string; size?: number; light?: boolean }) {
  const p = palOf(light);
  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ padding: 10, borderRadius: radius.xl + 4, backgroundColor: light ? "rgba(47,94,75,0.10)" : "rgba(221,183,101,0.12)" }}>
        <View style={{ width: size, height: size, borderRadius: radius.xl, backgroundColor: "#F8F4EC", alignItems: "center", justifyContent: "center" }}>
          <Image source={{ uri: qrUrl(code) }} style={{ width: size - 40, height: size - 40 }} accessibilityLabel="Codice QR per entrare al tavolo" />
        </View>
      </View>
      <Text style={[type.caption, { color: p.muted, textAlign: "center", marginTop: 12, fontWeight: "400", maxWidth: 320 }]}>
        Inquadrate il codice con la fotocamera: si apre nel browser, senza installare nulla.
      </Text>
    </View>
  );
}

export function CodeRow({ table, light, inSheet }: { table: Table; light?: boolean; inSheet?: boolean }) {
  const p = palOf(light);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: inSheet && !light ? colors.elevated : p.card, borderRadius: radius.lg, borderWidth: 1, borderColor: p.border, padding: 16 }}>
      <View style={{ flex: 1 }}>
        <Text style={[type.label, { color: p.muted }]}>Codice tavolo</Text>
        <View style={{ flexDirection: "row", marginTop: 8 }}>
          {table.code.split("").map((ch, i) => (
            <View key={i} style={{ width: 40, height: 46, borderRadius: 10, backgroundColor: inSheet && !light ? colors.bg : p.box, alignItems: "center", justifyContent: "center", marginRight: 6 }}>
              <Text style={[type.title, { color: p.ink, fontSize: 24 }]}>{ch}</Text>
            </View>
          ))}
        </View>
      </View>
      <Button label="Invia link" icon="share-outline" variant="outline" compact accent={light ? p.accent : undefined} onPress={() => shareInvite(table)} />
    </View>
  );
}

// "In tempo reale" oppure "Solo su questo telefono" (tocca per metterlo online: senza, il QR non porta a nulla)
export function OnlineRow({ table, light, sub }: { table: Table; light?: boolean; sub?: string }) {
  const p = palOf(light);
  const [linking, setLinking] = useState(false);

  const goOnline = async () => {
    if (linking) return;
    setLinking(true);
    try {
      const r = await publish(table.id);
      if (r.ok) {
        tap("success");
        toast.ok("Tavolo in tempo reale: entrate col codice");
      } else toast.error(r.error || "Non sono riuscito a collegare il tavolo");
    } catch (e: any) {
      toast.error(e?.message || "Non sono riuscito a collegare il tavolo");
    } finally {
      setLinking(false);
    }
  };

  if (table.online) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, minHeight: 48, borderRadius: radius.md, backgroundColor: p.okBg, borderWidth: 1, borderColor: p.okBorder }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.ok }} />
        <Text style={[type.bodyStrong, { color: p.ok, marginLeft: 10 }]}>In tempo reale</Text>
        <Text style={[type.caption, { color: p.muted, marginLeft: 8, flex: 1, fontWeight: "400" }]} numberOfLines={1}>
          {sub || "ognuno vede i saldi sul suo telefono"}
        </Text>
      </View>
    );
  }
  return (
    <Pressy
      onPress={goOnline}
      accessibilityLabel="Porta il tavolo in tempo reale"
      style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, minHeight: 52, borderRadius: radius.md, backgroundColor: p.card, borderWidth: 1, borderColor: p.border }}
    >
      <Ionicons name="phone-portrait-outline" size={18} color={p.muted} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={[type.bodyStrong, { color: p.ink }]}>Solo su questo telefono</Text>
        <Text style={[type.caption, { color: p.muted, fontWeight: "400" }]}>Tocca per farlo vedere a tutti in tempo reale</Text>
      </View>
      {linking ? <ActivityIndicator color={p.accent} /> : <Ionicons name="cloud-upload-outline" size={20} color={p.accent} />}
    </Pressy>
  );
}

type SheetProps = { visible: boolean; onClose: () => void; table: Table; onNoPhone: () => void; light?: boolean };

// "Aggiungi un giocatore" a partita iniziata: QR e link per chi ha il telefono, oppure lo aggiungi tu
export function InviteSheet({ visible, onClose, table, onNoPhone, light }: SheetProps) {
  const p = palOf(light);
  return (
    <Sheet visible={visible} onClose={onClose} title="Aggiungi un giocatore" subtitle={table.name + " \u00B7 codice " + table.code} light={light}>
      <InviteQR code={table.code} size={188} light={light} />
      <View style={{ height: 14 }} />
      <CodeRow table={table} light={light} inSheet />
      <View style={{ height: 10 }} />
      <OnlineRow table={table} light={light} sub="chi entra col codice si siede subito" />
      <Text style={[type.caption, { color: p.muted, marginTop: 10, fontWeight: "400", textAlign: "center" }]}>{joinNote(table)}</Text>

      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 18, marginBottom: 10 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: p.border }} />
        <Text style={[type.label, { color: p.faint, marginHorizontal: 10 }]}>Non ha il telefono?</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: p.border }} />
      </View>
      <Pressy
        onPress={onNoPhone}
        accessibilityLabel="Aggiungi tu chi non ha il telefono"
        style={{ minHeight: 54, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: "dashed", borderColor: light ? "#BFB4A2" : "#4A4238", flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 14 }}
      >
        <Ionicons name="person-add-outline" size={18} color={p.ink} />
        <Text style={[type.bodyStrong, { color: p.ink, marginLeft: 8 }]}>Aggiungilo tu da questo telefono</Text>
      </Pressy>
    </Sheet>
  );
}
