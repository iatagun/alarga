import type { SunMoon } from "@alarga/types";
import type { FastifyInstance } from "fastify";
import { envelope, parseLatLon } from "../envelope.ts";
import { sunMoon, SUNMOON_ATTRIBUTION } from "../sources/sunmoon.ts";

export function sunMoonRoutes(app: FastifyInstance): void {
  // Lokal hesap — cache gereksiz. days=1..7 (bugünden itibaren).
  app.get("/sunmoon", async (req) => {
    const { lat, lon } = parseLatLon(req.query);
    const days = Math.min(
      7,
      Math.max(1, Number((req.query as Record<string, string>).days) || 3),
    );
    const out: SunMoon[] = [];
    const base = new Date();
    base.setHours(12, 0, 0, 0);
    for (let i = 0; i < days; i++) {
      out.push(sunMoon(lat, lon, new Date(base.getTime() + i * 86400_000)));
    }
    return envelope(out, {
      source: "SunCalc",
      model: null,
      attribution: SUNMOON_ATTRIBUTION,
      expiresAtMs: Date.now() + 6 * 3600_000,
      stale: false,
    });
  });
}
