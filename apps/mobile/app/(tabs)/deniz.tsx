import { useQuery } from "@tanstack/react-query";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { DailyPoint, SunMoon } from "@alarga/types";
import { fetchForecast, fetchSunMoon } from "@/api.ts";
import { Screen } from "@/components/Screen.tsx";
import { useLocation } from "@/location.ts";
import { useSettings } from "@/settings.tsx";
import { colors, sevColor, space, type, waveSeverity, windSeverity } from "@/theme.ts";
import { compass, dayName, fmt, fmtWind, hhmm, weatherEmoji } from "@/units.ts";

export default function DenizScreen() {
  const loc = useLocation();
  const { settings } = useSettings();
  const unit = settings.windUnit;
  const ok = loc.status === "ok";
  const lat = ok ? loc.lat : 0;
  const lon = ok ? loc.lon : 0;
  const key = [lat.toFixed(3), lon.toFixed(3)];

  const fc = useQuery({
    queryKey: ["forecast", ...key],
    queryFn: () => fetchForecast(lat, lon),
    enabled: ok,
  });
  const sm = useQuery({
    queryKey: ["sunmoon", ...key],
    queryFn: () => fetchSunMoon(lat, lon),
    enabled: ok,
  });

  if (!ok) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.emoji}>📍</Text>
          <Text style={styles.dim}>Konum gerekli</Text>
        </View>
      </Screen>
    );
  }
  if (fc.isLoading && !fc.data) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      </Screen>
    );
  }

  const days = fc.data?.data.daily ?? [];
  const moon = sm.data?.data ?? [];

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: space.xl }}
        refreshControl={
          <RefreshControl
            refreshing={fc.isFetching}
            onRefresh={() => {
              fc.refetch();
              sm.refetch();
            }}
            tintColor={colors.text}
          />
        }
      >
        <Text style={styles.section}>7 günlük</Text>
        {days.map((d) => (
          <DayRow key={d.date} d={d} unit={unit} />
        ))}

        <Text style={styles.section}>Güneş & Ay</Text>
        {moon[0] && <SunMoonCard s={moon[0]} />}

        <Text style={styles.section}>Solunar — avlanma saatleri</Text>
        <Text style={styles.hint}>
          Balığın en hareketli olduğu pencereler (ay konumuna göre). Mavi =
          güçlü dönem, koyu = zayıf dönem.
        </Text>
        {moon.slice(0, 5).map((s) => (
          <SolunarRow key={s.date} s={s} />
        ))}

        <Text style={styles.src}>
          Deniz: Open-Meteo · Astronomi: SunCalc (lokal hesap)
        </Text>
      </ScrollView>
    </Screen>
  );
}

function DayRow({
  d,
  unit,
}: {
  d: DailyPoint;
  unit: ReturnType<typeof useSettings>["settings"]["windUnit"];
}) {
  return (
    <View style={styles.day}>
      <View style={styles.dayLeft}>
        <Text style={styles.dayName}>{dayName(d.date)}</Text>
        <Text style={styles.dayDate}>
          {new Date(d.date).toLocaleDateString("tr-TR", {
            day: "2-digit",
            month: "2-digit",
          })}
        </Text>
      </View>
      <Text style={styles.dayIcon}>{weatherEmoji(d.weatherCode)}</Text>
      <View style={styles.dayCol}>
        <Text style={styles.dayTemp}>
          {fmt(d.tempMinC, 0, "°")} / {fmt(d.tempMaxC, 0, "°")}
        </Text>
        <Text style={[styles.daySub, { color: sevColor[windSeverity(d.windMaxKn)] }]}>
          🌬 {fmtWind(d.windMaxKn, unit)} {compass(d.windDomDirDeg)} · hamle{" "}
          {fmtWind(d.gustMaxKn, unit)}
        </Text>
        <Text style={styles.daySub2}>
          {d.waveMaxM != null ? (
            <Text style={{ color: sevColor[waveSeverity(d.waveMaxM)] }}>
              🌊 {d.waveMaxM.toFixed(1)} m{"  "}
            </Text>
          ) : null}
          {d.precipitationSumMm ? (
            <Text style={{ color: "#4FA8E0" }}>
              ☔ {d.precipitationSumMm.toFixed(1)} mm
            </Text>
          ) : null}
        </Text>
      </View>
      <Text style={styles.daySun}>
        ☀ {hhmm(d.sunrise)}
        {"\n"}🌇 {hhmm(d.sunset)}
      </Text>
    </View>
  );
}

