import type { Aircraft, Vessel, VesselKind } from "@alarga/types";

export const KIND_TR: Record<VesselKind, string> = {
  fishing: "Balıkçı teknesi",
  cargo: "Yük gemisi",
  tanker: "Tanker",
  passenger: "Yolcu gemisi",
  tug: "Römorkör",
  pleasure: "Tekne / yat",
  other: "Gemi",
};

type FC = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: Record<string, string | number>;
  }[];
};

export function vesselsToGeoJSON(list: Vessel[]): FC {
  return {
    type: "FeatureCollection",
    features: list.map((v) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [v.lon, v.lat] },
      properties: {
        mmsi: v.mmsi,
        title: v.name ?? KIND_TR[v.kind],
        subtitle:
          v.speedKn == null
            ? KIND_TR[v.kind]
            : `${KIND_TR[v.kind]} • ${v.speedKn.toFixed(1)} knot`,
        fishing: v.kind === "fishing" ? 1 : 0,
      },
    })),
  };
}

export function aircraftToGeoJSON(list: Aircraft[]): FC {
  return {
    type: "FeatureCollection",
    features: list.map((a) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [a.lon, a.lat] },
      properties: {
        icao24: a.icao24,
        title: a.callsign ?? a.icao24.toUpperCase(),
        subtitle: [
          a.altitudeM != null ? `${Math.round(a.altitudeM)} m` : null,
          a.speedKn != null ? `${a.speedKn} knot` : null,
        ]
          .filter(Boolean)
          .join(" • "),
      },
    })),
  };
}
