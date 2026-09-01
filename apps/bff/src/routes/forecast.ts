import type { FastifyInstance } from "fastify";
import { getOrLoad } from "../cache.ts";
import { envelope, parseLatLon } from "../envelope.ts";
import {
  fetchForecast,
  type ForecastResult,
  OPEN_METEO_ATTRIBUTION,
} from "../sources/openmeteo.ts";

// Open-Meteo saatlik güncelleniyor; 20 dk TTL taze veri + kota dostu.
const TTL_MS = 20 * 60 * 1000;

function cacheKey(lat: number, lon: number): string {
  // ~1 km ızgaraya yuvarla — komşu balıkçılar aynı önbelleği paylaşsın.
  return `forecast:${lat.toFixed(2)}:${lon.toFixed(2)}`;
}

export function forecastRoutes(app: FastifyInstance): void {
  app.get("/forecast", async (req) => {
    const { lat, lon } = parseLatLon(req.query);
    const cached = await getOrLoad<ForecastResult>(
      cacheKey(lat, lon),
      TTL_MS,
      () => fetchForecast(lat, lon),
    );
    return envelope(cached.value.bundle, {
      source: "Open-Meteo",
      model: cached.value.model,
      attribution: OPEN_METEO_ATTRIBUTION,
      expiresAtMs: cached.expiresAt,
      stale: cached.stale,
    });
  });
}
