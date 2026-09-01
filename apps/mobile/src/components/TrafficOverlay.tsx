import {
  GeoJSONSource,
  Layer,
  type PressEventWithFeatures,
} from "@maplibre/maplibre-react-native";
import { useQuery } from "@tanstack/react-query";
import { type BBox, fetchAircraft, fetchVessels } from "@/api.ts";
import { aircraftToGeoJSON, vesselsToGeoJSON } from "@/traffic.ts";

export interface TrafficSelection {
  title: string;
  subtitle: string;
}

interface Props {
  bbox: BBox | null;
  showVessels: boolean;
  showAircraft: boolean;
  onSelect: (s: TrafficSelection) => void;
}

const POLL_MS = 60_000;

/** Harita çocuğu — sadece kaynak/katmanlar döndürür (View içermez). */
export function TrafficOverlay({
  bbox,
  showVessels,
  showAircraft,
  onSelect,
}: Props) {
  const key = bbox ? bbox.map((n) => n.toFixed(2)).join(",") : "none";

  const vessels = useQuery({
    queryKey: ["vessels", key],
    queryFn: () => fetchVessels(bbox as BBox),
    enabled: !!bbox && showVessels,
    refetchInterval: POLL_MS,
  });

  const aircraft = useQuery({
    queryKey: ["aircraft", key],
    queryFn: () => fetchAircraft(bbox as BBox),
    enabled: !!bbox && showAircraft,
    refetchInterval: POLL_MS,
  });

  const handlePress = (e: { nativeEvent: PressEventWithFeatures }) => {
    const p = e.nativeEvent.features[0]?.properties as
      | Record<string, string>
      | undefined;
    if (p) onSelect({ title: p.title, subtitle: p.subtitle });
  };

  return (
    <>
      {showVessels && vessels.data && (
        <GeoJSONSource
          id="vessels"
          data={vesselsToGeoJSON(vessels.data.data)}
          onPress={handlePress}
        >
          <Layer
            id="vessels-dot"
            type="circle"
            minzoom={7}
            paint={{
              "circle-radius": 7,
              "circle-color": [
                "case",
                ["==", ["get", "fishing"], 1],
                "#2E86C1",
                "#7FB3D5",
              ],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#FFFFFF",
            }}
          />
        </GeoJSONSource>
      )}

      {showAircraft && aircraft.data && (
        <GeoJSONSource
          id="aircraft"
          data={aircraftToGeoJSON(aircraft.data.data)}
          onPress={handlePress}
        >
          <Layer
            id="aircraft-dot"
            type="circle"
            minzoom={5}
            paint={{
              "circle-radius": 7,
              "circle-color": "#E67E22",
              "circle-stroke-width": 2,
              "circle-stroke-color": "#FFFFFF",
            }}
          />
        </GeoJSONSource>
      )}
    </>
  );
}
