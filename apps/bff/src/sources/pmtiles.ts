import { open, type FileHandle } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { PMTiles, type Source } from "pmtiles";

// Varsayılan: Protomaps planet v4 (134 GB) — pmtiles range-request ile sadece
// gereken tile'ı çeker, dosyayı indirmez. Prod'da Türkiye extract'ı ile değiştir:
//   PMTILES_URL=/data/turkey.pmtiles   (üretimi: scripts/build-tiles.md)
const PMTILES_URL =
  process.env.PMTILES_URL ??
  "https://data.source.coop/protomaps/openstreetmap/v4.pmtiles";

/** Yerel dosya için pmtiles Source (npm'deki FileSource tarayıcı Blob'u bekliyor). */
class NodeFileSource implements Source {
  private path: string;
  private handle: Promise<FileHandle>;
  constructor(path: string) {
    this.path = path;
    this.handle = open(path, "r");
  }
  getKey() {
    return this.path;
  }
  async getBytes(offset: number, length: number) {
    const fh = await this.handle;
    const buf = Buffer.alloc(length);
    await fh.read(buf, 0, length, offset);
    return { data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + length) };
  }
}

let instance: PMTiles | null = null;

function pmtiles(): PMTiles {
  if (!instance) {
    const src: string | Source = /^https?:/.test(PMTILES_URL)
      ? PMTILES_URL
      : new NodeFileSource(PMTILES_URL);
    instance = new PMTiles(src);
  }
  return instance;
}

/**
 * Tek bir vektör tile döndürür; yoksa null.
 * `pmtiles` lib `getZxy` verisi zaten açılmış (raw MVT) döndürür — biz gzip'leyip
 * `Content-Encoding: gzip` ile sunuyoruz (bant genişliği). MapLibre'ye çift-decompress
 * yaşatmamak için: raw'ı asla "gzip" diye etiketleme.
 */
export async function getTile(
  z: number,
  x: number,
  y: number,
): Promise<Buffer | null> {
  const res = await pmtiles().getZxy(z, x, y);
  if (!res) return null;
  return gzipSync(Buffer.from(res.data));
}

export const TILE_ATTRIBUTION =
  "© OpenStreetMap katkıcıları · Protomaps";
