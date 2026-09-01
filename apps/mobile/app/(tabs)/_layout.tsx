import { Link, Tabs } from "expo-router";
import { Pressable, Text } from "react-native";
import { colors } from "@/theme.ts";

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 24 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { fontSize: 22, fontWeight: "800" },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 68,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 14, fontWeight: "700" },
        tabBarActiveTintColor: "#FFFFFF",
        tabBarInactiveTintColor: colors.textDim,
        headerRight: () => (
          <Link href="/ayarlar" asChild>
            <Pressable hitSlop={12} style={{ paddingHorizontal: 16 }}>
              <Text style={{ fontSize: 24 }}>⚙️</Text>
            </Pressable>
          </Link>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Bugün",
          tabBarIcon: () => <TabIcon emoji="🎣" />,
        }}
      />
      <Tabs.Screen
        name="harita"
        options={{ title: "Harita", tabBarIcon: () => <TabIcon emoji="🗺️" /> }}
      />
      <Tabs.Screen
        name="deniz"
        options={{ title: "Deniz", tabBarIcon: () => <TabIcon emoji="🌊" /> }}
      />
      <Tabs.Screen
        name="uyarilar"
        options={{ title: "Uyarılar", tabBarIcon: () => <TabIcon emoji="📢" /> }}
      />
    </Tabs>
  );
}
