import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";

process.env.STORE_FILE = join(
  tmpdir(),
  `alarga-store-${process.pid}-${Date.now()}.json`,
);

const { build } = await import("./server.ts");
const { notifyDecision, runAlertCheck } = await import("./jobs/alerts.ts");
const { _resetStore, getSubscriptions } = await import("./store.ts");

const TOKEN = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";
const realFetch = globalThis.fetch;

beforeEach(() => _resetStore());
afterEach(() => {
  globalThis.fetch = realFetch;
});

// --- notifyDecision ------------------------------------------------------
for (const [prev, next, expected] of [
  [null, "green", false],
  [null, "yellow", true],
  ["green", "red", true],
  ["yellow", "red", true],
  ["red", "yellow", false], // küçük iyileşme sessiz
  ["red", "green", true], // her şey sakinleşti
  ["yellow", "yellow", false],
] as const) {
  test(`notifyDecision ${prev} → ${next} = ${expected}`, () => {
    assert.equal(notifyDecision(prev, next).notify, expected);
    assert.equal(notifyDecision(prev, next).store, next);
  });
}

// --- routes -------------------------------------------------------------
test("POST /alerts geçersiz token → 400", async () => {
  const app = build();
  const res = await app.inject({
    method: "POST",
    url: "/alerts",
    payload: { deviceToken: "nope", lat: 41, lon: 29, boat: "small" },
  });
  assert.equal(res.statusCode, 400);
  await app.close();
});

test("POST /alerts → 201, GET listeler, DELETE siler", async () => {
  const app = build();

  const create = await app.inject({
    method: "POST",
    url: "/alerts",
    payload: { deviceToken: TOKEN, lat: 40.9, lon: 28.8, boat: "small" },
  });
  assert.equal(create.statusCode, 201);
  const sub = create.json().subscription;
  assert.equal(sub.label, "Balık bölgen");
  assert.equal(sub.boat.size, "small");

  const list = await app.inject({
    url: `/alerts?deviceToken=${encodeURIComponent(TOKEN)}`,
  });
  assert.equal(list.json().subscriptions.length, 1);

  const del = await app.inject({
    method: "DELETE",
    url: `/alerts/${sub.id}?deviceToken=${encodeURIComponent(TOKEN)}`,
  });
  assert.equal(del.statusCode, 204);
  assert.equal(getSubscriptions(TOKEN).length, 0);
  await app.close();
});

test("POST /alerts ikinci kez → tek abonelik kalır", async () => {
  const app = build();
  for (const lon of [28, 29]) {
    await app.inject({
      method: "POST",
      url: "/alerts",
      payload: { deviceToken: TOKEN, lat: 41, lon, boat: "medium" },
    });
  }
  assert.equal(getSubscriptions(TOKEN).length, 1);
  assert.equal(getSubscriptions(TOKEN)[0]?.lon, 29);
  await app.close();
});

// --- runAlertCheck ----------------------------------------------------
function stubWeather(windKn: number) {
  const T = Array.from({ length: 6 }, (_, i) =>
    new Date(Date.now() + (i - 2) * 3600_000).toISOString().slice(0, 16),
  );
  const arr = (v: number) => T.map(() => v);
  globalThis.fetch = (async (input: string | URL) => {
    const url = String(input);
    if (url.includes("exp.host")) {
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }
    const body = url.includes("marine-api")
      ? {
          current: { wave_height: 0.3, wave_period: 4, swell_wave_height: 0.1, sea_surface_temperature: 20 },
          hourly: { time: T, wave_height: arr(0.3), wave_period: arr(4), swell_wave_height: arr(0.1), sea_surface_temperature: arr(20) },
        }
      : {
          timezone: "UTC",
          current: {
            time: T[2],
            wind_speed_10m: windKn,
            wind_gusts_10m: windKn + 3,
            wind_direction_10m: 180,
            precipitation: 0,
            weather_code: 3,
            pressure_msl: 1010,
            surface_pressure: 1010,
            temperature_2m: 20,
            relative_humidity_2m: 60,
            apparent_temperature: 20,
            cloud_cover: 20,
          },
          hourly: {
            time: T,
            visibility: arr(20000),
            dew_point_2m: arr(12),
            pressure_msl: arr(1010),
            wind_speed_10m: arr(windKn),
            wind_gusts_10m: arr(windKn + 3),
            wind_direction_10m: arr(180),
            temperature_2m: arr(20),
            precipitation: arr(0),
            precipitation_probability: arr(0),
            weather_code: arr(3),
            cloud_cover: arr(20),
            relative_humidity_2m: arr(60),
          },
          daily: {
            time: ["2026-09-01"],
            weather_code: [3], temperature_2m_max: [24], temperature_2m_min: [18],
            sunrise: ["2026-09-01T06:30"], sunset: ["2026-09-01T19:40"],
            precipitation_sum: [0], wind_speed_10m_max: [windKn], wind_gusts_10m_max: [windKn + 3],
            wind_direction_10m_dominant: [180],
          },
        };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
}

test("runAlertCheck: sakin denizde bildirim yok, ilk seviye saklanır", async () => {
  const app = build();
  await app.inject({
    method: "POST",
    url: "/alerts",
    payload: { deviceToken: TOKEN, lat: 41, lon: 29, boat: "small" },
  });
  await app.close();

  stubWeather(4); // green
  const r = await runAlertCheck();
  assert.equal(r.checked, 1);
  assert.equal(r.sent, 0);
  assert.equal(getSubscriptions(TOKEN)[0]?.lastLevel, "green");
});

test("runAlertCheck: sert rüzgar → 1 bildirim, tekrar çalışınca 0", async () => {
  const app = build();
  await app.inject({
    method: "POST",
    url: "/alerts",
    payload: { deviceToken: TOKEN, lat: 41, lon: 29, boat: "small" },
  });
  await app.close();

  stubWeather(25); // red for small boat
  const r1 = await runAlertCheck();
  assert.equal(r1.sent, 1);
  assert.equal(getSubscriptions(TOKEN)[0]?.lastLevel, "red");

  const r2 = await runAlertCheck();
  assert.equal(r2.sent, 0); // seviye değişmedi
});
