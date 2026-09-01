import type { Settings } from "./settings.tsx";

const KN_TO_MS = 0.514444;
const KN_TO_KMH = 1.852;

const BFT = [1, 3, 6, 10, 16, 21, 27, 33, 40, 47, 55, 63];
export function beaufort(kn: number): number {
  for (let b = 0; b < BFT.length; b++) if (kn < BFT[b]!) return b;
  return 12;
}

export function fmtWind(kn: number | null, unit: Settings["windUnit"]): string {
  if (kn == null) return "—";
  switch (unit) {
    case "ms":
      return `${(kn * KN_TO_MS).toFixed(1)} m/s`;
    case "kmh":
      return `${Math.round(kn * KN_TO_KMH)} km/s`;
    case "bft":
      return `${beaufort(kn)} Bft`;
    default:
      return `${Math.round(kn)} kn`;
  }
}

const COMPASS = [
  "K", "KKD", "KD", "DKD", "D", "DGD", "GD", "GGD",
  "G", "GGB", "GB", "BGB", "B", "BKB", "KB", "KKB",
];
/** Meteorolojik derece (nereden) → 16-yön Türkçe pusula. */
export function compass(deg: number | null): string {
  if (deg == null) return "—";
  return COMPASS[Math.round(deg / 22.5) % 16]!;
}

export function fmt(
  v: number | null,
  digits = 0,
  suffix = "",
): string {
  if (v == null) return "—";
  return `${v.toFixed(digits)}${suffix}`;
}

/** Basınç eğilimi oku + sözcük. */
export function pressureTrend(hpa: number | null): { arrow: string; word: string } {
  if (hpa == null) return { arrow: "", word: "" };
  if (hpa >= 1.5) return { arrow: "↑", word: "hızlı yükseliyor" };
  if (hpa >= 0.5) return { arrow: "↗", word: "yükseliyor" };
  if (hpa <= -1.5) return { arrow: "↓", word: "hızlı düşüyor" };
  if (hpa <= -0.5) return { arrow: "↘", word: "düşüyor" };
  return { arrow: "→", word: "sabit" };
}

const WMO: Record<number, string> = {
  0: "Açık", 1: "Az bulutlu", 2: "Parçalı bulutlu", 3: "Kapalı",
  45: "Sisli", 48: "Kırağı sisi",
  51: "Hafif çiseleme", 53: "Çiseleme", 55: "Yoğun çiseleme",
  61: "Hafif yağmur", 63: "Yağmur", 65: "Sağanak yağmur",
  66: "Dondurucu yağmur", 67: "Dondurucu sağanak",
  71: "Hafif kar", 73: "Kar", 75: "Yoğun kar", 77: "Kar taneleri",
  80: "Hafif sağanak", 81: "Sağanak", 82: "Şiddetli sağanak",
  85: "Kar sağanağı", 86: "Yoğun kar sağanağı",
  95: "Gök gürültülü fırtına", 96: "Dolulu fırtına", 99: "Şiddetli dolulu fırtına",
};
export function weatherText(code: number | null): string {
  return code == null ? "—" : (WMO[code] ?? "—");
}

export function weatherEmoji(code: number | null): string {
  if (code == null) return "·";
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌦️";
  if (code <= 86) return "🌨️";
  return "⛈️";
}

/** Yerel saat "HH:MM". */
export function hhmm(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dayName(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400_000);
  if (diff === 0) return "Bugün";
  if (diff === 1) return "Yarın";
  return d.toLocaleDateString("tr-TR", { weekday: "long" });
}
