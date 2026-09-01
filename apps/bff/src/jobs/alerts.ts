import type { AlertSubscription, VerdictLevel } from "@alarga/types";
import { evaluateVerdict } from "@alarga/rules";
import { type PushMessage, sendPush } from "../push.ts";
import { fetchMarine } from "../sources/openmeteo.ts";
import { getSubscriptions, updateSubscriptionLevel } from "../store.ts";

const RANK: Record<VerdictLevel, number> = { green: 0, yellow: 1, red: 2 };

export interface NotifyDecision {
  notify: boolean;
  /** Depoya yazılacak yeni seviye (bildirsek de bildirmesek de). */
  store: VerdictLevel;
}

/**
 * Bildirim yalnızca durum KÖTÜLEŞİNCE, ya da her şey sakinleşip yeşile dönünce.
 * Yellow↔red arası küçük oynamalar sessiz güncellenir (bildirim yorgunluğu).
 */
export function notifyDecision(
  prev: VerdictLevel | null,
  next: VerdictLevel,
): NotifyDecision {
  if (prev === next) return { notify: false, store: next };
  const worse = RANK[next] > RANK[prev ?? "green"];
  const allClear = next === "green" && prev !== null;
  return { notify: worse || allClear, store: next };
}

function messageFor(
  sub: AlertSubscription,
  level: VerdictLevel,
  summary: string,
): PushMessage {
  if (level === "green") {
    return {
      to: sub.deviceId,
      title: "Deniz sakinleşti",
      body: `${sub.label}: koşullar düzeldi, çıkabilirsin.`,
    };
  }
  return {
    to: sub.deviceId,
    title: level === "red" ? "⛔ Deniz tehlikeli" : "⚠️ Denize dikkat",
    body: `${sub.label}: ${summary}`,
  };
}

/** Tüm abonelikleri değerlendirir, gerekirse push gönderir. */
export async function runAlertCheck(
  log: (msg: string) => void = () => {},
): Promise<{ checked: number; sent: number }> {
  const subs = getSubscriptions();
  const messages: PushMessage[] = [];

  for (const sub of subs) {
    try {
      const { conditions } = await fetchMarine(sub.lat, sub.lon);
      const verdict = evaluateVerdict(conditions, sub.boat);
      const decision = notifyDecision(sub.lastLevel, verdict.level);
      if (decision.store !== sub.lastLevel) {
        updateSubscriptionLevel(sub.id, decision.store);
      }
      if (decision.notify) {
        messages.push(messageFor(sub, verdict.level, verdict.summary));
      }
    } catch (err) {
      log(`abonelik ${sub.id} kontrol hatası: ${(err as Error).message}`);
    }
  }

  if (messages.length > 0) {
    await sendPush(messages).catch((err) =>
      log(`push gönderilemedi: ${(err as Error).message}`),
    );
  }
  return { checked: subs.length, sent: messages.length };
}

let timer: NodeJS.Timeout | null = null;

/** 30 dakikada bir uyarı kontrolü başlatır. */
export function startAlertJob(log: (msg: string) => void): void {
  if (timer) return;
  const tick = () =>
    runAlertCheck(log)
      .then((r) => {
        if (r.checked > 0) log(`uyarı kontrolü: ${r.checked} bölge, ${r.sent} bildirim`);
      })
      .catch((err) => log(`uyarı işi hatası: ${(err as Error).message}`));
  timer = setInterval(tick, 30 * 60 * 1000);
  timer.unref?.();
  tick();
}
