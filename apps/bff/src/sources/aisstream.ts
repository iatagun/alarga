import type { Vessel, VesselKind } from "@alarga/types";
import { TR_BBOX } from "../envelope.ts";

export const AIS_ATTRIBUTION = "Gemi verisi: AISStream.io";

// AIS gemi tipi kodu → kaba kategori (ITU-R M.1371).
function kindFromType(t: number | undefined): VesselKind {
  if (t == null) return "other";
  if (t === 30) return "fishing";
  if (t === 52) return "tug";
  if (t === 36 || t === 37) return "pleasure";
  if (t >= 60 && t <= 69) return "passenger";
  if (t >= 70 && t <= 79) return "cargo";
  if (t >= 80 && t <= 89) return "tanker";
  return "other";
}

// --- Bellek-içi son konum deposu ------------------------------------------
// ponytail: tek makine, tek süreç — Map yeter. Çok instance olursa Redis'e taşı.
const vessels = new Map<number, Vessel>();
const STALE_MS = 60 * 60 * 1000; // 1 saat görülmeyen gemi düşer

export function upsertVessel(patch: Vessel): void {
  const prev = vessels.get(patch.mmsi);
  vessels.set(patch.mmsi, {
    ...prev,
    ...patch,
    // İsim/tip sadece statik mesajda gelir; pozisyon mesajı ezmesin.
    name: patch.name ?? prev?.name ?? null,
    kind: patch.kind !== "other" ? patch.kind : (prev?.kind ?? "other"),
  });
}

export function allVessels(): Vessel[] {
  const cutoff = Date.now() - STALE_MS;
  const out: Vessel[] = [];
  for (const [mmsi, v] of vessels) {
    if (Date.parse(v.time) < cutoff) vessels.delete(mmsi);
    else out.push(v);
  }
  return out;
}

export function vesselCount(): number {
  return vessels.size;
}

// --- AISStream mesaj ayrıştırma (saf fonksiyon, test edilebilir) -----------
interface AisRaw {
  MessageType?: string;
  MetaData?: {
    MMSI?: number;
    ShipName?: string;
    latitude?: number;
    longitude?: number;
    time_utc?: string;
  };
  Message?: {
    PositionReport?: {
      Latitude?: number;
      Longitude?: number;
      Cog?: number;
      Sog?: number;
    };
    ShipStaticData?: { Type?: number; Name?: string };
  };
}

/** Ham AISStream JSON'ından Vessel patch üretir; ilgisizse null. */
export function parseAisMessage(raw: unknown): Vessel | null {
  const m = raw as AisRaw;
  const mmsi = m.MetaData?.MMSI;
  if (!mmsi) return null;
  const time = m.MetaData?.time_utc
    ? new Date(m.MetaData.time_utc).toISOString()
    : new Date().toISOString();
  const name = m.MetaData?.ShipName?.trim() || null;

  if (m.MessageType === "PositionReport") {
    const p = m.Message?.PositionReport ?? {};
    const lat = p.Latitude ?? m.MetaData?.latitude;
    const lon = p.Longitude ?? m.MetaData?.longitude;
    if (lat == null || lon == null) return null;
    return {
      mmsi,
      name,
      lat,
      lon,
      courseDeg: p.Cog != null && p.Cog < 360 ? p.Cog : null,
      speedKn: p.Sog != null && p.Sog < 102.3 ? p.Sog : null,
      kind: "other",
      time,
    };
  }

  if (m.MessageType === "ShipStaticData") {
    const lat = m.MetaData?.latitude;
    const lon = m.MetaData?.longitude;
    if (lat == null || lon == null) return null;
    return {
      mmsi,
      name: name ?? m.Message?.ShipStaticData?.Name?.trim() ?? null,
      lat,
      lon,
      courseDeg: null,
      speedKn: null,
      kind: kindFromType(m.Message?.ShipStaticData?.Type),
      time,
    };
  }

  return null;
}

// --- Websocket bağlantısı ------------------------------------------------
let started = false;

/** AISStream'e kalıcı websocket açar; kopunca yeniden bağlanır. */
export function startAisStream(log: (msg: string) => void): void {
  const key = process.env.AISSTREAM_API_KEY;
  if (!key) {
    log("AISSTREAM_API_KEY yok — gemi katmanı boş çalışacak");
    return;
  }
  if (started) return;
  started = true;

  const connect = () => {
    const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
    ws.addEventListener("open", () => {
      log("AISStream bağlandı");
      ws.send(
        JSON.stringify({
          APIKey: key,
          BoundingBoxes: [
            [
              [TR_BBOX.minLat, TR_BBOX.minLon],
              [TR_BBOX.maxLat, TR_BBOX.maxLon],
            ],
          ],
          FilterMessageTypes: ["PositionReport", "ShipStaticData"],
        }),
      );
    });
    ws.addEventListener("message", (ev) => {
      try {
        const patch = parseAisMessage(JSON.parse(String(ev.data)));
        if (patch) upsertVessel(patch);
      } catch {
        /* bozuk mesajı yut */
      }
    });
    ws.addEventListener("close", () => {
      log("AISStream koptu — 5 sn sonra yeniden bağlanılıyor");
      setTimeout(connect, 5000);
    });
    ws.addEventListener("error", () => ws.close());
  };
  connect();
}
