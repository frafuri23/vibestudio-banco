import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FadeIn, Screen, TopBar } from "../components/Screen";
import { Button, Pressy, tap } from "../components/Pressy";
import { Avatar } from "../components/Avatar";
import { AuthForm } from "../components/AuthForm";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { NameSheet } from "../components/NameSheet";
import { toast } from "../components/Toast";
import { signOut, syncNow, useAccount } from "../lib/account";
import { useStore } from "../lib/store";
import { HOST_COLOR } from "../lib/engine";
import { isDemoEvening } from "../lib/history";
import { timeAgo } from "../lib/format";
import { ScreenProps } from "../lib/nav";
import { colors, radius, type } from "../lib/theme";

export default function AccountScreen({ navigation }: ScreenProps<"Account">) {
  const insets = useSafeAreaInsets();
  const email = useAccount((s) => s.email);
  const ready = useAccount((s) => s.ready);
  const status = useAccount((s) => s.status);
  const savedAt = useAccount((s) => s.savedAt);
  const error = useAccount((s) => s.error);
  const myName = useStore((s) => s.myName);
  const setMyName = useStore((s) => s.setMyName);
  const openCount = useStore((s) => s.order.filter((id) => s.tables[id] && !s.tables[id].demo && s.tables[id].status !== "closed").length);
  const closedCount = useStore((s) => s.order.filter((id) => s.tables[id] && !s.tables[id].demo && s.tables[id].status === "closed").length);
  const pastCount = useStore((s) => s.past.filter((e) => !isDemoEvening(e)).length) + closedCount;
  const [askOut, setAskOut] = useState(false);
  const [outBusy, setOutBusy] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);

  const leave = async () => {
    setAskOut(false);
    setOutBusy(true);
    try {
      const r = await signOut();
      if (r.error) {
        tap("error");
        toast.error(r.error);
      } else {
        toast.ok("Sei uscito: i tuoi dati restano nell'account");
        navigation.navigate("Home");
      }
    } catch (e: any) {
      toast.error(e?.message || "Non sono riuscito a uscire");
    } finally {
      setOutBusy(false);
    }
  };

  const saveName = (name: string): string | null => {
    const r = setMyName(name);
    if (r.error) return r.error;
    toast.ok("Nome aggiornato");
    return null;
  };

  const statusRow =
    status === "saving" ? (
      <>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={[type.caption, { color: colors.muted, marginLeft: 8, flex: 1 }]}>Salvataggio in corso…</Text>
      </>
    ) : status === "error" ? (
      <>
        <Ionicons name="alert-circle-outline" size={17} color={colors.danger} />
        <Text style={[type.caption, { color: colors.danger, marginLeft: 8, flex: 1 }]} numberOfLines={2}>
          {"Non salvato: " + (error || "errore")}
        </Text>
      </>
    ) : status === "saved" ? (
      <>
        <Ionicons name="checkmark-circle" size={17} color={colors.success} />
        <Text style={[type.caption, { color: colors.success, marginLeft: 8, flex: 1 }]}>{"Dati salvati · " + (savedAt ? timeAgo(savedAt) : "adesso")}</Text>
      </>
    ) : (
      <>
        <Ionicons name="cloud-outline" size={17} color={colors.muted} />
        <Text style={[type.caption, { color: colors.muted, marginLeft: 8, flex: 1 }]}>Pronto a salvare</Text>
      </>
    );

  const row = (icon: keyof typeof Ionicons.glyphMap, label: string, value: string, i: number, onPress?: () => void) => {
    const body = (
      <>
        <Ionicons name={icon} size={19} color={colors.accent} />
        <Text style={[type.bodyStrong, { color: colors.text, marginLeft: 12, flex: 1 }]}>{label}</Text>
        <Text style={[type.body, { color: colors.muted, maxWidth: "50%" }]} numberOfLines={1}>
          {value}
        </Text>
        {onPress ? <Ionicons name="chevron-forward" size={17} color={colors.faint} style={{ marginLeft: 6 }} /> : null}
      </>
    );
    const style = { flexDirection: "row" as const, alignItems: "center" as const, minHeight: 56, borderTopWidth: i ? 1 : 0, borderTopColor: colors.hairline };
    return onPress ? (
      <Pressy key={label} onPress={onPress} accessibilityLabel={label + ": " + value + ". Tocca per cambiarlo"} hoverStyle={{ opacity: 0.85 }} style={style}>
        {body}
      </Pressy>
    ) : (
      <View key={label} style={style}>
        {body}
      </View>
    );
  };

  const signedIn = (
    <>
      <FadeIn>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: "rgba(221,183,101,0.35)", padding: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Avatar player={{ id: "me", name: myName || email || "?", color: HOST_COLOR, status: "ready" }} size={52} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[type.heading, { color: colors.text }]} numberOfLines={1}>
                {myName || "Senza nome"}
              </Text>
              <Text style={[type.caption, { color: colors.muted, fontWeight: "400" }]} numberOfLines={1}>
                {email}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.hairline, minHeight: 32 }}>{statusRow}</View>
        </View>
      </FadeIn>

      <Text style={[type.label, { color: colors.muted, marginTop: 24, marginBottom: 10 }]}>Salvato nell'account</Text>
      <FadeIn delay={60}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16 }}>
          {row("person-outline", "Nome al tavolo", myName || "Da scegliere", 0, () => setNameOpen(true))}
          {row("albums-outline", "Tavoli aperti", String(openCount), 1)}
          {row("time-outline", "Serate passate", String(pastCount), 2)}
        </View>
      </FadeIn>
      <Text style={[type.caption, { color: colors.faint, marginTop: 8, fontWeight: "400" }]}>
        Si salva da solo a ogni modifica. Su un altro telefono o nel browser accedi con la stessa email.
      </Text>

      <View style={{ height: 20 }} />
      <Button label="Salva adesso" icon="cloud-upload-outline" variant="secondary" loading={status === "saving"} onPress={() => syncNow(true).catch(() => {})} />
      <View style={{ height: 10 }} />
      <Button label="Esci dall'account" icon="log-out-outline" variant="ghost" loading={outBusy} onPress={() => setAskOut(true)} />
    </>
  );

  const benefit = (icon: keyof typeof Ionicons.glyphMap, text: string) => (
    <View key={text} style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
      <Ionicons name={icon} size={17} color={colors.accent} />
      <Text style={[type.body, { color: colors.text, marginLeft: 10, flex: 1 }]}>{text}</Text>
    </View>
  );

  const signedOut = (
    <>
      <FadeIn>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: "rgba(221,183,101,0.35)", padding: 18 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="cloud-upload-outline" size={24} color={colors.accent} />
          </View>
          <Text style={[type.title, { color: colors.text, marginTop: 12 }]}>Salva le tue serate</Text>
          <Text style={[type.body, { color: colors.muted, marginTop: 6 }]}>Con un account i tuoi dati restano salvati e li ritrovi su ogni telefono o nel browser.</Text>
          {benefit("albums-outline", "Tavoli aperti e serate passate")}
          {benefit("person-outline", "Il tuo nome al tavolo")}
          {benefit("phone-portrait-outline", "Su un altro telefono basta accedere")}
        </View>
      </FadeIn>
      <AuthForm initialName={myName} />
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#221D16", paddingTop: insets.top }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Screen scroll gradient={["#221D16", colors.bg]}>
          <TopBar title="Account" subtitle={email ? "Dati salvati sul server" : "Nome, tavoli e serate al sicuro"} onBack={() => navigation.goBack()} />
          {!ready ? <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} /> : email ? signedIn : signedOut}
        </Screen>
      </KeyboardAvoidingView>

      <ConfirmSheet
        visible={askOut}
        title="Uscire dall'account?"
        subtitle={email || undefined}
        lines={["Prima salvo gli ultimi dati: restano nell'account.", "Su questo telefono tavoli e serate spariscono finch\u00E9 non accedi di nuovo."]}
        confirmLabel="Esci"
        icon="log-out-outline"
        firstIcon="cloud-done-outline"
        firstColor={colors.success}
        variant="primary"
        cancelLabel="Resta dentro"
        onConfirm={leave}
        onClose={() => setAskOut(false)}
      />
      <NameSheet
        visible={nameOpen}
        onClose={() => setNameOpen(false)}
        title="Il tuo nome al tavolo"
        subtitle="Lo cambio anche nei tavoli aperti in cui sei seduto."
        initial={myName}
        saveLabel="Salva il nome"
        onSave={saveName}
      />
    </View>
  );
}
