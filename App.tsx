import "./vibestudio-env";
import "react-native-get-random-values";
import React, { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DarkTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { colors, type } from "./lib/theme";
import { hydrate, useStore } from "./lib/store";
import { initAccount } from "./lib/account";
import { useChromeState } from "./lib/chrome";
import { RootStackParamList } from "./lib/nav";
import { ToastHost } from "./components/Toast";
import { Chip } from "./components/Tokens";
import HomeScreen from "./screens/HomeScreen";
import LobbyScreen from "./screens/LobbyScreen";
import JoinScreen from "./screens/JoinScreen";
import PokerScreen from "./screens/PokerScreen";
import ShowdownScreen from "./screens/ShowdownScreen";
import SettlementScreen from "./screens/SettlementScreen";
import TombolaScreen from "./screens/TombolaScreen";
import BankScreen from "./screens/BankScreen";
import SetteScreen from "./screens/SetteScreen";
import LedgerScreen from "./screens/LedgerScreen";
import RegistroScreen from "./screens/RegistroScreen";
import StoricoScreen from "./screens/StoricoScreen";
import AccountScreen from "./screens/AccountScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, text: colors.text, primary: colors.accent, border: colors.border },
};

function Splash() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
      <Chip size={64} color={colors.accent} stripe="#F4EEE3" />
      <Text style={[type.display, { color: colors.text, marginTop: 16, letterSpacing: 2 }]}>Banco</Text>
      <ActivityIndicator color={colors.accent} style={{ marginTop: 18 }} />
    </View>
  );
}

export default function App() {
  const hydrated = useStore((s) => s.hydrated);
  const chrome = useChromeState();
  useEffect(() => {
    // Prima i dati di questo telefono, poi l'account (se c'è si salvano e si uniscono a quelli degli altri telefoni)
    hydrate()
      .catch(() => {})
      .finally(() => initAccount());
  }, []);

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {hydrated ? (
          <NavigationContainer theme={navTheme}>
            <Stack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: colors.bg } }}>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="Lobby" component={LobbyScreen} />
              <Stack.Screen name="Join" component={JoinScreen} options={{ animation: "fade_from_bottom" }} />
              <Stack.Screen name="Poker" component={PokerScreen} />
              <Stack.Screen name="Showdown" component={ShowdownScreen} options={{ animation: "fade_from_bottom" }} />
              <Stack.Screen name="Settlement" component={SettlementScreen} />
              <Stack.Screen name="Tombola" component={TombolaScreen} />
              <Stack.Screen name="Bank" component={BankScreen} />
              <Stack.Screen name="Sette" component={SetteScreen} />
              <Stack.Screen name="Ledger" component={LedgerScreen} />
              <Stack.Screen name="Registro" component={RegistroScreen} />
              <Stack.Screen name="Storico" component={StoricoScreen} />
              <Stack.Screen name="Account" component={AccountScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        ) : (
          <Splash />
        )}
        <ToastHost />
      </View>
      <StatusBar style={chrome.darkText ? "dark" : "light"} />
    </SafeAreaProvider>
  );
}
