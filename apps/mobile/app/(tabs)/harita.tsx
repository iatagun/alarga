import {
  Camera,
  type CameraRef,
  type LngLatBounds,
  Map,
  type MapRef,
  UserLocation,
} from "@maplibre/maplibre-react-native";
import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { type BBox } from "@/api.ts";
import {
  WeatherOverlay,
  type WeatherLayerId,
} from "@/components/WeatherOverlay.tsx";
import { WindParticles } from "@/components/WindParticles.tsx";
import {
  TrafficOverlay,
  type TrafficSelection,
} from "@/components/TrafficOverlay.tsx";
import { BFF_URL } from "@/config.ts";
import { useLocation } from "@/location.ts";
import { type DownloadState, downloadRegion } from "@/offline.ts";
import { colors, MIN_TAP, space } from "@/theme.ts";

const STYLE_URL = `${BFF_URL}/tiles/style.json`;
const FALLBACK: [number, number] = [28.0, 40.6]; // Marmara

const WX: { id: WeatherLayerId; label: string }[] = [
  { id: "none", label: "Katman yok" },
  { id: "radar", label: "🌧 Yağmur" },
  { id: "wind", label: "🌬 Rüzgâr" },
  { id: "temp", label: "🌡 Sıcaklık" },
  { id: "pressure", label: "◉ Basınç" },
  { id: "clouds", label: "☁️ Bulut" },
];

export default function HaritaScreen() {
  const loc = useLocation();
  const mapRef = useRef<MapRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  const centered = useRef(false);
  const [dl, setDl] = useState<DownloadState>({ status: "idle" });
  const [bbox, setBbox] = useState<BBox | null>(null);
  const [showVessels, setShowVessels] = useState(true);
  const [showAircraft, setShowAircraft] = useState(false);
  const [wxLayer, setWxLayer] = useState<WeatherLayerId>("none");
  const [wxInfo, setWxInfo] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  const [selected, setSelected] = useState<TrafficSelection | null>(null);

  const center: [number, number] =
    loc.status === "ok" ? [loc.lon, loc.lat] : FALLBACK;

  // Konum ilk geldiğinde haritayı oraya taşı (bir kez — sonra kullanıcı serbest).
  useEffect(() => {
    if (loc.status === "ok" && !centered.current) {
      centered.current = true;
      cameraRef.current?.setStop({
        center: [loc.lon, loc.lat],
        zoom: 10,
        easing: "fly",
        duration: 900,
      });
    }
  }, [loc]);

  const refreshBbox = async () => {
    const b = (await mapRef.current?.getBounds()) as LngLatBounds | undefined;
    if (b) setBbox([b[0], b[1], b[2], b[3]]);
  };

  const onDownload = async () => {
    const b = (await mapRef.current?.getBounds()) as LngLatBounds | undefined;
    if (b) downloadRegion(STYLE_URL, b, setDl);
  };

  return (
    <View style={styles.fill}>
      <Map
        ref={mapRef}
        style={styles.fill}
        mapStyle={STYLE_URL}
        compass
        compassPosition={{ bottom: 96, right: 12 }}
        attribution
        attributionPosition={{ bottom: 4, left: 8 }}
        logo={false}
        onDidFinishLoadingMap={() => {
          void refreshBbox();
        }}
        onRegionWillChange={() => setPanning(true)}
        onRegionDidChange={() => {
          setPanning(false);
          void refreshBbox();
        }}
      >
        <Camera ref={cameraRef} initialViewState={{ center, zoom: 9 }} />
        <WeatherOverlay layer={wxLayer} onInfo={setWxInfo} />
        <UserLocation accuracy />
        <TrafficOverlay
          bbox={bbox}
          showVessels={showVessels}
          showAircraft={showAircraft}
          onSelect={setSelected}
        />
      </Map>

      {wxLayer === "wind" && (
        <WindParticles bbox={bbox} active={!panning} />
      )}

      {/* Hava katmanı seçici */}
      <View style={styles.topBar} pointerEvents="box-none">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.layerRow}
        >
          {WX.map((w) => (
            <Chip
              key={w.id}
              label={w.label}
              on={wxLayer === w.id}
              onPress={() => setWxLayer(w.id)}
            />
          ))}
        </ScrollView>
        <View style={styles.trafficRow}>
          <Chip
            label="🚤 Gemiler"
            on={showVessels}
            onPress={() => setShowVessels((v) => !v)}
          />
          <Chip
            label="✈️ Uçaklar"
            on={showAircraft}
            onPress={() => setShowAircraft((v) => !v)}
          />
        </View>
      </View>

      {wxInfo && (
        <View style={styles.wxInfo} pointerEvents="none">
          <Text style={styles.wxInfoText}>{wxInfo}</Text>
        </View>
      )}

      {wxLayer === "wind" && (
        <View style={styles.legend} pointerEvents="none">
          {(
            [
              [colors.calm, "sakin"],
              [colors.moderate, "orta"],
              [colors.rough, "kuvvetli"],
              [colors.severe, "fırtına"],
            ] as const
          ).map(([c, t]) => (
            <View key={t} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: c }]} />
              <Text style={styles.legendText}>{t}</Text>
            </View>
          ))}
        </View>
      )}

      {selected && (
        <View style={styles.info}>
          <Text style={styles.infoTitle}>{selected.title}</Text>
          {selected.subtitle ? (
            <Text style={styles.infoSub}>{selected.subtitle}</Text>
          ) : null}
          <Pressable
            onPress={() => setSelected(null)}
            style={styles.infoClose}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
          >
            <Text style={styles.infoCloseText}>Kapat</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.panel}>
        <Pressable
          style={styles.button}
          onPress={onDownload}
          disabled={dl.status === "downloading"}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>
            {dl.status === "downloading"
              ? `İndiriliyor… %${dl.percent}`
              : "⬇ Bu bölgeyi indir"}
          </Text>
        </Pressable>
        {dl.status === "done" && (
          <Text style={styles.note}>✓ Bu bölge çevrimdışı açılır</Text>
        )}
        {dl.status === "error" && (
          <Text style={[styles.note, { color: "#FFB4B4" }]}>
            İndirilemedi: {dl.message}
          </Text>
        )}
      </View>
    </View>
  );
}

function Chip({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      style={[styles.chip, on ? styles.chipOn : styles.chipOff]}
    >
      <Text style={[styles.chipText, { opacity: on ? 1 : 0.65 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    position: "absolute",
    top: space.sm,
    left: 0,
    right: 0,
    gap: 6,
  },
  layerRow: { paddingHorizontal: space.md, gap: 6 },
  trafficRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: space.md,
  },
  chip: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 2,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipOff: { backgroundColor: "rgba(0,0,0,0.6)", borderColor: colors.border },
  chipText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  wxInfo: {
    position: "absolute",
    top: 100,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  wxInfoText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  legend: {
    position: "absolute",
    left: space.md,
    bottom: 84,
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  info: {
    position: "absolute",
    top: 140,
    left: space.md,
    right: space.md,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    padding: space.md,
    gap: 4,
  },
  infoTitle: { color: colors.text, fontWeight: "800", fontSize: 20 },
  infoSub: { color: colors.textDim, fontSize: 16 },
  infoClose: {
    marginTop: space.sm,
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: space.md,
  },
  infoCloseText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  panel: {
    position: "absolute",
    left: space.md,
    right: space.md,
    bottom: space.lg,
    gap: space.sm,
  },
  button: {
    minHeight: MIN_TAP,
    backgroundColor: colors.accent,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.md,
  },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 18 },
  note: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 15,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: space.sm,
    borderRadius: 10,
    textAlign: "center",
  },
});
