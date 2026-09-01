const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface PushMessage {
  to: string;
  title: string;
  body: string;
}

/** Expo push servisi üzerinden bildirim gönderir (FCM/APNs'i Expo hallediyor). */
export async function sendPush(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return;
  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(
      messages.map((m) => ({ ...m, sound: "default", priority: "high" })),
    ),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`Expo push ${res.status}: ${await res.text()}`);
  }
}

export function isExpoPushToken(token: string): boolean {
  return (
    token.startsWith("ExponentPushToken[") ||
    token.startsWith("ExpoPushToken[")
  );
}