function SunMoonCard({ s }: { s: SunMoon }) {
  return (
    <View style={styles.card}>
      <View style={styles.smRow}>
        <SM label="Gün doğumu" value={hhmm(s.sunrise)} />
        <SM label="Gün batımı" value={hhmm(s.sunset)} />
        <SM label="Öğle" value={hhmm(s.solarNoon)} />
      </View>
      <View style={styles.smRow}>
        <SM label="Ay doğuşu" value={hhmm(s.moonrise)} />
        <SM label="Ay batışı" value={hhmm(s.moonset)} />
        <SM
          label={s.moonPhaseName}
          value={`%${Math.round(s.moonIllumination * 100)}`}
        />
      </View>
    </View>
  );
}

function SM({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.sm}>
      <Text style={styles.smVal}>{value}</Text>
      <Text style={styles.smLabel}>{label}</Text>
    </View>
  );
}

function SolunarRow({ s }: { s: SunMoon }) {
  const now = Date.now();
  const active = [...s.majorPeriods, ...s.minorPeriods].some(
    (p) => now >= Date.parse(p.start) && now <= Date.parse(p.end),
  );
  return (
    <View style={[styles.solRow, active && styles.solActive]}>
      <Text style={styles.solDay}>
        {dayName(s.date)}
        {active ? "  ● şimdi" : ""}
      </Text>
      <View style={styles.solChips}>
        {s.majorPeriods.map((p, i) => (
          <Text key={`M${i}`} style={[styles.chip, styles.chipMajor]}>
            {hhmm(p.start)}–{hhmm(p.end)}
          </Text>
        ))}
        {s.minorPeriods.map((p, i) => (
          <Text key={`m${i}`} style={[styles.chip, styles.chipMinor]}>
            {hhmm(p.start)}–{hhmm(p.end)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emoji: { fontSize: 48 },
  dim: { color: colors.textDim, fontSize: type.body },
  section: {
    color: colors.text,
    fontSize: type.h3,
    fontWeight: "700",
    marginTop: space.md,
    marginBottom: space.sm,
  },
  hint: { color: colors.textDim, fontSize: type.small, marginBottom: space.sm },
  day: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  dayLeft: { width: 64 },
  dayName: { color: colors.text, fontWeight: "700", fontSize: type.small },
  dayDate: { color: colors.textDim, fontSize: type.tiny },
  dayIcon: { fontSize: 22 },
  dayCol: { flex: 1, gap: 2 },
  dayTemp: { color: colors.text, fontWeight: "700", fontSize: type.body },
  daySub: { fontSize: type.tiny },
  daySub2: { fontSize: type.tiny },
  daySun: { color: colors.textDim, fontSize: type.tiny, textAlign: "right" },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: space.md,
    gap: space.md,
  },
  smRow: { flexDirection: "row", justifyContent: "space-between" },
  sm: { alignItems: "center", flex: 1 },
  smVal: { color: colors.text, fontWeight: "800", fontSize: type.h3 },
  smLabel: { color: colors.textDim, fontSize: type.tiny, textAlign: "center" },
  solRow: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  solActive: { borderWidth: 2, borderColor: colors.accent },
  solDay: { color: colors.text, fontWeight: "700", fontSize: type.small },
  solChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  chip: {
    fontSize: type.tiny,
    fontWeight: "700",
    color: "#fff",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    overflow: "hidden",
  },
  chipMajor: { backgroundColor: colors.accent },
  chipMinor: { backgroundColor: colors.border },
  src: {
    color: colors.textDim,
    fontSize: type.tiny,
    textAlign: "center",
    marginTop: space.md,
  },
});
