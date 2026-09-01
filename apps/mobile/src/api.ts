import type {
  Aircraft,
  AlertRegistration,
  AlertSubscription,
  Envelope,
  ForecastBundle,
  SunMoon,
  Vessel,
} from "@alarga/types";
import { BFF_URL } from "./config.ts";

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BFF_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? `Sunucu hatası (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

const getJson = <T>(path: string) => request<Envelope<T>>(path);

export function fetchForecast(
  lat: number,
  lon: number,
): Promise<Envelope<ForecastBundle>> {
  return getJson(`/forecast?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`);
}

export function fetchSunMoon(
  lat: number,
  lon: number,
  days = 7,
): Promise<Envelope<SunMoon[]>> {
  return getJson(
    `/sunmoon?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&days=${days}`,
  );
}

export interface RadarFrames {
  provider: string;
  attribution: string;
  frames: { time: number; nowcast: boolean; url: string }[];
  nowIndex: number;
  tileUrl: string;
}

export function fetchRadar(): Promise<Envelope<RadarFrames>> {
  return getJson("/weather/radar");
}

export interface WeatherLayer {
  id: string;
  name: string;
  tileUrl: string;
}

export function fetchWeatherLayers(): Promise<
  Envelope<{ owm: WeatherLayer[] }>
> {
  return getJson("/weather/layers");
}

export interface WindGrid {
  bbox: [number, number, number, number];
  width: number;
  height: number;
  u: number[];
  v: number[];
  speedMax: number;
}

export function fetchWindGrid(b: BBox): Promise<Envelope<WindGrid>> {
  return getJson(`/weather/wind-grid?${bboxParam(b)}`);
}

/** bbox = [batı, güney, doğu, kuzey] (MapLibre getBounds ile aynı sıra). */
export type BBox = [number, number, number, number];

function bboxParam(b: BBox): string {
  return `bbox=${b.map((n) => n.toFixed(3)).join(",")}`;
}

export function fetchVessels(b: BBox): Promise<Envelope<Vessel[]>> {
  return getJson(`/vessels?${bboxParam(b)}`);
}

export function fetchAircraft(b: BBox): Promise<Envelope<Aircraft[]>> {
  return getJson(`/aircraft?${bboxParam(b)}`);
}

// --- Fırtına uyarısı abonelikleri --------------------------------------
export function getAlerts(
  deviceToken: string,
): Promise<{ subscriptions: AlertSubscription[] }> {
  return request(`/alerts?deviceToken=${encodeURIComponent(deviceToken)}`);
}

export function createAlert(
  deviceToken: string,
  reg: AlertRegistration,
): Promise<{ subscription: AlertSubscription }> {
  return request("/alerts", {
    method: "POST",
    body: JSON.stringify({ ...reg, deviceToken }),
  });
}

export function deleteAlert(
  deviceToken: string,
  id: string,
): Promise<void> {
  return request(
    `/alerts/${id}?deviceToken=${encodeURIComponent(deviceToken)}`,
    { method: "DELETE" },
  );
}
