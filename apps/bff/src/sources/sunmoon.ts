import * as SunCalc from "suncalc";
import type { SunMoon } from "@alarga/types";

const HOUR = 3600_000;

function phaseName(phase: number): string {
  if (phase < 0.03 || phase >= 0.97) return "Yeni ay";
  if (phase < 0.22) return "Büyüyen hilal";
  if (phase < 0.28) return "İlk dördün";
  if (phase < 0.47) return "Büyüyen şişkin ay";
  if (phase < 0.53) return "Dolunay";
  if (phase < 0.72) return "Küçülen şişkin ay";
  if (phase < 0.78) return "Son dördün";
  return "Küçülen hilal";
}

function window(center: number, halfHours: number) {
  return {
    start: new Date(center - halfHours * HOUR).toISOString(),
    end: new Date(center + halfHours * HOUR).toISOString(),
  };
}

/**
 * Güneş/ay zamanları + solunar avlanma pencereleri.
 * Solunar yaklaşımı: ay geçişi (transit) ve ayak-altı (underfoot) → major;
 * ay doğuş/batış → minor. Transit ≈ doğuş-batış orta noktası.
 */
export function sunMoon(lat: number, lon: number, date: Date): SunMoon {
  const sun = SunCalc.getTimes(date, lat, lon);
  const illum = SunCalc.getMoonIllumination(date);
  const mt = SunCalc.getMoonTimes(date, lat, lon);

  const rise = mt.rise ?? null;
  const set = mt.set ?? null;

  let transit: number | null = null;
  if (rise && set) {
    transit = (rise.getTime() + set.getTime()) / 2;
  } else if (rise) {
    transit = rise.getTime() + 6 * HOUR;
  } else if (set) {
    transit = set.getTime() - 6 * HOUR;
  }

  const majorPeriods = [];
  const minorPeriods = [];
  if (transit != null) {
    majorPeriods.push(window(transit, 1.5));
    majorPeriods.push(window(transit + 12 * HOUR, 1.5));
  }
  if (rise) minorPeriods.push(window(rise.getTime(), 1));
  if (set) minorPeriods.push(window(set.getTime(), 1));

  const iso = (d: Date | null | undefined): string =>
    d ? d.toISOString() : "";

  return {
    date: date.toISOString().slice(0, 10),
    sunrise: iso(sun.sunrise),
    sunset: iso(sun.sunset),
    solarNoon: iso(sun.solarNoon),
    moonrise: rise ? rise.toISOString() : null,
    moonset: set ? set.toISOString() : null,
    moonPhase: illum.phase,
    moonIllumination: illum.fraction,
    moonPhaseName: phaseName(illum.phase),
    majorPeriods,
    minorPeriods,
  };
}

export const SUNMOON_ATTRIBUTION = "Güneş/ay: SunCalc (lokal hesap)";
