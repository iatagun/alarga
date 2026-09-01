import type { BoatSize, MarineConditions } from "@alarga/types";

export type Direction = "higher_worse" | "lower_worse";

export interface ThresholdDef {
  id: string;
  label: string;
  unit: string;
  direction: Direction;
  yellowAt: number;
  redAt: number;
  /** Koşullardan ilgili değeri çeker. null → kural atlanır (veri yok). */
  get: (c: MarineConditions) => number | null;
}

// Eşikler balıkçının deneyimine ve KEGM/MGM deniz durumu tariflerine göre
// tutucu (conservative) seçildi. Sahada balıkçılarla kalibre edilecek (Faz 7).
// small: <7m sandal/fiber · medium: 7-12m · large: >12m.

const WIND: Record<BoatSize, [number, number]> = {
  small: [12, 18],
  medium: [17, 25],
  large: [22, 33],
};

const GUST: Record<BoatSize, [number, number]> = {
  small: [15, 22],
  medium: [21, 30],
  large: [27, 40],
};

const WAVE: Record<BoatSize, [number, number]> = {
  small: [0.75, 1.25],
  medium: [1.25, 2.0],
  large: [2.0, 3.5],
};

export function thresholdsFor(size: BoatSize): ThresholdDef[] {
  const [windY, windR] = WIND[size];
  const [gustY, gustR] = GUST[size];
  const [waveY, waveR] = WAVE[size];
  return [
    {
      id: "wind_speed",
      label: "Rüzgar",
      unit: " kn",
      direction: "higher_worse",
      yellowAt: windY,
      redAt: windR,
      get: (c) => c.windSpeedKn,
    },
    {
      id: "wind_gust",
      label: "Rüzgar hamlesi",
      unit: " kn",
      direction: "higher_worse",
      yellowAt: gustY,
      redAt: gustR,
      get: (c) => c.windGustKn,
    },
    {
      id: "wave_height",
      label: "Dalga",
      unit: " m",
      direction: "higher_worse",
      yellowAt: waveY,
      redAt: waveR,
      get: (c) => c.waveHeightM,
    },
    {
      id: "thunderstorm",
      label: "Gök gürültülü fırtına olasılığı",
      unit: "%",
      direction: "higher_worse",
      yellowAt: 30,
      redAt: 60,
      get: (c) => c.thunderstormProb,
    },
    {
      id: "visibility",
      label: "Görüş",
      unit: " m",
      direction: "lower_worse",
      yellowAt: 2000,
      redAt: 1000,
      get: (c) => c.visibilityM,
    },
  ];
}
