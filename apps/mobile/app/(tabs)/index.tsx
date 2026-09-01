import { useQuery } from "@tanstack/react-query";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { fetchForecast } from "@/api.ts";
import { Meteogram } from "@/components/Meteogram.tsx";
import { Screen } from "@/components/Screen.tsx";
import { StaleBadge } from "@/components/StaleBadge.tsx";
import { StatTile } from "@/components/StatTile.tsx";
import { useLocation } from "@/location.ts";
import { useSettings } from "@/settings.tsx";
import { colors, space, type, waveSeverity, windSeverity } from "@/theme.ts";
import {
  compass,
  fmt,
  fmtWind,
  pressureTrend,
  weatherText,
} from "@/units.ts";

export default function BugunScreen() {
  const loc = useLocation();
  const { settings, ready } = useSettings();
  const unit = settings.windUnit;

  const enabled = ready && loc.status === "ok";
  const lat = loc.status === "ok" ? loc.lat : 0;
  const lon = loc.status === "ok" ? loc.lon : 0;

  const q = useQuery({
    queryKey: ["forecast", lat.toFixed(3), lon.toFixed(3)],
    queryFn: () => fetchForecast(lat, lon),
    enabled,
  });

  if (!ready || loc.status === "loading") {
    return (
      <Screen>
        <Center>
          <ActivityIndicator size="large" color={colors.text} />
        </Center>
      </Screen>
    );
  }
  if (loc.status === "denied") {
    return (
      <Screen>
        <Center>
          <Text style={styles.emoji}>📍</Text>
          <Text style={styles.big}>Konum izni kapalı</Text>
          <Text style={styles.dim}>
            Telefon ayarlarından alarga'ya konum izni verin.
          </Text>
        </Center>
      </Screen>
    );
  }
  if (loc.status === "error") {
    return (
      <Screen>
        <Center>
          <Text style={styles.emoji}>📍</Text>
          <Text style={styles.big}>Konum alınamadı</Text>
        </Center>
      </Screen>
    );
  }

  const env = q.data;
  if (q.isLoading && !env) {
    return (
      <Screen>
        <Center>
          <ActivityIndicator size="large" color={colors.text} />
          <Text style={styles.dim}>Tahmin alınıyor…</Text>
        </Center>
      </Screen>
    );
  }
  if (!env) {
    return (
      <Screen>
        <Center>
          <Text style={styles.emoji}>📡</Text>
          <Text style={styles.big}>Bilgi alınamadı</Text>
          <Text style={styles.dim}>İnternete bağlanınca burada görünecek.</Text>
        </Center>
      </Screen>
    );
  }

  const c = env.data.current;
  const trend = pressureTrend(c.pressureTrend3hHpa);
  const noMarine =
    c.waveHeightM == null && c.swellHeightM == null && c.seaTempC == null;
  const fetched = new Date(env.meta.fetchedAt).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: space.xl }}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching}
            onRefresh={() => q.refetch()}
            tintColor={colors.text}
          />
        }
      >
        {env.meta.stale && <StaleBadge fetchedAt={env.meta.fetchedAt} />}

        <View style={styles.header}>
          <Text style={styles.weather}>{weatherText(c.weatherCode)}</Text>
          <Text style={styles.temps}>
            {fmt(c.airTempC, 0, "°")} hava
            {c.seaTempC != null ? ` · ${c.seaTempC.toFixed(0)}° deniz` : ""}
          </Text>
        </View>

        {noMarine && (
          <Text style={styles.warn}>
            ⓘ Bu konumda deniz verisi yok (kıyıdan uzak). Kıyıya yakın bir yerde
            dalga/deniz suyu bilgisi görünür.
          </Text>
        )}

        <Text style={styles.section}>Şu an</Text>
        <View style={styles.grid}>
          <StatTile
            label="Rüzgâr"
            value={fmtWind(c.windSpeedKn, unit)}
            sub={`${compass(c.windFromDeg)}'den`}
            severity={windSeverity(c.windSpeedKn)}
          />
          <StatTile
            label="Hamle"
            value={fmtWind(c.windGustKn, unit)}
            severity={windSeverity(c.windGustKn)}
          />
          <StatTile
            label="Dalga"
            value={fmt(c.waveHeightM, 1, " m")}
            sub={
              c.wavePeriodS == null ? undefined : `${c.wavePeriodS.toFixed(0)} sn`
            }
            severity={waveSeverity(c.waveHeightM)}
          />
          <StatTile
            label="Şişme"
            value={fmt(c.swellHeightM, 1, " m")}
            sub={[
              c.swellPeriodS == null ? null : `${c.swellPeriodS.toFixed(0)} sn`,
              compass(c.swellDirectionDeg),
            ]
              .filter(Boolean)
              .join(" · ")}
          />
          <StatTile
            label="Basınç"
            value={fmt(c.pressureMslHpa, 0, " hPa")}
            sub={`${trend.arrow} ${trend.word}`}
          />
          <StatTile label="Görüş" value={visibility(c.visibilityM)} />
          <StatTile label="Nem" value={fmt(c.humidityPct, 0, "%")} />
          <StatTile label="Bulut" value={fmt(c.cloudCoverPct, 0, "%")} />
          <StatTile
            label="Hissedilen"
            value={fmt(c.apparentTempC, 0, "°")}
          />
        </View>

        <Text style={styles.section}>Sonraki 48 saat</Text>
        <Meteogram hours={env.data.hourly} windUnit={unit} />

        <Text style={styles.source}>
          {env.meta.source} · {env.meta.model} · {fetched}
        </Text>
      </ScrollView>
    </Screen>
  );
}

function visibility(m: number | null): string {
  if (m == null) return "—";
  return m >= 1000 ? `${Math.round(m / 1000)} km` : `${Math.round(m)} m`;
}

function Center({ children }: { children: React.ReactNode }) {
  return <View style={styles.center}>{children}</View>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  emoji: { fontSize: 52 },
  big: { color: colors.text, fontSize: type.h2, fontWeight: "800" },
  dim: { color: colors.textDim, fontSize: type.body, textAlign: "center" },
  header: {
    paddingVertical: space.sm,
  },
  weather: { color: colors.text, fontSize: type.h1, fontWeight: "800" },
  temps: { color: colors.textDim, fontSize: type.h3, marginTop: 2 },
  section: {
    color: colors.text,
    fontSize: type.h3,
    fontWeight: "700",
    marginTop: space.md,
    marginBottom: space.sm,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  warn: {
    color: colors.textDim,
    fontSize: type.small,
    backgroundColor: colors.cardAlt,
    borderRadius: 8,
    padding: space.sm,
    marginTop: space.sm,
  },
  source: {
    color: colors.textDim,
    fontSize: type.tiny,
    textAlign: "center",
    marginTop: space.md,
  },
});
