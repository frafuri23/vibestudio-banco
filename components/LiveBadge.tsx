import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Pressy, tap } from "./Pressy";
import { toast } from "./Toast";
import { publish, refresh, useLiveStatus } from "../lib/live";
import { Table } from "../lib/types";
import { colors, radius } from "../lib/theme";

type LiveState = "live" | "sending" | "offline" | "local";

const COPY: Record<LiveState, { label: string; hint: string }> = {
  live: { label: "In tempo reale", hint: "Ogni mossa arriva subito sugli altri telefoni" },
  sending: { label: "Invio al server…", hint: "La mossa è già sullo schermo, il server la sta confermando" },
  offline: { label: "Senza rete · riprova", hint: "Tocca per riallinearti con il server" },
  local: { label: "Solo su questo telefono", hint: "Tocca per farlo vedere a tutti in tempo reale" },
};

export function useLiveState(table: Table | undefined): LiveState {
  const id = table?.id || "";
  const pending = useLiveStatus((s) => !!s.pending[id]);
  const offline = useLiveStatus((s) => !!s.offline[id]);
  if (!table?.online) return pending ? "sending" : "local";
  if (pending) return "sending";
  if (offline) return "offline";
  return "live";
}

function tint(state: LiveState, light?: boolean): string {
  if (state === "live") return light ? "#2F5E4B" : colors.success;
  if (state === "sending") return light ? "#A06A0E" : colors.warn;
  if (state === "offline") return light ? "#A8452B" : colors.danger;
  return light ? "#8A8070" : colors.faint;
}

function Dot({ state, light, size = 7 }: { state: LiveState; light?: boolean; size?: number }) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (state !== "sending") {
      v.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.3, duration: 450, useNativeDriver: true }),
        Animated.timing(v, { toValue: 1, duration: 450, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [state]);
  return <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tint(state, light), opacity: v }} />;
}

// Pillola sotto il titolo delle schermate di gioco. dotOnly: solo il pallino (barra di stato del poker).
export function LiveBadge({ table, light, dotOnly }: { table: Table; light?: boolean; dotOnly?: boolean }) {
  const state = useLiveState(table);
  const [busy, setBusy] = useState(false);
  const closed = table.status === "closed";
  const c = tint(state, light);

  const onPress = async () => {
    if (busy) return;
    if (state === "live" || state === "sending" || (state === "local" && closed)) {
      toast.info(COPY[state].hint);
      return;
    }
    setBusy(true);
    try {
      if (state === "local") {
        const r = await publish(table.id);
        if (r.ok) {
          tap("success");
          toast.ok("Tavolo in tempo reale · codice " + table.code);
        } else toast.error(r.error || "Non sono riuscito a collegare il tavolo");
      } else {
        await refresh(table.id);
        toast.ok("Di nuovo collegato");
      }
    } catch (e: any) {
      // "closed": il tavolo è appena tornato locale e l'avviso è già comparso
      if (e?.code !== "closed") toast.error(e?.message || "Ancora niente rete: riprova tra poco");
    } finally {
      setBusy(false);
    }
  };

  if (dotOnly) {
    return (
      <Pressy onPress={onPress} haptic={false} hitSlop={10} accessibilityLabel={COPY[state].label + ". " + COPY[state].hint} style={{ width: 20, height: 20, alignItems: "center", justifyContent: "center" }}>
        {busy ? <ActivityIndicator size="small" color={c} /> : <Dot state={state} light={light} size={8} />}
      </Pressy>
    );
  }

  return (
    <Pressy
      onPress={onPress}
      haptic={false}
      hitSlop={8}
      accessibilityLabel={COPY[state].label + ". " + COPY[state].hint}
      outerStyle={{ alignSelf: "flex-start" }}
      hoverStyle={{ opacity: 0.85 }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 28,
        paddingHorizontal: 10,
        borderRadius: radius.pill,
        backgroundColor: light ? "rgba(30,26,21,0.06)" : "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: light ? "rgba(30,26,21,0.10)" : "rgba(255,255,255,0.08)",
      }}
    >
      {busy ? <ActivityIndicator size="small" color={c} style={{ transform: [{ scale: 0.7 }] }} /> : <Dot state={state} light={light} />}
      <Text style={{ color: state === "local" ? (light ? "#6B6255" : colors.muted) : c, fontSize: 12.5, fontWeight: "700", marginLeft: 7 }}>{COPY[state].label}</Text>
      {state === "local" && !closed ? <Ionicons name="cloud-upload-outline" size={14} color={light ? "#2F5E4B" : colors.accent} style={{ marginLeft: 6 }} /> : null}
      {state === "offline" ? <Ionicons name="refresh" size={13} color={c} style={{ marginLeft: 6 }} /> : null}
    </Pressy>
  );
}
