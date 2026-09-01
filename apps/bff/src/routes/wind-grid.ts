import type { FastifyInstance } from "fastify";
import { getOrLoad } from "../cache.ts";
import { type BBox, envelope, parseBBox } from "../envelope.ts";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const TTL_MS = 15 * 60 * 1000;
const GRID = 16; // 16x16 = 256 nokta

export interface WindGrid {
  /** [batı, güney, doğu, kuzey] — grid'in kapsadığı kutu. */
  bbox: [number, number, number, number];
  width: number;
  height: number;
  /** Doğu bileşeni (m/s), satır-öncelikli, KB köşesinden başlar. */
  u: number[];
  /** Kuzey bileşeni (m/s). */
  v: number[];
  /** En yüksek hız (m/s) — renk skalası için. */
  speedMax: number;
}

interface OMPoint {
  current?: { wind_speed_10m?: number | null; wind_direction_10m?: number | null };
}

async function loadWindGrid(b: BBox): Promise<WindGrid> {
  const lats: number[] = [];
  const lons: number[] = [];
  // j=0 kuzey (üst), i=0 batı (sol).
  for (let j = 0; j < GRID; j++) {
    const lat = b.north - (j * (b.north - b.south)) / (GRID - 1);
    for (let i = 0; i < GRID; i++) {
      lats.push(Number(lat.toFixed(4)));
      lons.push(
        Number((b.west + (i * (b.east - b.west)) / (GRID - 1)).toFixed(4)),
      );
    }
  }

  const q = new URLSearchParams({
    latitude: lats.join(","),
    longitude: lons.join(","),
    current: "wind_speed_10m,wind_direction_10m",
    wind_speed_unit: "ms",
    timezone: "UTC",
  });
  const res = await fetch(`${FORECAST_URL}?${q}`, {
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Open-Meteo grid ${res.status}`);
  const points = (await res.json()) as OMPoint[];

  const u: number[] = [];
  const v: number[] = [];
  let speedMax = 1;
  for (const p of points) {
    const sp = p.current?.wind_speed_10m ?? 0;
    const dir = p.current?.wind_direction_10m ?? 0;
    // meteorolojik yön = rüzgârın GELDİĞİ yön → vektör ters yöne bakar
    const rad = (dir * Math.PI) / 180;
    u.push(-sp * Math.sin(rad));
    v.push(-sp * Math.cos(rad));
    if (sp > speedMax) speedMax = sp;
  }

  return {
    bbox: [b.west, b.south, b.east, b.north],
    width: GRID,
    height: GRID,
    u,
    v,
    speedMax: Math.round(speedMax * 10) / 10,
  };
}

export function windGridRoutes(app: FastifyInstance): void {
  app.get("/weather/wind-grid", async (req) => {
    const b = parseBBox(req.query);
    // ~0.1° ızgaraya yuvarla — komşu istekler aynı önbelleği paylaşsın.
    const key = `windgrid:${[b.west, b.south, b.east, b.north]
      .map((n) => n.toFixed(1))
      .join(",")}`;
    const c = await getOrLoad(key, TTL_MS, () => loadWindGrid(b));
    return envelope(c.value, {
      source: "Open-Meteo",
      model: "wind grid",
      attribution: "Rüzgâr alanı: Open-Meteo",
      expiresAtMs: c.expiresAt,
      stale: c.stale,
    });
  });
}
