import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { build } from "./server.ts";
import { upsertVessel } from "./sources/aisstream.ts";

const realFetch = globalThis.fetch;

const OPENSKY_OK = {
  time: 1788200000,
  states: [
    // icao24, callsign, country, time_pos, last_contact, lon, lat, baro_alt, on_ground, velocity, true_track
    ["abc123", "THY123 ", "Turkey", 1788199990, 1788199995, 29.0, 40.9, 10668, false, 240, 95, 0, null, 10700, "1000", false, 0],
    ["def456", null, "Turkey", null, 1788199990, null, null, null, true, null, null, 0, null, null, null, false, 0],
  ],
};

beforeEach(() => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(OPENSKY_OK), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("/aircraft → bbox içi uçaklar, provenance zarfı", async () => {
  const app = build();
  const res = await app.inject({
    url: "/aircraft?bbox=27,39,30,42",
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.meta.source, "OpenSky Network");
  assert.equal(body.data.length, 1); // konumsuz uçak elenir
  assert.equal(body.data[0].callsign, "THY123");
  assert.equal(body.data[0].speedKn, 467); // 240 m/s → kn
  await app.close();
});

test("/aircraft → geçersiz bbox 400", async () => {
  const app = build();
  const res = await app.inject({ url: "/aircraft?bbox=1,2,3" });
  assert.equal(res.statusCode, 400);
  await app.close();
});

test("/vessels → sadece bbox içindeki gemiler", async () => {
  upsertVessel({
    mmsi: 271000999,
    name: "MARMARA",
    lat: 40.7,
    lon: 28.5,
    courseDeg: 45,
    speedKn: 6,
    kind: "fishing",
    time: new Date().toISOString(),
  });
  upsertVessel({
    mmsi: 271000888,
    name: "AKDENIZ",
    lat: 36.5,
    lon: 30.5,
    courseDeg: null,
    speedKn: null,
    kind: "cargo",
    time: new Date().toISOString(),
  });

  const app = build();
  const res = await app.inject({ url: "/vessels?bbox=28,40,29,41" });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  const mmsis = body.data.map((v: { mmsi: number }) => v.mmsi);
  assert.ok(mmsis.includes(271000999));
  assert.ok(!mmsis.includes(271000888));
  await app.close();
});
