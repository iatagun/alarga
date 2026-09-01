/** alarga paylaşımlı tipler — BFF ↔ mobil. */

// --- Provenance zarfı ---------------------------------------------------------
// Her BFF yanıtı bu zarfla döner. Deterministiklik: veri nereden, ne zaman geldi,
// ne zaman bayatlar. Mobil taraf `stale` ise bayatlık rozeti gösterir.
export interface Provenance {
  /** İnsan-okur kaynak adı, ör. "Open-Meteo". */
  source: string;
  /** Kullanılan model, ör. "ecmwf_ifs04". Yoksa null. */
  model: string | null;
  /** Verinin sağlayıcıdan çekildiği an (ISO 8601, UTC). */
  fetchedAt: string;
  /** Bu yanıtın tazeliğini yitireceği an (ISO 8601, UTC). */
  expiresAt: string;
  /** Sunucu bu yanıtı önbellekten mi verdi ve süresi geçti mi. */
  stale: boolean;
  /** Atıf metni (lisans gereği gösterilecek). */
  attribution: string;
}

export interface Envelope<T> {
  data: T;
  meta: Provenance;
}

// --- Deniz koşulları ---------------------------------------------------------
export interface MarineConditions {
  lat: number;
  lon: number;
  /** Gözlem/tahmin anı (ISO 8601, UTC). */
  time: string;
  windSpeedKn: number | null;
  windGustKn: number | null;
  /** Rüzgar yönü, meteorolojik derece (rüzgarın geldiği yön). null = veri yok. */
  windFromDeg: number | null;
  /** Belirgin dalga yüksekliği (m). null = veri yok (Marine API kıyıya yakın/iç sularda null dönebilir). */
  waveHeightM: number | null;
  /** Ortalama dalga periyodu (s). null = veri yok. */
  wavePeriodS: number | null;
  /** Şişme (swell) yüksekliği (m). null = veri yok. */
  swellHeightM: number | null;
  /** Yağış (mm/saat). null = veri yok. */
  precipitationMm: number | null;
  /** Yıldırım/gök gürültülü fırtına olasılığı (0-100). null = veri yok. */
  thunderstormProb: number | null;
  /** Görüş mesafesi (m). null = veri yok. */
  visibilityM: number | null;
  /** Deniz suyu sıcaklığı (°C). null = veri yok. */
  seaTempC: number | null;
  /** Deniz seviyesi basıncı (hPa). null = veri yok. */
  pressureHpa: number | null;
}

// --- Zengin tahmin (Bugün / Deniz ekranları) ----------------------------
/** Şu anki koşullar — MarineConditions + balıkçı için ek parametreler. */
export interface CurrentConditions extends MarineConditions {
  airTempC: number | null;
  apparentTempC: number | null;
  humidityPct: number | null;
  dewPointC: number | null;
  cloudCoverPct: number | null;
  weatherCode: number | null;
  /** Toplam dalga yönü (nereden), meteorolojik derece. */
  waveDirectionDeg: number | null;
  /** Rüzgar dalgası (deniz) — şişmeden ayrı. */
  windWaveHeightM: number | null;
  windWavePeriodS: number | null;
  windWaveDirectionDeg: number | null;
  swellDirectionDeg: number | null;
  swellPeriodS: number | null;
  /** Deniz seviyesine indirgenmiş basınç (hPa). */
  pressureMslHpa: number | null;
  /** Son 3 saatteki basınç değişimi (hPa). Yükseliş = iyi hava, düşüş = bozulma. */
  pressureTrend3hHpa: number | null;
}

export interface HourlyPoint {
  /** Yerel saat, ISO 8601 (konumun saat dilimi). */
  time: string;
  windSpeedKn: number | null;
  windGustKn: number | null;
  windFromDeg: number | null;
  waveHeightM: number | null;
  wavePeriodS: number | null;
  swellHeightM: number | null;
  precipitationMm: number | null;
  precipitationProbPct: number | null;
  pressureHpa: number | null;
  airTempC: number | null;
  seaTempC: number | null;
  cloudCoverPct: number | null;
  weatherCode: number | null;
}

export interface DailyPoint {
  /** YYYY-MM-DD, konumun yerel günü. */
  date: string;
  weatherCode: number | null;
  tempMinC: number | null;
  tempMaxC: number | null;
  windMaxKn: number | null;
  gustMaxKn: number | null;
  windDomDirDeg: number | null;
  waveMaxM: number | null;
  precipitationSumMm: number | null;
  /** Yerel ISO. */
  sunrise: string;
  sunset: string;
}

