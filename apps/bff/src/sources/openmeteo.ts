import type {
  CurrentConditions,
  DailyPoint,
  ForecastBundle,
  HourlyPoint,
  MarineConditions,
} from "@alarga/types";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const MARINE_URL = "https://marine-api.open-meteo.com/v1/marine";

export const OPEN_METEO_ATTRIBUTION =
  "Hava verisi: Open-Meteo.com (CC BY 4.0) · Modeller: ECMWF, GFS";

const HOURS_AHEAD = 48;
const DAYS = 7;

// WMO hava kodundan kaba gök gürültülü fırtına olasılığı proxy'si.
function thunderProbFromCode(code: number | null): number {
  if (code === 99) return 95;
  if (code === 96) return 85;
  if (code === 95) return 70;
  return 0;
}

/** Şimdinin hourly dizisindeki index'i (yerel saat, saat başına yuvarlı). */
function nowHourIndex(times: string[]): number {
  const now = Date.now();
  let best = 0;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let i = 0; i < times.length; i++) {
    const d = Math.abs(new Date(times[i]!).getTime() - now);
    if (d < bestDelta) {
      bestDelta = d;
      best = i;
    }
  }
  return best;
}

type Num = number | null;
const n = (v: number | null | undefined): Num => (v == null ? null : v);
const at = (arr: Num[] | undefined, i: number): Num => n(arr?.[i]);

interface OMForecast {
  timezone: string;
  current: Record<string, number | string | null>;
  hourly: Record<string, (number | string | null)[]>;
  daily: Record<string, (number | string | null)[]>;
}
interface OMMarine {
  current?: Record<string, number | null>;
  hourly?: Record<string, (number | null)[]>;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) {
    throw new Error(`Open-Meteo ${res.status} ${res.statusText} @ ${url}`);
  }
  return (await res.json()) as T;
}

export interface ForecastResult {
  bundle: ForecastBundle;
  model: string;
}

