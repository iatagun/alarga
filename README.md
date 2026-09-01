# alarga

Türkiye kıyılarındaki balıkçılar için deniz/hava durumu uygulaması —
Windy tarzı, full detaylı.

- **Detaylı** — rüzgâr (hız/hamle/yön), dalga (yükseklik/periyot/şişme), deniz suyu,
  basınç + eğilim, görüş, nem, bulut; 48 saatlik meteogram; 7 günlük tahmin;
  güneş/ay/solunar avlanma saatleri; haritada yağmur radarı.
- **Açık kaynak veri** — Open-Meteo (hava + deniz), Protomaps + OpenSeaMap (harita),
  AISStream (gemi), OpenSky (uçak), RainViewer (radar), SunCalc (astronomi).
- **Çevrimdışı** — her yanıt provenance zarfı taşır (`source/model/fetchedAt/stale`);
  sinyalsizken önbellek otoritedir; harita bölgesi indirilebilir.
- Fırtına uyarısı push'u için deterministik kural motoru (sadece sunucuda, ekranda yok).

Ayrıntılı plan: `~/.claude/plans/bu-projede-normalde-yapt-klar-m-zdan-optimized-wilkes.md`

## Yapı

```
packages/types   — BFF ↔ mobil paylaşımlı tipler (provenance zarfı, ForecastBundle, SunMoon, …)
packages/rules   — deterministik karar motoru (evaluateVerdict) — sadece push uyarıları için
apps/bff         — ince Fastify sunucu: veri kaynaklarını birleştirir + önbellek + provenance
apps/mobile      — Expo React Native (expo-router), native MapLibre. 4 sekme:
                   Bugün  — konum → /forecast → parametre grid + 48s meteogram
                   Harita — MapLibre + vektör tile + OpenSeaMap + gemi/uçak/radar katmanları + bölge indir
                   Deniz  — 7 günlük tablo + güneş/ay + solunar avlanma saatleri
                   Uyarılar — bölge için fırtına uyarısı aç/kapa (push)
```

## BFF endpoint'leri

| Endpoint | Ne verir |
|---|---|
| `GET /forecast?lat&lon` | `ForecastBundle`: current (tüm parametreler) + 48s saatlik + 7g günlük |
| `GET /sunmoon?lat&lon&days` | gün/ay doğuş-batış, ay evresi, solunar major/minor pencereler (SunCalc, lokal) |
| `GET /tiles/{z}/{x}/{y}.pbf` · `/tiles/style.json` | Protomaps planet pmtiles'ından vektör tile + MapLibre stili (+ OpenSeaMap) |
| `GET /weather/radar` + `/weather/radar/tiles/{z}/{x}/{y}.png` | RainViewer yağmur radarı (BFF proxy, önbellekli, çevrimdışı-dostu) |
| `GET /weather/layers` + `/weather/tiles/{layer}/{z}/{x}/{y}.png` | OpenWeatherMap rüzgâr/sıcaklık/basınç/bulut katmanları (anahtar BFF'de, proxy) |
| `GET /weather/wind-grid?bbox` | 16×16 rüzgâr u/v alanı (Open-Meteo bulk) — animasyonlu parçacıklar için |
| `GET /vessels?bbox` · `GET /aircraft?bbox` | canlı AIS gemi / OpenSky uçak konumları |
| `POST/GET/DELETE /alerts` | bölge-abonelikli fırtına uyarısı; `jobs/alerts.ts` 30 dk'da değerlendirir → Expo push |

Her yanıt: `{ data, meta: { source, model, fetchedAt, expiresAt, stale, attribution } }`.

### Ortam değişkenleri

| Değişken | Varsayılan / not |
|---|---|
| `PORT` / `PUBLIC_URL` | 3000 / `http://localhost:3000` (style.json'daki tile URL'i için) |
| `PMTILES_URL` | uzak Protomaps planet; üretimde TR extract → `apps/bff/scripts/build-tiles.md` |
| `STORE_FILE` | `apps/bff/.data/store.json` (uyarı abonelikleri). Büyürse Postgres |
| `OWM_API_KEY` | OpenWeatherMap harita katmanları (`apps/bff/.env`, gitignored). Yoksa katmanlar kapalı |
| `AISSTREAM_API_KEY` | yoksa `/vessels` boş döner (aisstream.io ücretsiz) |
| `OPENSKY_CLIENT_ID` / `_SECRET` | opsiyonel OAuth2 (anon ~400/gün, hesapla 4000/gün) |

## Çalıştırma

```bash
npm install
npm test           # tüm workspace testleri
npm run typecheck  # tsc -b
npm run bff        # sunucu :3000
```

Örnek: `curl "http://localhost:3000/forecast?lat=36.78&lon=35.80"`

### Mobil uygulamayı telefonda çalıştırma

Native MapLibre + bildirim modülleri var — **Expo Go yetmez**, dev build gerekir:

```bash
cd apps/mobile && npx expo prebuild --platform android   # native android/ üret (tek sefer)
npx expo run:android                                      # yerel derle + kur (ilk sefer uzun)
# veya bulutta:  eas build --profile development --platform android
```

Sonra USB'yle:

```bash
adb reverse tcp:3000 tcp:3000 && adb reverse tcp:8081 tcp:8081
npm run bff
EXPO_PUBLIC_BFF_URL=http://localhost:3000 npx expo start --dev-client
```

Push bildirimleri için `eas init` (Expo hesabı) gerekir.

## Gereksinim

- Node >= 22 (TypeScript kaynak `--experimental-strip-types` ile doğrudan çalışır; ayrı derleme yok).

## Durum

- [x] Faz 0-5 — monorepo/CI, `/forecast`, harita, gemi+uçak, fırtına uyarısı push
- [x] Faz 6 (pivot) — "Windy tarzı full detay": detaylı Bugün + meteogram · Deniz (7g + güneş/ay/solunar) ·
      harita hava katmanları (yağmur radarı + OWM rüzgâr/sıcaklık/basınç/bulut) ·
      **animasyonlu rüzgâr akışı** (Skia, 1300 parçacık, hıza göre renkli, iz efekti). Cihazda doğrulandı.
- [ ] Faz 6+ — zaman kaydırıcısı (radar + tahmin), uzun solan izler (offscreen buffer)
- [ ] Faz 7 — beta + sahada balıkçılarla eşik kalibrasyonu
