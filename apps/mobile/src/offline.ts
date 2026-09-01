import {
  type LngLatBounds,
  OfflineManager,
} from "@maplibre/maplibre-react-native";

const PACK_NAME = "bolgem";

export type DownloadState =
  | { status: "idle" }
  | { status: "downloading"; percent: number }
  | { status: "done" }
  | { status: "error"; message: string };

async function deleteExisting(): Promise<void> {
  const packs = await OfflineManager.getPacks().catch(() => []);
  for (const p of packs) {
    if (p.metadata?.name === PACK_NAME) {
      await OfflineManager.deletePack(p.id).catch(() => {});
    }
  }
}

/**
 * Görünen bölgeyi çevrimdışı indirir (tek paket — yeni indirme öncekini değiştirir).
 * z4–13: balıkçının kıyı/liman ayrıntısına yeter, boyutu makul tutar.
 */
export async function downloadRegion(
  mapStyle: string,
  bounds: LngLatBounds,
  onProgress: (s: DownloadState) => void,
): Promise<void> {
  try {
    await deleteExisting();
    onProgress({ status: "downloading", percent: 0 });
    await OfflineManager.createPack(
      {
        mapStyle,
        bounds,
        minZoom: 4,
        maxZoom: 13,
        metadata: { name: PACK_NAME },
      },
      (_pack, status) => {
        const pct = Math.round(status.percentage);
        onProgress(
          status.state === "complete" || pct >= 100
            ? { status: "done" }
            : { status: "downloading", percent: pct },
        );
      },
      (_pack, err) => onProgress({ status: "error", message: err.message }),
    );
  } catch (err) {
    onProgress({ status: "error", message: (err as Error).message });
  }
}

export async function hasOfflineRegion(): Promise<boolean> {
  const packs = await OfflineManager.getPacks().catch(() => []);
  return packs.some((p) => p.metadata?.name === PACK_NAME);
}