export async function fetchForecast(
  lat: number,
  lon: number,
): Promise<ForecastResult> {
  const fq = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    hourly:
      "temperature_2m,dew_point_2m,relative_humidity_2m,precipitation,precipitation_probability,weather_code,cloud_cover,visibility,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant",
    wind_speed_unit: "kn",
    timezone: "auto",
    forecast_days: String(DAYS),
  });
  const mq = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current:
      "wave_height,wave_direction,wave_period,wind_wave_height,wind_wave_direction,wind_wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,sea_surface_temperature",
    hourly:
      "wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_period,sea_surface_temperature",
    timezone: "auto",
    forecast_days: String(DAYS),
  });

  const [f, m] = await Promise.all([
    fetchJson<OMForecast>(`${FORECAST_URL}?${fq}`),
    fetchJson<OMMarine>(`${MARINE_URL}?${mq}`).catch(() => ({}) as OMMarine),
  ]);

  const fh = f.hourly as Record<string, Num[]>;
  const fhTime = f.hourly.time as string[];
  const mh = m.hourly ?? {};
  const mc = m.current ?? {};
  const fc = f.current;
  const i0 = nowHourIndex(fhTime);

  const num = (v: number | string | null | undefined): Num =>
    typeof v === "number" ? v : null;

  const current: CurrentConditions = {
    lat,
    lon,
    time: String(fc.time),
    windSpeedKn: num(fc.wind_speed_10m),
    windGustKn: num(fc.wind_gusts_10m),
    windFromDeg: num(fc.wind_direction_10m),
    waveHeightM: n(mc.wave_height),
    wavePeriodS: n(mc.wave_period),
    swellHeightM: n(mc.swell_wave_height),
    precipitationMm: num(fc.precipitation),
    thunderstormProb: thunderProbFromCode(num(fc.weather_code)),
    visibilityM: at(fh.visibility, i0),
    seaTempC: n(mc.sea_surface_temperature),
    pressureHpa: num(fc.surface_pressure),
    airTempC: num(fc.temperature_2m),
    apparentTempC: num(fc.apparent_temperature),
    humidityPct: num(fc.relative_humidity_2m),
    dewPointC: at(fh.dew_point_2m, i0),
    cloudCoverPct: num(fc.cloud_cover),
    weatherCode: num(fc.weather_code),
    waveDirectionDeg: n(mc.wave_direction),
    windWaveHeightM: n(mc.wind_wave_height),
    windWavePeriodS: n(mc.wind_wave_period),
    windWaveDirectionDeg: n(mc.wind_wave_direction),
    swellDirectionDeg: n(mc.swell_wave_direction),
    swellPeriodS: n(mc.swell_wave_period),
    pressureMslHpa: num(fc.pressure_msl),
    pressureTrend3hHpa:
      i0 >= 3
        ? subtract(at(fh.pressure_msl, i0), at(fh.pressure_msl, i0 - 3))
        : null,
  };

  const hourly: HourlyPoint[] = [];
  for (let i = i0; i < Math.min(i0 + HOURS_AHEAD, fhTime.length); i++) {
    hourly.push({
      time: fhTime[i]!,
      windSpeedKn: at(fh.wind_speed_10m, i),
      windGustKn: at(fh.wind_gusts_10m, i),
      windFromDeg: at(fh.wind_direction_10m, i),
      waveHeightM: at(mh.wave_height, i),
      wavePeriodS: at(mh.wave_period, i),
      swellHeightM: at(mh.swell_wave_height, i),
      precipitationMm: at(fh.precipitation, i),
      precipitationProbPct: at(fh.precipitation_probability, i),
      pressureHpa: at(fh.pressure_msl, i),
      airTempC: at(fh.temperature_2m, i),
      seaTempC: at(mh.sea_surface_temperature, i),
      cloudCoverPct: at(fh.cloud_cover, i),
      weatherCode: at(fh.weather_code, i),
    });
  }

  const dh = f.daily as Record<string, (number | string | null)[]>;
  const dates = dh.time as string[];
  const daily: DailyPoint[] = dates.map((date, i) => ({
    date,
    weatherCode: num(dh.weather_code?.[i]),
    tempMinC: num(dh.temperature_2m_min?.[i]),
    tempMaxC: num(dh.temperature_2m_max?.[i]),
    windMaxKn: num(dh.wind_speed_10m_max?.[i]),
    gustMaxKn: num(dh.wind_gusts_10m_max?.[i]),
    windDomDirDeg: num(dh.wind_direction_10m_dominant?.[i]),
    waveMaxM: dailyWaveMax(mh, fhTime, date),
    precipitationSumMm: num(dh.precipitation_sum?.[i]),
    sunrise: String(dh.sunrise?.[i] ?? ""),
    sunset: String(dh.sunset?.[i] ?? ""),
  }));

  return {
    bundle: { lat, lon, timezone: f.timezone, current, hourly, daily },
    model: "best_match (ECMWF/GFS)",
  };
}

function subtract(a: Num, b: Num): Num {
  return a == null || b == null ? null : Math.round((a - b) * 10) / 10;
}

/** Marine hourly'den bir günün en yüksek dalgası. */
function dailyWaveMax(
  mh: Record<string, (number | null)[]>,
  times: string[],
  date: string,
): Num {
  const waves = mh.wave_height;
  if (!waves) return null;
  let max: Num = null;
  for (let i = 0; i < times.length; i++) {
    if (!times[i]!.startsWith(date)) continue;
    const w = waves[i];
    if (w != null && (max == null || w > max)) max = w;
  }
  return max;
}

// --- Kural motoru için ince sarmalayıcı (alerts job kullanır) ------------
export interface MarineResult {
  conditions: MarineConditions;
  model: string;
}

export async function fetchMarine(
  lat: number,
  lon: number,
): Promise<MarineResult> {
  const { bundle, model } = await fetchForecast(lat, lon);
  return { conditions: bundle.current, model };
}
