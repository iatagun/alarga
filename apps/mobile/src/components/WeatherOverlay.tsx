import { Layer, RasterSource } from "@maplibre/maplibre-react-native";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { fetchRadar, fetchWeatherLayers } from "@/api.ts";

export type WeatherLayerId =
  | "none"
  | "radar"
  | "wind"
  | "temp"
  | "pressure"
  | "clouds";

interface Props {
  layer: WeatherLayerId;
  onInfo: (text: string | null) => void;
}

/** Harita çocuğu — seçili hava katmanını raster olarak bindirir. */
export function WeatherOverlay({ layer, onInfo }: Props) {
  const radar = useQuery({
    queryKey: ["radar"],
    queryFn: fetchRadar,
    enabled: layer === "radar",
    refetchInterval: 4 * 60 * 1000,
  });
  const owm = useQuery({
    queryKey: ["weatherLayers"],
    queryFn: fetchWeatherLayers,
    enabled: layer !== "none" && layer !== "radar",
    staleTime: 60 * 60 * 1000,
  });

  const radarData = radar.data?.data;
  const radarFrame = radarData?.frames[radarData.nowIndex];
  const owmLayer = owm.data?.data.owm.find((l) => l.id === layer);

  useEffect(() => {
    if (layer === "none") return onInfo(null);
    if (layer === "radar") {
      if (!radarFrame) return onInfo("Radar yükleniyor…");
      const t = new Date(radarFrame.time * 1000).toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return onInfo(`Yağmur radarı · ${t}`);
    }
    if (!owmLayer) {
      onInfo("Bu katman sunucuda kapalı (API anahtarı yok)");
      return;
    }
    onInfo(
      layer === "wind"
        ? "Rüzgâr akışı · Open-Meteo + OpenWeatherMap"
        : `${owmLayer.name} · OpenWeatherMap`,
    );
  }, [layer, radarFrame, owmLayer, onInfo]);

  if (layer === "radar" && radarData?.tileUrl) {
    return (
      <RasterSource
        id="wx-radar"
        key={radarData.tileUrl}
        tiles={[radarData.tileUrl]}
        tileSize={256}
        maxzoom={7}
      >
        <Layer id="wx-radar-l" type="raster" paint={{ "raster-opacity": 0.7 }} />
      </RasterSource>
    );
  }
  if (owmLayer) {
    return (
      <RasterSource
        id="wx-owm"
        key={owmLayer.id}
        tiles={[owmLayer.tileUrl]}
        tileSize={256}
        maxzoom={10}
      >
        <Layer
          id="wx-owm-l"
          type="raster"
          paint={{ "raster-opacity": layer === "wind" ? 0.4 : 0.75 }}
        />
      </RasterSource>
    );
  }
  return null;
}
