import assert from "node:assert/strict";
import { test } from "node:test";
import { sunMoon } from "./sources/sunmoon.ts";
import { build } from "./server.ts";

test("sunMoon: temel alanlar + solunar pencereleri", () => {
  const s = sunMoon(36.78, 35.8, new Date("2026-09-01T12:00:00Z"));
  assert.equal(s.date, "2026-09-01");
  assert.ok(new Date(s.sunrise) < new Date(s.sunset));
  assert.ok(s.moonIllumination >= 0 && s.moonIllumination <= 1);
  assert.ok(s.moonPhaseName.length > 0);
  // ay o gün doğuyor/batıyorsa major + minor pencere olmalı
  assert.ok(s.majorPeriods.length >= 1);
  for (const p of [...s.majorPeriods, ...s.minorPeriods]) {
    assert.ok(new Date(p.start) < new Date(p.end));
  }
});

test("/sunmoon route → days günlük dizi + zarf", async () => {
  const app = build();
  const res = await app.inject({ url: "/sunmoon?lat=41.0&lon=29.0&days=5" });
  assert.equal(res.statusCode, 200);
  const b = res.json();
  assert.equal(b.meta.source, "SunCalc");
  assert.equal(b.data.length, 5);
  assert.match(b.data[0].date, /^\d{4}-\d{2}-\d{2}$/);
  await app.close();
});

test("/sunmoon → TR dışı 400", async () => {
  const app = build();
  const res = await app.inject({ url: "/sunmoon?lat=0&lon=0" });
  assert.equal(res.statusCode, 400);
  await app.close();
});
