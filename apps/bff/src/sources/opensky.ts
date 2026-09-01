import type { Aircraft } from "@alarga/types";
import type { BBox } from "../envelope.ts";

const STATES_URL = "https://opensky-network.org/api/states/all";
const TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";

export const OPENSKY_ATTRIBUTION = "Uçak verisi: The OpenSky Network";

const MS_PER_KN = 1.94384;

// OpenSky anonim erişimi günde ~400 istek ile sınırlı. Prod'da ücretsiz bir
// OAuth2 client (OPENSKY_CLIENT_ID/SECRET) ile 4000/gün. Yoksa anonim denenir.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function bearerToken(): Promise<string | null> {
  const id = process.env.OPENSKY_CLIENT_ID;
  const secret = process.env.OPENSKY_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: id,
    client_secret: secret,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`OpenSky token ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cachedToken.value;
}

// states/all satır dizini şeması (OpenSky REST).
type StateRow = [
  string, // 0 icao24
  string | null, // 1 callsign
  string, // 2 origin_country
  number | null, // 3 time_position
  number, // 4 last_contact
  number | null, // 5 longitude
  number | null, // 6 latitude
  number | null, // 7 baro_altitude
  boolean, // 8 on_ground
  number | null, // 9 velocity (m/s)
  number | null, // 10 true_track
  ...unknown[],
];

export async function fetchAircraft(bbox: BBox): Promise<Aircraft[]> {
  const params = new URLSearchParams({
    lamin: String(bbox.south),
    lomin: String(bbox.west),
    lamax: String(bbox.north),
    lomax: String(bbox.east),
  });
  const token = await bearerToken();
  const res = await fetch(`${STATES_URL}?${params}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`OpenSky ${res.status} ${res.statusText}`);
  const json = (await res.json()) as { time: number; states: StateRow[] | null };

  const out: Aircraft[] = [];
  for (const s of json.states ?? []) {
    const lon = s[5];
    const lat = s[6];
    if (lat == null || lon == null) continue;
    out.push({
      icao24: s[0],
      callsign: s[1]?.trim() || null,
      lat,
      lon,
      altitudeM: s[7],
      speedKn: s[9] == null ? null : Math.round(s[9] * MS_PER_KN),
      headingDeg: s[10],
      onGround: s[8],
      time: new Date((s[3] ?? s[4]) * 1000).toISOString(),
    });
  }
  return out;
}
