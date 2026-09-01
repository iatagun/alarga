import assert from "node:assert/strict";
import { test } from "node:test";
import {
  allVessels,
  parseAisMessage,
  upsertVessel,
} from "./sources/aisstream.ts";

test("PositionReport → konum + hız/rota", () => {
  const v = parseAisMessage({
    MessageType: "PositionReport",
    MetaData: { MMSI: 271000123, ShipName: "KARADENIZ", time_utc: "2026-09-01 06:00:00.0 +0000 UTC" },
    Message: { PositionReport: { Latitude: 41.1, Longitude: 29.2, Cog: 90, Sog: 7.5 } },
  });
  assert.equal(v?.mmsi, 271000123);
  assert.equal(v?.lat, 41.1);
  assert.equal(v?.speedKn, 7.5);
  assert.equal(v?.courseDeg, 90);
  assert.equal(v?.kind, "other");
});

test("ShipStaticData → tip kategorisi (30 = balıkçı)", () => {
  const v = parseAisMessage({
    MessageType: "ShipStaticData",
    MetaData: { MMSI: 271000123, latitude: 41.1, longitude: 29.2 },
    Message: { ShipStaticData: { Type: 30 } },
  });
  assert.equal(v?.kind, "fishing");
});

test("geçersiz mesaj → null", () => {
  assert.equal(parseAisMessage({ MessageType: "PositionReport", MetaData: {} }), null);
  assert.equal(parseAisMessage({ foo: 1 }), null);
});

test("upsert: statik veri ismi/tipi pozisyon mesajıyla silinmez", () => {
  upsertVessel({
    mmsi: 999000111,
    name: "EGE 1",
    lat: 38,
    lon: 26,
    courseDeg: null,
    speedKn: null,
    kind: "fishing",
    time: new Date().toISOString(),
  });
  upsertVessel({
    mmsi: 999000111,
    name: null,
    lat: 38.01,
    lon: 26.01,
    courseDeg: 180,
    speedKn: 5,
    kind: "other",
    time: new Date().toISOString(),
  });
  const v = allVessels().find((x) => x.mmsi === 999000111);
  assert.equal(v?.name, "EGE 1");
  assert.equal(v?.kind, "fishing");
  assert.equal(v?.lat, 38.01);
  assert.equal(v?.speedKn, 5);
});

test("bayat gemi (1 saatten eski) listeden düşer", () => {
  upsertVessel({
    mmsi: 111222333,
    name: "ESKI",
    lat: 40,
    lon: 28,
    courseDeg: null,
    speedKn: null,
    kind: "other",
    time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  });
  assert.equal(
    allVessels().some((x) => x.mmsi === 111222333),
    false,
  );
});
