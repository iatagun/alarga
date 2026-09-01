import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { HourlyPoint } from "@alarga/types";
import type { Settings } from "../settings.tsx";
import { colors, sevColor, type, waveSeverity, windSeverity } from "../theme.ts";
import { compass, fmtWind } from "../units.ts";

const COL_W = 42;
const WIND_H = 84;
const WAVE_H = 56;

interface Props {
  hours: HourlyPoint[];
  windUnit: Settings["windUnit"];
}

/** 48 saatlik rüzgâr + dalga + yağış meteogramı. Düz View çubukları. */
export function Meteogram({ hours, windUnit }: Props) {
  if (hours.length === 0) return null;

  const hasWave = hours.some((h) => h.waveHeightM != null);
  const maxWind = Math.max(
    10,
    ...hours.map((h) => h.windGustKn ?? h.windSpeedKn ?? 0),
  );
  const maxWave = Math.max(0.5, ...hours.map((h) => h.waveHeightM ?? 0));
  const maxRain = Math.max(1, ...hours.map((h) => h.precipitationMm ?? 0));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.wrap}
    >
      <View>
        {/* Rüzgâr */}
        <View style={[styles.band, { height: WIND_H }]}>
          {hours.map((h, i) => {
            const w = h.windSpeedKn ?? 0;
            const g = h.windGustKn ?? w;
            return (
              <View key={i} style={[styles.col, i === 0 && styles.now]}>
                <View
                  style={[styles.gust, { height: (g / maxWind) * WIND_H }]}
                />
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(2, (w / maxWind) * WIND_H),
                      backgroundColor: sevColor[windSeverity(w)],
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>
        <View style={styles.row}>
          {hours.map((h, i) => (
            <View key={i} style={styles.col}>
              <Text style={styles.tick}>
                {h.windSpeedKn == null ? "" : Math.round(h.windSpeedKn)}
              </Text>
              <Text style={styles.dir}>{compass(h.windFromDeg)}</Text>
            </View>
          ))}
        </View>

        {/* Dalga (sadece deniz verisi varsa) */}
        {hasWave && (
          <>
            <View style={[styles.band, { height: WAVE_H, marginTop: 8 }]}>
              {hours.map((h, i) => (
                <View key={i} style={styles.col}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max(
                          2,
                          ((h.waveHeightM ?? 0) / maxWave) * WAVE_H,
                        ),
                        backgroundColor: sevColor[waveSeverity(h.waveHeightM)],
                      },
                    ]}
                  />
                </View>
              ))}
            </View>
            <View style={styles.row}>
              {hours.map((h, i) => (
                <View key={i} style={styles.col}>
                  <Text style={styles.tick}>
                    {h.waveHeightM == null ? "" : h.waveHeightM.toFixed(1)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Yağış */}
        <View style={[styles.band, styles.rain]}>
          {hours.map((h, i) => {
            const mm = h.precipitationMm ?? 0;
            return (
              <View key={i} style={styles.col}>
                {mm > 0 && (
                  <View
                    style={[
                      styles.rainBar,
                      { height: Math.max(2, (mm / maxRain) * 20) },
                    ]}
                  />
                )}
              </View>
            );
          })}
        </View>

        {/* Saat ekseni */}
        <View style={styles.row}>
          {hours.map((h, i) => {
            const d = new Date(h.time);
            const hr = d.getHours();
            return (
              <View key={i} style={styles.col}>
                <Text style={[styles.hour, hr === 0 && styles.midnight]}>
                  {hr === 0
                    ? d
                        .toLocaleDateString("tr-TR", {
                          weekday: "short",
                        })
                        .replace(".", "")
                    : `${hr}`}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.legend}>
          Üst: rüzgâr (soluk = hamle), tavan {fmtWind(maxWind, windUnit)}
          {hasWave ? ` · Orta: dalga, tavan ${maxWave.toFixed(1)} m` : ""} · Alt:
          yağış
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.cardAlt,
    borderRadius: 12,
    paddingVertical: 10,
  },
  band: { flexDirection: "row", alignItems: "flex-end" },
  row: { flexDirection: "row", alignItems: "flex-start" },
  col: { width: COL_W, alignItems: "center" },
  now: { backgroundColor: "rgba(46,134,193,0.15)", borderRadius: 4 },
  bar: { width: 11, borderRadius: 2 },
  gust: {
    position: "absolute",
    bottom: 0,
    width: 11,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  rain: { height: 22, marginTop: 4 },
  rainBar: { width: 11, borderRadius: 2, backgroundColor: "#4FA8E0" },
  tick: { color: colors.text, fontSize: type.tiny, fontWeight: "700" },
  dir: { color: colors.textDim, fontSize: 9 },
  hour: { color: colors.textDim, fontSize: 9 },
  midnight: { color: colors.text, fontWeight: "700" },
  legend: {
    color: colors.textDim,
    fontSize: type.tiny,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
});