export interface ForecastBundle {
  lat: number;
  lon: number;
  /** IANA saat dilimi, ör. "Europe/Istanbul". */
  timezone: string;
  current: CurrentConditions;
  /** Şu andan itibaren 48 saat. */
  hourly: HourlyPoint[];
  /** 7 gün. */
  daily: DailyPoint[];
}

// --- Güneş / Ay / Solunar ----------------------------------------------
export interface SunMoon {
  date: string;
  sunrise: string;
  sunset: string;
  /** Öğle vakti güneş yüksekliği için solar noon. */
  solarNoon: string;
  moonrise: string | null;
  moonset: string | null;
  /** 0 = yeni ay, 0.5 = dolunay, 1 = yeni ay. */
  moonPhase: number;
  /** Aydınlık oran (0-1). */
  moonIllumination: number;
  moonPhaseName: string;
  /** Solunar avlanma pencereleri (yerel ISO başlangıç/bitiş). */
  majorPeriods: { start: string; end: string }[];
  minorPeriods: { start: string; end: string }[];
}

// --- Tekne profili ---------------------------------------------------------
export type BoatSize = "small" | "medium" | "large";

export interface BoatProfile {
  /** small: <7m sandal/fiber · medium: 7-12m · large: >12m. */
  size: BoatSize;
}

// --- Karar (verdict) -------------------------------------------------------
export type VerdictLevel = "green" | "yellow" | "red";

export interface RuleCheck {
  /** Kural kimliği, ör. "wind_speed". */
  id: string;
  /** Kullanıcıya gösterilecek Türkçe açıklama. */
  label: string;
  /** Ölçülen değer. */
  value: number;
  /** Bu tekne için sarı eşiği. */
  yellowAt: number;
  /** Bu tekne için kırmızı eşiği. */
  redAt: number;
  /** Bu kuralın verdiği seviye. */
  level: VerdictLevel;
}

export interface Verdict {
  level: VerdictLevel;
  /** En kötü seviyeyi belirleyen kural (green ise null). */
  triggeredRule: RuleCheck | null;
  /** Tüm kontroller — şeffaflık için hepsi gösterilebilir. */
  checks: RuleCheck[];
  /** Tek satır Türkçe özet, ör. "Rüzgar 22 kn > 18 kn sınırı → KIRMIZI". */
  summary: string;
}

// --- Trafik: gemiler ve uçaklar ------------------------------------------
export type VesselKind =
  | "fishing"
  | "cargo"
  | "tanker"
  | "passenger"
  | "tug"
  | "pleasure"
  | "other";

export interface Vessel {
  mmsi: number;
  name: string | null;
  lat: number;
  lon: number;
  /** Rota (course over ground), meteorolojik derece. null = veri yok. */
  courseDeg: number | null;
  /** Hız (speed over ground), knot. null = veri yok. */
  speedKn: number | null;
  kind: VesselKind;
  /** Son konum zamanı (ISO 8601, UTC). */
  time: string;
}

export interface Aircraft {
  icao24: string;
  callsign: string | null;
  lat: number;
  lon: number;
  /** Barometrik yükseklik (m). null = veri yok. */
  altitudeM: number | null;
  /** Yer hızı (knot). null = veri yok. */
  speedKn: number | null;
  /** Rota (true track), derece. null = veri yok. */
  headingDeg: number | null;
  onGround: boolean;
  /** Son konum zamanı (ISO 8601, UTC). */
  time: string;
}

// --- Fırtına uyarısı: cihaz kaydı + bölge aboneliği ----------------------
export interface AlertSubscription {
  id: string;
  /** Hangi cihaza gidecek (Expo push token). */
  deviceId: string;
  lat: number;
  lon: number;
  boat: BoatProfile;
  /** Kullanıcının bölgeye verdiği ad (ör. "Balık bölgem"). */
  label: string;
  /** En son bildirilen karar seviyesi — tekrar bildirmemek için. */
  lastLevel: VerdictLevel | null;
  createdAt: string;
}

export interface AlertRegistration {
  lat: number;
  lon: number;
  boat: BoatSize;
  label?: string;
}
