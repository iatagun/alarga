/** Windy tarzı: koyu, veri-yoğun, deniz. */

export const colors = {
  bg: "#0B1B2B",
  card: "#13293D",
  cardAlt: "#0F2233",
  text: "#FFFFFF",
  textDim: "#9FB3C4",
  border: "#254056",
  accent: "#2E86C1",
  // Şiddet skalası (rüzgâr/dalga renklendirme, uyarı vurguları)
  calm: "#3FA34D",
  moderate: "#E0A100",
  rough: "#E2571E",
  severe: "#C62828",
};

export type Severity = "calm" | "moderate" | "rough" | "severe";

export const MIN_TAP = 48;
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 36 };

export const type = {
  h1: 26,
  h2: 20,
  h3: 17,
  body: 15,
  small: 13,
  tiny: 11,
} as const;

/** Beaufort'a yakın: rüzgâr knot → şiddet rengi. */
export function windSeverity(kn: number | null): Severity {
  if (kn == null) return "calm";
  if (kn >= 34) return "severe"; // 8+ Bft fırtına
  if (kn >= 22) return "rough"; // 6-7 Bft kuvvetli
  if (kn >= 11) return "moderate"; // 4-5 Bft
  return "calm";
}

/** Dalga yüksekliği (m) → şiddet rengi. */
export function waveSeverity(m: number | null): Severity {
  if (m == null) return "calm";
  if (m >= 2.5) return "severe";
  if (m >= 1.25) return "rough";
  if (m >= 0.5) return "moderate";
  return "calm";
}

export const sevColor: Record<Severity, string> = {
  calm: colors.calm,
  moderate: colors.moderate,
  rough: colors.rough,
  severe: colors.severe,
};
