import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { createAlert, deleteAlert, getAlerts } from "@/api.ts";
import { Screen } from "@/components/Screen.tsx";
import { useLocation } from "@/location.ts";
import { registerForPush } from "@/notifications.ts";
import { useSettings } from "@/settings.tsx";
import { colors, MIN_TAP, space } from "@/theme.ts";

export default function UyarilarScreen() {
  const loc = useLocation();
  const { settings } = useSettings();
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    registerForPush().then(setToken);
  }, []);

  const alerts = useQuery({
    queryKey: ["alerts", token],
    queryFn: () => getAlerts(token as string),
    enabled: !!token,
  });

  const sub = alerts.data?.subscriptions[0] ?? null;
  const on = !!sub;

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      if (!token) throw new Error("token yok");
      if (next) {
        if (loc.status !== "ok") throw new Error("konum yok");
        await createAlert(token, {
          lat: loc.lat,
          lon: loc.lon,
          boat: settings.boat,
        });
      } else if (sub) {
        await deleteAlert(token, sub.id);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts", token] }),
  });


  if (token === undefined) {
    return (
      <Screen>
        <Center>
          <ActivityIndicator size="large" color={colors.text} />
        </Center>
      </Screen>
    );
  }

  if (token === null) {
    return (
      <Screen>
        <Center>
          <Text style={{ fontSize: 56 }}>🔔</Text>
          <Text style={[styles.title, { fontSize: 22 }]}>
            Bildirimler açılamadı
          </Text>
          <Text style={[styles.body, { fontSize: 17 }]}>
            Telefon ayarlarından alarga'ya bildirim izni verin. (Gerçek bir
            cihazda ve uygulama sürümünde çalışır.)
          </Text>
        </Center>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: space.md }}>
        <Text style={[styles.title, { fontSize: 24 }]}>
          Fırtına uyarısı
        </Text>
        <Text style={[styles.body, { fontSize: 17 }]}>
          Açık olduğunda, bulunduğun bölgede deniz kötüleşirse telefonuna
          bildirim gelir. Tekne büyüklüğün: {settings.boat}.
        </Text>

        <View style={styles.row}>
          <Text style={[styles.rowLabel, { fontSize: 19 }]}>
            {on ? `Açık — ${sub?.label}` : "Kapalı"}
          </Text>
          <Switch
            value={on}
            disabled={toggle.isPending || (!on && loc.status !== "ok")}
            onValueChange={(v) => toggle.mutate(v)}
          />
        </View>

        {toggle.isError && (
          <Text style={[styles.err, { fontSize: 15 }]}>
            {(toggle.error as Error).message === "konum yok"
              ? "Önce konum izni gerekli."
              : "İşlem başarısız, tekrar deneyin."}
          </Text>
        )}

        {on && (
          <Pressable
            onPress={() => toggle.mutate(true)}
            style={styles.update}
            accessibilityRole="button"
          >
            <Text style={styles.updateText}>
              Uyarı bölgesini şu anki konuma taşı
            </Text>
          </Pressable>
        )}
      </View>
    </Screen>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <View style={styles.center}>{children}</View>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  title: { color: colors.text, fontWeight: "800", textAlign: "center" },
  body: { color: colors.textDim, lineHeight: 26 },
  row: {
    minHeight: MIN_TAP,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: space.md,
  },
  rowLabel: { color: colors.text, fontWeight: "700", flexShrink: 1 },
  err: { color: "#FFB4B4", fontWeight: "700" },
  update: {
    minHeight: MIN_TAP,
    backgroundColor: colors.accent,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  updateText: { color: "#FFFFFF", fontWeight: "800", fontSize: 16 },
});
