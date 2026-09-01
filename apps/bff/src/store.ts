import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { AlertSubscription } from "@alarga/types";

// ponytail: JSON dosya deposu — birkaç yüz cihaz için yeter. Büyürse Postgres'e
// taşı (arayüz: getSubscriptions / addSubscription / ... aynı kalır).
const FILE = process.env.STORE_FILE ?? "apps/bff/.data/store.json";

interface StoreData {
  subscriptions: AlertSubscription[];
}

let data: StoreData | null = null;
let saveTimer: NodeJS.Timeout | null = null;

function load(): StoreData {
  if (data) return data;
  try {
    data = JSON.parse(readFileSync(FILE, "utf8")) as StoreData;
  } catch {
    data = { subscriptions: [] };
  }
  return data;
}

function scheduleSave(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const d = load();
    mkdirSync(dirname(FILE), { recursive: true });
    const tmp = `${FILE}.tmp`;
    writeFileSync(tmp, JSON.stringify(d, null, 2));
    renameSync(tmp, FILE);
  }, 200);
  saveTimer.unref?.();
}

export function getSubscriptions(deviceToken?: string): AlertSubscription[] {
  const subs = load().subscriptions;
  return deviceToken ? subs.filter((s) => s.deviceId === deviceToken) : subs;
}

export function addSubscription(sub: AlertSubscription): void {
  load().subscriptions.push(sub);
  scheduleSave();
}

export function removeSubscription(id: string, deviceToken: string): boolean {
  const d = load();
  const before = d.subscriptions.length;
  d.subscriptions = d.subscriptions.filter(
    (s) => !(s.id === id && s.deviceId === deviceToken),
  );
  if (d.subscriptions.length === before) return false;
  scheduleSave();
  return true;
}

export function updateSubscriptionLevel(
  id: string,
  level: AlertSubscription["lastLevel"],
): void {
  const sub = load().subscriptions.find((s) => s.id === id);
  if (sub) {
    sub.lastLevel = level;
    scheduleSave();
  }
}

/** Sadece test için — belleği sıfırla. */
export function _resetStore(): void {
  data = { subscriptions: [] };
}
