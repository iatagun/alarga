import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { build } from "./server.ts";

const realFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = (async (input: string | URL) => {
    const url = new URL(String(input));
    const lats = url.searchParams.get("latitude")!.split(",");
    const body = lats.map((_, i) => ({
      current: {
        wind_speed_10m: 5 + (i % 4),
        wind_direction_10m: 270, // batıdan → doğuya akış (u>0)
      },
    }));
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("/weather/wind-grid → 16x16 u/v alanı, batı rüzgârı u>0", async () => {
  const app = build();
  const res = await app.inject({
    url: "/weather/wind-grid?bbox=27,39,30,42",
  });
  assert.equal(res.statusCode, 200);
  const g = res.json().data;
  assert.equal(g.width, 16);
  assert.equal(g.height, 16);
  assert.equal(g.u.length, 256);
  assert.equal(g.v.length, 256);
  // 270° = batıdan → u pozitif (doğuya), v ~0
  assert.ok(g.u[0] > 0);
  assert.ok(Math.abs(g.v[0]) < 0.01);
  assert.ok(g.speedMax >= 5);
  await app.close();
});

test("/weather/wind-grid → geçersiz bbox 400", async () => {
  const app = build();
  const res = await app.inject({ url: "/weather/wind-grid?bbox=1,2,3" });
  assert.equal(res.statusCode, 400);
  await app.close();
});
