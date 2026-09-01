import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";

export type LocationState =
  | { status: "loading" }
  | { status: "denied" }
  | { status: "error" }
  | { status: "ok"; lat: number; lon: number; fresh: boolean };

/**
 * Konum izni ister. Önce son bilinen konumu (hızlı, ama bayat olabilir) verir,
 * ardından taze bir GPS fix'iyle günceller ve konumu izlemeye devam eder.
 */
export function useLocation(): LocationState {
  const [state, setState] = useState<LocationState>({ status: "loading" });
  const sub = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (perm.status !== "granted") {
        setState({ status: "denied" });
        return;
      }

      // 1) Son bilinen — anında bir şey göster (bayat olabilir).
      try {
        const last = await Location.getLastKnownPositionAsync({
          maxAge: 10 * 60 * 1000,
        });
        if (!cancelled && last) {
          setState({
            status: "ok",
            lat: last.coords.latitude,
            lon: last.coords.longitude,
            fresh: false,
          });
        }
      } catch {
        /* yoksa geç */
      }

      // 2) Taze fix + izleme.
      try {
        sub.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 30_000,
            distanceInterval: 200,
          },
          (pos) => {
            if (!cancelled) {
              setState({
                status: "ok",
                lat: pos.coords.latitude,
                lon: pos.coords.longitude,
                fresh: true,
              });
            }
          },
        );
      } catch {
        if (!cancelled) {
          setState((s) => (s.status === "ok" ? s : { status: "error" }));
        }
      }
    })();

    return () => {
      cancelled = true;
      sub.current?.remove();
    };
  }, []);

  return state;
}
