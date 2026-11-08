import React, { useEffect, useRef, useState } from "react";
import { Platform, Text, TextInput, TextInputProps, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Pressy } from "./Pressy";
import { toast } from "./Toast";
import { signIn, signUp } from "../lib/account";
import { NAME_MAX } from "../lib/engine";
import { colors, radius, type } from "../lib/theme";

type Mode = "signup" | "login";

type FieldProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  right?: React.ReactNode;
  input: TextInputProps;
  inputRef?: React.Ref<TextInput>;
};

// Campo con etichetta: il bordo diventa oro quando il campo \u00E8 attivo (anche da tastiera sul web)
function Field({ label, icon, right, input, inputRef }: FieldProps) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={[type.label, { color: colors.muted, marginBottom: 6 }]}>{label}</Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          minHeight: 54,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: focus ? colors.accent : colors.border,
          backgroundColor: colors.bg,
          paddingLeft: 14,
        }}
      >
        <Ionicons name={icon} size={18} color={focus ? colors.accent : colors.faint} />
        <TextInput
          ref={inputRef}
          placeholderTextColor={colors.faint}
          accessibilityLabel={label}
          {...input}
          onFocus={(e) => {
            setFocus(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocus(false);
            input.onBlur?.(e);
          }}
          style={[{ flex: 1, minHeight: 50, color: colors.text, fontSize: 16, paddingHorizontal: 10 }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]}
        />
        {right}
      </View>
    </View>
  );
}

export function AuthForm({ initialName }: { initialName: string }) {
  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Email a cui \u00E8 partito il link di conferma
  const [sentTo, setSentTo] = useState<string | null>(null);
  const alive = useRef(true);
  const pwRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const signup = mode === "signup";
  const ready = email.trim().length > 3 && password.length > 0 && (!signup || name.trim().length > 0);

  const submit = async () => {
    if (busy || !ready) return;
    setErr(null);
    setBusy(true);
    try {
      if (signup) {
        const r = await signUp(email, password, name);
        if (!alive.current) return;
        if (r.error) setErr(r.error);
        else if (r.confirm) {
          setSentTo(email.trim());
          setMode("login");
          setPassword("");
        } else toast.ok("Account creato: i tuoi dati sono salvati");
      } else {
        const r = await signIn(email, password);
        if (!alive.current) return;
        if (r.error) setErr(r.error);
        else toast.ok("Accesso fatto: dati ripresi dall'account");
      }
    } catch (e: any) {
      if (alive.current) setErr(e?.message || "Qualcosa \u00E8 andato storto");
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const tab = (m: Mode, label: string) => {
    const on = mode === m;
    return (
      <Pressy
        onPress={() => {
          setMode(m);
          setErr(null);
        }}
        accessibilityLabel={label + (on ? ", selezionato" : "")}
        outerStyle={{ flex: 1 }}
        hoverStyle={on ? undefined : { backgroundColor: "rgba(255,255,255,0.04)" }}
        style={{ minHeight: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: on ? colors.elevated : "transparent", borderWidth: on ? 1 : 0, borderColor: colors.border }}
      >
        <Text style={{ color: on ? colors.text : colors.muted, fontWeight: "700", fontSize: 14.5 }}>{label}</Text>
      </Pressy>
    );
  };

  return (
    <View style={{ marginTop: 18 }}>
      <View style={{ flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, padding: 4 }}>
        {tab("signup", "Registrati")}
        {tab("login", "Accedi")}
      </View>

      {sentTo ? (
        <View style={{ flexDirection: "row", alignItems: "flex-start", backgroundColor: colors.accentSoft, borderRadius: radius.md, borderWidth: 1, borderColor: "rgba(221,183,101,0.35)", padding: 14, marginTop: 14 }}>
          <Ionicons name="mail-unread-outline" size={20} color={colors.accent} style={{ marginTop: 1 }} />
          <Text style={[type.body, { color: colors.text, flex: 1, marginLeft: 10 }]}>
            {"Ti abbiamo mandato un'email a " + sentTo + ". Apri il link per confermare l'account, poi accedi qui sotto."}
          </Text>
        </View>
      ) : null}

      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, paddingTop: 4, marginTop: 14 }}>
        {signup ? (
          <Field
            label="Nome al tavolo"
            icon="person-outline"
            input={{
              value: name,
              onChangeText: (v) => {
                setName(v);
                setErr(null);
              },
              placeholder: "Es. Andrea",
              maxLength: NAME_MAX,
              autoCapitalize: "words",
              autoCorrect: false,
              returnKeyType: "next",
              onSubmitEditing: () => emailRef.current?.focus(),
            }}
          />
        ) : null}
        <Field
          label="Email"
          icon="mail-outline"
          inputRef={emailRef}
          input={{
            value: email,
            onChangeText: (v) => {
              setEmail(v);
              setErr(null);
            },
            placeholder: "nome@esempio.it",
            keyboardType: "email-address",
            autoCapitalize: "none",
            autoCorrect: false,
            autoComplete: "email",
            textContentType: "emailAddress",
            returnKeyType: "next",
            onSubmitEditing: () => pwRef.current?.focus(),
          }}
        />
        <Field
          label="Password"
          icon="lock-closed-outline"
          inputRef={pwRef}
          input={{
            value: password,
            onChangeText: (v) => {
              setPassword(v);
              setErr(null);
            },
            placeholder: signup ? "Almeno 6 caratteri" : "La tua password",
            secureTextEntry: !show,
            autoCapitalize: "none",
            autoCorrect: false,
            autoComplete: signup ? "new-password" : "current-password",
            textContentType: signup ? "newPassword" : "password",
            returnKeyType: "go",
            onSubmitEditing: submit,
          }}
          right={
            <Pressy
              onPress={() => setShow((v) => !v)}
              accessibilityLabel={show ? "Nascondi la password" : "Mostra la password"}
              haptic={false}
              style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 }}
            >
              <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={19} color={colors.muted} />
            </Pressy>
          }
        />

        {err ? (
          <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "flex-start", marginTop: 12 }}>
            <Ionicons name="alert-circle-outline" size={17} color={colors.danger} style={{ marginTop: 1 }} />
            <Text style={[type.caption, { color: colors.danger, flex: 1, marginLeft: 6 }]}>{err}</Text>
          </View>
        ) : null}

        <View style={{ height: 16 }} />
        <Button label={signup ? "Crea l'account" : "Entra nell'account"} icon={signup ? "person-add-outline" : "log-in-outline"} onPress={submit} loading={busy} disabled={!ready} />
      </View>

      <Text style={[type.caption, { color: colors.faint, marginTop: 10, textAlign: "center", fontWeight: "400" }]}>
        {signup ? "Tavoli e serate di questo telefono passano nel tuo account." : "Tavoli e serate di questo telefono si uniscono a quelli dell'account."}
      </Text>
    </View>
  );
}
