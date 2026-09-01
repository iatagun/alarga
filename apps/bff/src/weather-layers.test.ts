import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { build } from "./server.ts";

const realFetch = globalThis.fetch;

const RV_OK = {
  host: "https://tilecache.rainviewer.com",
  radar: {
    past: [
      { time: 1788284400, path: "/v2/radar/aaa" },
      { time: 1788285000, path: "/v2/radar/bbb" },
    ],
    nowcast: [{ time: 1788285600, path: "/v2/radar/ccc" }],
  },
};

beforeEach(() => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(RV_OK), { status: 200 })) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("/weather/layers → OWM anahtarı yoksa owm boş", async () => {
  const prev = process.env.OWM_API_KEY;
  delete process.env.OWM_API_KEY;
  const app = build();
  const res = await app.inject({ url: "/weather/layers" });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json().data.owm, []);
  await app.close();
  if (prev) process.env.OWM_API_KEY = prev;
});

test("/weather/tiles/:layer → anahtar yoksa 404, geçersiz katman 400", async () => {
  const prev = process.env.OWM_API_KEY;
  delete process.env.OWM_API_KEY;
  let app = build();
  assert.equal(
    (await app.inject({ url: "/weather/tiles/wind/6/38/24.png" })).statusCode,
    404,
  );
  await app.close();

  process.env.OWM_API_KEY = "x";
  app = build();
  assert.equal(
    (await app.inject({ url: "/weather/tiles/nope/6/38/24.png" })).statusCode,
    400,
  );
  await app.close();
  if (prev) process.env.OWM_API_KEY = prev;
  else delete process.env.OWM_API_KEY;
});

test("/weather/radar → kareler + tile şablonu + nowIndex", async () => {
  const app = build();
  const res = await app.inject({ url: "/weather/radar" });
  assert.equal(res.statusCode, 200);
  const b = res.json();
  assert.equal(b.data.provider, "RainViewer");
  assert.equal(b.data.frames.length, 3);
  assert.equal(b.data.nowIndex, 1); // son geçmiş kare
  assert.equal(b.data.frames[2].nowcast, true);
  assert.match(
    b.data.frames[0].url,
    /tilecache\.rainviewer\.com\/v2\/radar\/aaa\/256\/\{z\}\/\{x\}\/\{y\}\//,
  );
  await app.close();
});
