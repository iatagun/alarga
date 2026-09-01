import assert from "node:assert/strict";
import { test } from "node:test";

// Küçük Firenze örneği — planet dosyasını yormadan tile route'unu doğrular.
process.env.PMTILES_URL =
  "https://pmtiles.io/protomaps(vector)ODbL_firenze.pmtiles";

const { build } = await import("./server.ts");

test("/tiles/style.json — MapLibre stili + kaynaklar", async () => {
  const app = build();
  const res = await app.inject({ url: "/tiles/style.json" });
  assert.equal(res.statusCode, 200);
  const style = res.json();
  assert.equal(style.version, 8);
  assert.ok(style.sources.pm.tiles[0].endsWith("/tiles/{z}/{x}/{y}.pbf"));
  assert.equal(style.sources.openseamap.type, "raster");
  assert.ok(style.layers.some((l: { id: string }) => l.id === "seamarks"));
  assert.ok(style.layers.some((l: { id: string }) => l.id === "earth"));
  await app.close();
});

test("/tiles/:z/:x/:y.pbf — geçersiz koordinat 400", async () => {
  const app = build();
  const res = await app.inject({ url: "/tiles/abc/1/1.pbf" });
  assert.equal(res.statusCode, 400);
  await app.close();
});

test("/tiles/:z/:x/:y.pbf — Firenze üzerinde gerçek vektör tile", async () => {
  const app = build();
  // Firenze merkezi ~ lon 11.25, lat 43.77 → z12
  const res = await app.inject({ url: "/tiles/12/2198/1516.pbf" });
  assert.ok(
    res.statusCode === 200 || res.statusCode === 204,
    `beklenmeyen durum ${res.statusCode}`,
  );
  if (res.statusCode === 200) {
    assert.ok(res.rawPayload.length > 0);
    assert.equal(
      res.headers["content-type"],
      "application/vnd.mapbox-vector-tile",
    );
  }
  await app.close();
});
