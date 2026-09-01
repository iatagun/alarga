import type { FastifyInstance } from "fastify";
import { getOrLoad } from "../cache.ts";
import { envelope, inBBox, parseBBox } from "../envelope.ts";
import {
  AIS_ATTRIBUTION,
  allVessels,
  vesselCount,
} from "../sources/aisstream.ts";
import { fetchAircraft, OPENSKY_ATTRIBUTION } from "../sources/opensky.ts";

// Uçak: OpenSky anonim kotası düşük — 60 sn cache. Gemi verisi zaten canlı
// websocket'ten, sadece bbox filtresi.
const AIRCRAFT_TTL_MS = 60 * 1000;

export function trafficRoutes(app: FastifyInstance): void {
  app.get("/vessels", async (req) => {
    const bbox = parseBBox(req.query);
    const data = allVessels().filter((v) => inBBox(bbox, v.lat, v.lon));
    return envelope(data, {
      source: "AISStream",
      model: null,
      attribution: AIS_ATTRIBUTION,
      // Canlı akış; 15 sn sonra tazele.
      expiresAtMs: Date.now() + 15_000,
      stale: vesselCount() === 0,
    });
  });

  app.get("/aircraft", async (req) => {
    const bbox = parseBBox(req.query);
    const key = `aircraft:${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
    const cached = await getOrLoad(key, AIRCRAFT_TTL_MS, () =>
      fetchAircraft(bbox),
    );
    return envelope(cached.value, {
      source: "OpenSky Network",
      model: null,
      attribution: OPENSKY_ATTRIBUTION,
      expiresAtMs: cached.expiresAt,
      stale: cached.stale,
    });
  });
}
