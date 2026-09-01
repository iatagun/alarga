import Constants from "expo-constants";

// Öncelik: EXPO_PUBLIC_BFF_URL env → app.json extra.bffUrl → localhost.
// Gerçek cihazda test için bilgisayarının LAN IP'sini ver, ör:
//   EXPO_PUBLIC_BFF_URL=http://192.168.1.101:3000 npm run mobile
export const BFF_URL: string =
  process.env.EXPO_PUBLIC_BFF_URL ??
  (Constants.expoConfig?.extra as { bffUrl?: string } | undefined)?.bffUrl ??
  "http://localhost:3000";
