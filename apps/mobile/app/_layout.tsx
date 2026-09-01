import { LogManager } from "@maplibre/maplibre-react-native";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MAX_CACHE_AGE, persister, queryClient } from "@/query.ts";
import { SettingsProvider } from "@/settings.tsx";
import { colors } from "@/theme.ts";

// MapLibre tile iptalleri (pan/zoom sırasında) WARN üretiyor — gürültüyü kes.
LogManager.setLogLevel("error");

export default function RootLayout() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: MAX_CACHE_AGE }}
    >
      <SettingsProvider>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.card },
              headerTintColor: colors.text,
              headerTitleStyle: { fontSize: 22, fontWeight: "800" },
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="ayarlar" options={{ title: "Ayarlar" }} />
          </Stack>
        </SafeAreaProvider>
      </SettingsProvider>
    </PersistQueryClientProvider>
  );
}
