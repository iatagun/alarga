import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { BoatSize } from "@alarga/types";
import { Screen } from "@/components/Screen.tsx";
import { BOAT_LABELS, type Settings, useSettings } from "@/settings.tsx";
import { colors, MIN_TAP, space, type } from "@/theme.ts";

const BOATS: BoatSize[] = ["small", "medium", "large"];
const UNITS: { value: Settings["windUnit"]; label: string }[] = [
  { value: "kn", label: "Knot (kn)" },
  { value: "ms", label: "m/s" },
  { value: "kmh", label: "km/s" },
  { value: "bft", label: "Beaufort" },
];

export default function AyarlarScreen() {
  const { settings, update } = useSettings();

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: space.xl }}>
        <Text style={styles.section}>Tekneniz</Text>
        <Text style={styles.hint}>
          Uyarı eşikleri tekne büyüklüğüne göre hesaplanır.
        </Text>
        {BOATS.map((b) => (
          <Row
            key={b}
            label={BOAT_LABELS[b]}
            selected={settings.boat === b}
            onPress={() => update({ boat: b })}
          />
        ))}

        <Text style={styles.section}>Rüzgâr birimi</Text>
        {UNITS.map((u) => (
          <Row
            key={u.value}
            label={u.label}
            selected={settings.windUnit === u.value}
            onPress={() => update({ windUnit: u.value })}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}

function Row({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.row, selected && styles.rowSel]}
    >
      <View style={[styles.dot, selected && styles.dotOn]} />
      <Text style={styles.rowLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    color: colors.text,
    fontWeight: "800",
    fontSize: type.h2,
    marginTop: space.lg,
    marginBottom: space.xs,
  },
  hint: { color: colors.textDim, fontSize: type.small, marginBottom: space.sm },
  row: {
    minHeight: MIN_TAP,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    marginBottom: space.sm,
  },
  rowSel: { borderColor: colors.accent, backgroundColor: "#1C3A52" },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    borderColor: colors.textDim,
  },
  dotOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  rowLabel: {
    color: colors.text,
    fontWeight: "600",
    fontSize: type.h3,
    flexShrink: 1,
  },
});
