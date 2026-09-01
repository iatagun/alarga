import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import type { BoatSize } from "@alarga/types";

export interface Settings {
  boat: BoatSize;
  /** Rüzgâr/hız birimi. */
  windUnit: "kn" | "ms" | "kmh" | "bft";
}

const DEFAULT: Settings = { boat: "small", windUnit: "kn" };
const KEY = "alarga.settings.v2";

interface Ctx {
  settings: Settings;
  ready: boolean;
  update: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) setSettings({ ...DEFAULT, ...JSON.parse(raw) });
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const update = (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  return (
    <SettingsContext.Provider value={{ settings, ready, update }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings SettingsProvider içinde kullanılmalı");
  return ctx;
}

export const BOAT_LABELS: Record<BoatSize, string> = {
  small: "Küçük tekne / sandal (7 m altı)",
  medium: "Orta tekne (7–12 m)",
  large: "Büyük tekne (12 m üstü)",
};
