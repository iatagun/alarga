import type { FastifyInstance } from "fastify";
import { getOrLoad } from "../cache.ts";
import { envelope } from "../envelope.ts";

const PUBLIC_URL = process.env.PUBLIC_URL ?? "http://localhost:3000";

// --- RainViewer (yağmur radarı, anahtarsız) ----------------------------
const RV_MAPS = "https://api.rainviewer.com/public/weather-maps.json";
const RV_TILE_OPTS = "256/{z}/{x}/{y}/4/1_1.png";
const RADAR_TTL_MS = 4 * 60 * 1000;

interface RvFrame {
  time: number;
  path: string;
}
interface RvMaps {
  host: string;
  radar: { past: RvFrame[]; nowcast: RvFrame[] };
}

export interface RadarFrames {
  provider: string;
  attribution: string;
  frames: { time: number; nowcast: boolean; url: string }[];
  nowIndex: number;
  /** "Şu an" karesi için BFF proxy tile şablonu (anahtarsız ama önbellekli/çevrimdışı). */
  tileUrl: string;
}

async function loadRadar(): Promise<RadarFrames> {
  const res = await fetch(RV_MAPS, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`RainViewer ${res.status}`);
  const m = (await res.json()) as RvMaps;
  const past = m.radar.past ?? [];
  const nowcast = m.radar.nowcast ?? [];
  const frames = [
    ...past.map((f) => ({ ...f, nowcast: false })),
    ...nowcast.map((f) => ({ ...f, nowcast: true })),
  ].map((f) => ({
    time: f.time,
    nowcast: f.nowcast,
    url: `${m.host}${f.path}/${RV_TILE_OPTS}`,
  }));
  const nowIndex = Math.max(0, past.length - 1);
  return {
    provider: "RainViewer",
    attribution: "Yağmur radarı: RainViewer",
    frames,
    nowIndex,
    // ?t=<kare zamanı> → her yeni karede yeni URL → MapLibre önbelleğini tazeler.
    tileUrl: `${PUBLIC_URL}/weather/radar/tiles/{z}/{x}/{y}.png?t=${frames[nowIndex]?.time ?? 0}`,
  };
}

// --- OpenWeatherMap (rüzgâr/sıcaklık/basınç/bulut, anahtar sunucuda) ----
const OWM_LAYERS: Record<string, string> = {
  wind: "wind_new",
  temp: "temp_new",
  pressure: "pressure_new",
  clouds: "clouds_new",
};
const OWM_TILE_TTL_MS = 30 * 60 * 1000;

export interface WeatherLayer {
  id: string;
  name: string;
  /** MapLibre raster kaynağı için tile şablonu (BFF proxy — anahtar gizli). */
  tileUrl: string;
}

function owmLayers(): WeatherLayer[] {
  if (!process.env.OWM_API_KEY) return [];
  return [
    { id: "wind", name: "Rüzgâr" },
    { id: "temp", name: "Sıcaklık" },
    { id: "pressure", name: "Basınç" },
    { id: "clouds", name: "Bulut" },
  ].map((l) => ({
    ...l,
    tileUrl: `${PUBLIC_URL}/weather/tiles/${l.id}/{z}/{x}/{y}.png`,
  }));
}

export function weatherLayerRoutes(app: FastifyInstance): void {
  app.get("/weather/radar", async () => {
    const c = await getOrLoad("radar", RADAR_TTL_MS, loadRadar);
    return envelope(c.value, {
      source: "RainViewer",
      model: null,
      attribution: c.value.attribution,
      expiresAtMs: c.expiresAt,
      stale: c.stale,
    });
  });

  // RainViewer "şu an" karesi tile proxy — önbellekli, çevrimdışı-dostu.
  app.get<{ Params: { z: string; x: string; y: string } }>(
    "/weather/radar/tiles/:z/:x/:y.png",
    async (req, reply) => {
      const { z, x, y } = req.params;
      if (![z, x, y].every((v) => /^\d+$/.test(v))) {
        return reply.status(400).send({ error: "geçersiz tile" });
      }
      // RainViewer radarı ~z8'e kadar; üstünü placeholder ile döndürüyor.
      if (Number(z) > 8) return reply.status(204).send();
      const meta = await getOrLoad("radar", RADAR_TTL_MS, loadRadar);
      const now = meta.value.frames[meta.value.nowIndex];
      if (!now) return reply.status(204).send();

      const key = `radar-tile:${now.time}:${z}/${x}/${y}`;
      try {
        const png = await getOrLoad(key, RADAR_TTL_MS * 3, async () => {
          const r = await fetch(now.url.replace("{z}/{x}/{y}", `${z}/${x}/${y}`), {
            signal: AbortSignal.timeout(8000),
          });
          if (!r.ok) throw new Error(`RainViewer tile ${r.status}`);
          return Buffer.from(await r.arrayBuffer());
        });
        reply.header("content-type", "image/png");
        reply.header("cache-control", "public, max-age=240");
        return reply.send(png.value);
      } catch {
        return reply.status(204).send();
      }
    },
  );

  app.get("/weather/layers", async () => {
    return envelope(
      { owm: owmLayers() },
      {
        source: "OpenWeatherMap",
        model: null,
        attribution: "Hava katmanları: OpenWeatherMap",
        expiresAtMs: Date.now() + 24 * 3600_000,
        stale: false,
      },
    );
  });

  // OWM tile proxy — anahtar burada, cihaza gitmez.
  app.get<{ Params: { layer: string; z: string; x: string; y: string } }>(
    "/weather/tiles/:layer/:z/:x/:y.png",
    async (req, reply) => {
      const key = process.env.OWM_API_KEY;
      if (!key) return reply.status(404).send({ error: "hava katmanı kapalı" });
      const owm = OWM_LAYERS[req.params.layer];
      if (!owm) return reply.status(400).send({ error: "bilinmeyen katman" });
      const { z, x, y } = req.params;
      if (![z, x, y].every((v) => /^\d+$/.test(v))) {
        return reply.status(400).send({ error: "geçersiz tile" });
      }

      const cacheKey = `owm:${req.params.layer}:${z}/${x}/${y}`;
      let png: Buffer | null = null;
      try {
        const c = await getOrLoad(cacheKey, OWM_TILE_TTL_MS, async () => {
          const url = `https://tile.openweathermap.org/map/${owm}/${z}/${x}/${y}.png?appid=${key}`;
          const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
          if (!r.ok) throw new Error(`OWM ${r.status}`);
          return Buffer.from(await r.arrayBuffer());
        });
        png = c.value;
      } catch {
        // OWM erişilemez / anahtar geçersiz → sessizce boş geç (MapLibre'yi hata
        // spam'ından koru). Katman görünmez ama harita çalışır.
        return reply.status(204).send();
      }

      reply.header("content-type", "image/png");
      reply.header("cache-control", "public, max-age=1800");
      return reply.send(png);
    },
  );
}
