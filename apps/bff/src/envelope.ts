import type { Envelope, Provenance } from "@alarga/types";

export function envelope<T>(
  data: T,
  meta: Omit<Provenance, "fetchedAt" | "expiresAt" | "stale"> & {
    expiresAtMs: number;
    stale: boolean;
  },
): Envelope<T> {
  const { expiresAtMs, stale, ...rest } = meta;
  return {
    data,
    meta: {
      ...rest,
      fetchedAt: new Date().toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
      stale,
    },
  };
}

/** Türkiye ve çevre denizleri kutusu (Karadeniz–Akdeniz). */
export const TR_BBOX = {
  minLat: 34,
  maxLat: 43.5,
  minLon: 25,
  maxLon: 45,
} as const;

/** İstemciden gelen lat/lon'u doğrular; TR kıyı kutusu dışını reddeder. */
export function parseLatLon(q: unknown): { lat: number; lon: number } {
  const o = q as Record<string, string | undefined>;
  const lat = Number(o.lat);
  const lon = Number(o.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new BadRequest("lat ve lon zorunlu sayısal parametreler");
  }
  if (
    lat < TR_BBOX.minLat ||
    lat > TR_BBOX.maxLat ||
    lon < TR_BBOX.minLon ||
    lon > TR_BBOX.maxLon
  ) {
    throw new BadRequest("Konum Türkiye deniz alanı dışında");
  }
  return { lat, lon };
}

export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** `bbox=west,south,east,north` sorgu parametresini ayrıştırır ve TR kutusuna kırpar. */
export function parseBBox(q: unknown): BBox {
  const raw = (q as Record<string, string | undefined>).bbox;
  const parts = (raw ?? "").split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new BadRequest("bbox=batı,güney,doğu,kuzey biçiminde olmalı");
  }
  const [w, s, e, n] = parts as [number, number, number, number];
  return {
    west: Math.max(w, TR_BBOX.minLon),
    south: Math.max(s, TR_BBOX.minLat),
    east: Math.min(e, TR_BBOX.maxLon),
    north: Math.min(n, TR_BBOX.maxLat),
  };
}

export function inBBox(
  b: BBox,
  lat: number,
  lon: number,
): boolean {
  return lat >= b.south && lat <= b.north && lon >= b.west && lon <= b.east;
}

export class BadRequest extends Error {
  statusCode = 400;
}
