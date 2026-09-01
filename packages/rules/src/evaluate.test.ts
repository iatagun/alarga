import assert from "node:assert/strict";
import { test } from "node:test";
import type { BoatSize, MarineConditions, VerdictLevel } from "@alarga/types";
import { evaluateVerdict } from "./index.ts";

function conditions(over: Partial<MarineConditions> = {}): MarineConditions {
  return {
    lat: 41,
    lon: 29,
    time: "2026-09-01T06:00:00Z",
    windSpeedKn: 5,
    windGustKn: 7,
    windFromDeg: 0,
    waveHeightM: 0.2,
    wavePeriodS: 5,
    swellHeightM: 0.1,
    precipitationMm: 0,
    thunderstormProb: 0,
    visibilityM: 20000,
    seaTempC: 22,
    pressureHpa: 1015,
    ...over,
  };
}

interface Case {
  name: string;
  size: BoatSize;
  over: Partial<MarineConditions>;
  level: VerdictLevel;
  triggered: string | null;
}

const cases: Case[] = [
  {
    name: "sakin deniz → yeşil",
    size: "small",
    over: {},
    level: "green",
    triggered: null,
  },
  {
    name: "small: 13 kn rüzgar → sarı (12 sınırı)",
    size: "small",
    over: { windSpeedKn: 13 },
    level: "yellow",
    triggered: "wind_speed",
  },
  {
    name: "small: 18 kn rüzgar → kırmızı",
    size: "small",
    over: { windSpeedKn: 18 },
    level: "red",
    triggered: "wind_speed",
  },
  {
    name: "medium: aynı 18 kn rüzgar → hâlâ yeşil",
    size: "medium",
    over: { windSpeedKn: 18 },
    level: "yellow",
    triggered: "wind_speed",
  },
  {
    name: "medium: 17 kn rüzgar → sarı sınırında",
    size: "medium",
    over: { windSpeedKn: 17 },
    level: "yellow",
    triggered: "wind_speed",
  },
  {
    name: "large: 1.9 m dalga → yeşil",
    size: "large",
    over: { waveHeightM: 1.9, windSpeedKn: 10, windGustKn: 12 },
    level: "green",
    triggered: null,
  },
  {
    name: "large: 2.0 m dalga → sarı",
    size: "large",
    over: { waveHeightM: 2.0, windSpeedKn: 10, windGustKn: 12 },
    level: "yellow",
    triggered: "wave_height",
  },
  {
    name: "çoklu ihlal → en kötüsü (kırmızı dalga) tetikler",
    size: "small",
    over: { windSpeedKn: 13, waveHeightM: 1.3 },
    level: "red",
    triggered: "wave_height",
  },
  {
    name: "görüş 800 m → kırmızı (lower_worse)",
    size: "medium",
    over: { visibilityM: 800 },
    level: "red",
    triggered: "visibility",
  },
  {
    name: "görüş 1500 m → sarı",
    size: "medium",
    over: { visibilityM: 1500 },
    level: "yellow",
    triggered: "visibility",
  },
  {
    name: "fırtına olasılığı %65 → kırmızı, tekneden bağımsız",
    size: "large",
    over: { thunderstormProb: 65 },
    level: "red",
    triggered: "thunderstorm",
  },
];

for (const c of cases) {
  test(c.name, () => {
    const v = evaluateVerdict(conditions(c.over), { size: c.size });
    assert.equal(v.level, c.level, `seviye: ${v.summary}`);
    assert.equal(v.triggeredRule?.id ?? null, c.triggered);
    if (c.level === "green") assert.equal(v.triggeredRule, null);
    else assert.ok(v.summary.length > 0);
  });
}

test("veri yoksa yellow döner, yeşil değil", () => {
  const bare = conditions({
    windSpeedKn: NaN,
    windGustKn: NaN,
    waveHeightM: NaN,
    thunderstormProb: null,
    visibilityM: null,
  });
  const v = evaluateVerdict(bare, { size: "small" });
  assert.equal(v.level, "yellow");
  assert.equal(v.checks.length, 0);
});

test("aynı girdi → aynı çıktı (deterministik)", () => {
  const c = conditions({ windSpeedKn: 20, waveHeightM: 1.4 });
  const a = JSON.stringify(evaluateVerdict(c, { size: "small" }));
  const b = JSON.stringify(evaluateVerdict(c, { size: "small" }));
  assert.equal(a, b);
});
