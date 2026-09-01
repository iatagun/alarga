import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { build } from "./server.ts";

const realFetch = globalThis.fetch;

function hours(n: number, start = Date.parse("2026-09-01T00:00:00")): string[] {
  return Array.from({ length: n }, (_, i) =>
    new Date(start + i * 3600_000).toISOString().slice(0, 16),
  );
}

const H = hours(168);
const NOW_ISO = new Date().toISOString().slice(0, 16);

const FORECAST_OK = {
  timezone: "Europe/Istanbul",
  current: {
    time: NOW_ISO,
    temperature_2m: 24,
    relative_humidity_2m: 60,
    apparent_temperature: 25,
    precipitation: 0,
    weather_code: 2,
    cloud_cover: 40,
    pressure_msl: 1014,
    surface_pressure: 1012,
    wind_speed_10m: 12,
    wind_direction_10m: 200,
    wind_gusts_10m: 18,
  },
  hourly: {
    time: H,
    temperature_2m: H.map(() => 22),
    dew_point_2m: H.map(() => 15),
    relative_humidity_2m: H.map(() => 65),
    precipitation: H.map(() => 0),
    precipitation_probability: H.map(() => 5),
    weather_code: H.map(() => 2),
    cloud_cover: H.map(() => 30),
    visibility: H.map(() => 24000),
    pressure_msl: H.map((_, i) => 1014 - i * 0.1),
    wind_speed_10m: H.map(() => 10),
    wind_direction_10m: H.map(() => 210),
    wind_gusts_10m: H.map(() => 15),
  },
  daily: {
    time: ["2026-09-01", "2026-09-02", "2026-09-03"],
    weather_code: [2, 3, 61],
    temperature_2m_max: [27, 26, 24],
    temperature_2m_min: [19, 18, 17],
    sunrise: ["2026-09-01T06:30", "2026-09-02T06:31", "2026-09-03T06:32"],
    sunset: ["2026-09-01T19:40", "2026-09-02T19:38", "2026-09-03T19:36"],
    precipitation_sum: [0, 0, 4.2],
    wind_speed_10m_max: [16, 20, 25],
    wind_gusts_10m_max: [22, 28, 34],
    wind_direction_10m_dominant: [200, 210, 220],
  },
};

const MARINE_OK = {
  current: {
    wave_height: 0.6,
    wave_direction: 190,
    wave_period: 4.5,
    wind_wave_height: 0.5,
    wind_wave_direction: 195,
    wind_wave_period: 3.8,
    swell_wave_height: 0.3,
    swell_wave_direction: 170,
    swell_wave_period: 8,
    sea_surface_temperature: 25.5,
  },
  hourly: {
    time: H,
    wave_height: H.map((_, i) => 0.4 + (i % 12) * 0.05),
    wave_period: H.map(() => 4),
    wave_direction: H.map(() => 190),
    swell_wave_height: H.map(() => 0.3),
    swell_wave_period: H.map(() => 8),
    sea_surface_temperature: H.map(() => 25),
  },
};

beforeEach(() => {
  globalThis.fetch = (async (input: string | URL) => {
    const url = String(input);
    const body = url.includes("marine-api") ? MARINE_OK : FORECAST_OK;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("/forecast → provenance zarfı + current + hourly + daily", async () => {
  const app = build();
  const res = await app.inject({ url: "/forecast?lat=41.0&lon=29.0" });
  assert.equal(res.statusCode, 200);
  const b = res.json();
  assert.equal(b.meta.source, "Open-Meteo");
  assert.equal(b.data.timezone, "Europe/Istanbul");
  assert.equal(b.data.current.windSpeedKn, 12);
  assert.equal(b.data.current.waveHeightM, 0.6);
  assert.equal(b.data.current.seaTempC, 25.5);
  assert.equal(b.data.current.swellPeriodS, 8);
  // basınç düşüyor → negatif trend
  assert.ok(b.data.current.pressureTrend3hHpa < 0);
  assert.ok(b.data.hourly.length > 0 && b.data.hourly.length <= 48);
  assert.equal(b.data.daily.length, 3);
  assert.equal(b.data.daily[2].precipitationSumMm, 4.2);
  assert.ok(b.data.daily[0].waveMaxM > 0);
  await app.close();
});

test("/forecast → TR alanı dışı 400", async () => {
  const app = build();
  const res = await app.inject({ url: "/forecast?lat=10&lon=10" });
  assert.equal(res.statusCode, 400);
  await app.close();
});

test("/forecast → marine API çökerse dalga null, yine 200", async () => {
  globalThis.fetch = (async (input: string | URL) => {
    const url = String(input);
    if (url.includes("marine-api")) throw new Error("marine down");
    return new Response(JSON.stringify(FORECAST_OK), { status: 200 });
  }) as typeof fetch;

  const app = build();
  const res = await app.inject({ url: "/forecast?lat=41.5&lon=29.5" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().data.current.waveHeightM, null);
  assert.equal(res.json().data.current.windSpeedKn, 12);
  await app.close();
});

test("/forecast → hava kaynağı çökerse ve önbellek yoksa 502", async () => {
  globalThis.fetch = (async () => {
    throw new Error("network down");
  }) as typeof fetch;
  const app = build();
  const res = await app.inject({ url: "/forecast?lat=42.0&lon=30.0" });
  assert.equal(res.statusCode, 502);
  await app.close();
});
