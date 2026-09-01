import { layers, namedFlavor } from "@protomaps/basemaps";
import type { FastifyInstance } from "fastify";
import { getOrLoad } from "../cache.ts";
import { getTile, TILE_ATTRIBUTION } from "../sources/pmtiles.ts";

const PUBLIC_URL = process.env.PUBLIC_URL ?? "http://localhost:3000";

// Vektör tile 30 gün cache — coğrafya değişmez, OSM güncellemesi seyrek.
const TILE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function tileRoutes(app: FastifyInstance): void {
  app.get<{ Params: { z: string; x: string; y: string } }>(
    "/tiles/:z/:x/:y.pbf",
    async (req, reply) => {
      const z = Number(req.params.z);
      const x = Number(req.params.x);
      const y = Number(req.params.y);
      if (![z, x, y].every(Number.isInteger) || z < 0 || z > 20) {
        return reply.status(400).send({ error: "geçersiz tile koordinatı" });
      }

      const key = `tile:${z}/${x}/${y}`;
      const tile = await getOrLoad(key, TILE_TTL_MS, () => getTile(z, x, y));

      if (!tile.value) return reply.status(204).send();

      reply.header("content-type", "application/vnd.mapbox-vector-tile");
      reply.header("cache-control", "public, max-age=2592000");
      reply.header("content-encoding", "gzip");
      return reply.send(tile.value);
    },
  );

  app.get("/tiles/style.json", async () => {
    return {
      version: 8,
      glyphs:
        "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
      sprite: "https://protomaps.github.io/basemaps-assets/sprites/v4/light",
      sources: {
        pm: {
          type: "vector",
          tiles: [`${PUBLIC_URL}/tiles/{z}/{x}/{y}.pbf`],
          minzoom: 0,
          maxzoom: 15,
          attribution: TILE_ATTRIBUTION,
        },
        openseamap: {
          type: "raster",
          tiles: ["https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"],
          tileSize: 256,
          maxzoom: 18,
          attribution: "© OpenSeaMap",
        },
      },
      layers: [
        ...layers("pm", namedFlavor("light"), { lang: "tr" }),
        {
          id: "seamarks",
          type: "raster",
          source: "openseamap",
          paint: { "raster-opacity": 0.9 },
        },
      ],
    };
  });
}
