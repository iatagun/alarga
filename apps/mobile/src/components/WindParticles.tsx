import { Canvas, Path, Skia, type SkPath } from "@shopify/react-native-skia";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFrameCallback, useSharedValue } from "react-native-reanimated";
import { type BBox, fetchWindGrid } from "@/api.ts";
import { colors } from "@/theme.ts";

const N = 1300;
const MAX_AGE = 3.2; // saniye
const GAIN = 340; // görsel abartma (gerçek rüzgâr harita ölçeğinde görünmez)
const TRAIL = 5; // iz noktası sayısı
const STRIDE = 1 + TRAIL * 2; // [age, x0,y0, x1,y1, ...]

// hıza (m/s) göre kova: 0=sakin 1=orta 2=kuvvetli 3=fırtına
const BUCKET_COLOR = [colors.calm, colors.moderate, colors.rough, colors.severe];
function bucket(sp: number): number {
  "worklet";
  if (sp >= 17) return 3;
  if (sp >= 11) return 2;
  if (sp >= 5.5) return 1;
  return 0;
}

interface Props {
  bbox: BBox | null;
  active: boolean;
}

/** Windy tarzı animasyonlu rüzgâr akışı — Skia canvas, harita üstünde. */
export function WindParticles({ bbox, active }: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });

  const key = bbox ? bbox.map((n) => n.toFixed(2)).join(",") : "none";
  const q = useQuery({
    queryKey: ["windGrid", key],
    queryFn: () => fetchWindGrid(bbox as BBox),
    enabled: !!bbox,
    staleTime: 10 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
  });
  const grid = q.data?.data;

  const empty = useMemo(() => Skia.PathBuilder.Make().build(), []);
  const parts = useSharedValue<number[]>([]);
  const p0 = useSharedValue<SkPath>(empty);
  const p1 = useSharedValue<SkPath>(empty);
  const p2 = useSharedValue<SkPath>(empty);
  const p3 = useSharedValue<SkPath>(empty);

  useEffect(() => {
    const a: number[] = new Array(N * STRIDE).fill(0);
    for (let k = 0; k < N; k++) {
      const b = k * STRIDE;
      const x = Math.random();
      const y = Math.random();
      a[b] = Math.random() * MAX_AGE;
      for (let t = 0; t < TRAIL; t++) {
        a[b + 1 + t * 2] = x;
        a[b + 2 + t * 2] = y;
      }
    }
    parts.value = a;
  }, [parts]);

  const params = useMemo(() => {
    if (!bbox || !grid || size.w === 0) return null;
    const [w, s, e, n] = bbox;
    const midLat = ((s + n) / 2) * (Math.PI / 180);
    return {
      gw: grid.width,
      gh: grid.height,
      u: grid.u,
      v: grid.v,
      sx: 1 / ((e - w) * 111320 * Math.cos(midLat)),
      sy: 1 / ((n - s) * 110540),
      W: size.w,
      H: size.h,
    };
  }, [bbox, grid, size]);

  useFrameCallback((info) => {
    "worklet";
    if (!params || !active || parts.value.length === 0) return;
    const dt = Math.min(info.timeSincePreviousFrame ?? 16, 40) / 1000;
    const { gw, gh, u, v, sx, sy, W, H } = params;
    const p = parts.value;
    const out = [
      Skia.PathBuilder.Make(),
      Skia.PathBuilder.Make(),
      Skia.PathBuilder.Make(),
      Skia.PathBuilder.Make(),
    ];

    for (let k = 0; k < N; k++) {
      const b = k * STRIDE;
      let hx = p[b + 1 + (TRAIL - 1) * 2]!;
      let hy = p[b + 2 + (TRAIL - 1) * 2]!;
      let age = p[b]! + dt;

      // grid örnekleme (bilinear)
      const gx = hx * (gw - 1);
      const gy = hy * (gh - 1);
      let ix = Math.floor(gx);
      let iy = Math.floor(gy);
      if (ix > gw - 2) ix = gw - 2;
      if (iy > gh - 2) iy = gh - 2;
      if (ix < 0) ix = 0;
      if (iy < 0) iy = 0;
      const fx = gx - ix;
      const fy = gy - iy;
      const i0 = iy * gw + ix;
      const uu =
        u[i0]! * (1 - fx) * (1 - fy) +
        u[i0 + 1]! * fx * (1 - fy) +
        u[i0 + gw]! * (1 - fx) * fy +
        u[i0 + gw + 1]! * fx * fy;
      const vv =
        v[i0]! * (1 - fx) * (1 - fy) +
        v[i0 + 1]! * fx * (1 - fy) +
        v[i0 + gw]! * (1 - fx) * fy +
        v[i0 + gw + 1]! * fx * fy;

      const nx = hx + uu * sx * GAIN * dt;
      const ny = hy - vv * sy * GAIN * dt;

      if (age > MAX_AGE || nx < 0 || nx > 1 || ny < 0 || ny > 1) {
        const rx = Math.random();
        const ry = Math.random();
        p[b] = 0;
        for (let t = 0; t < TRAIL; t++) {
          p[b + 1 + t * 2] = rx;
          p[b + 2 + t * 2] = ry;
        }
        continue;
      }

      // izi kaydır, yeni başı ekle
      for (let t = 0; t < TRAIL - 1; t++) {
        p[b + 1 + t * 2] = p[b + 1 + (t + 1) * 2]!;
        p[b + 2 + t * 2] = p[b + 2 + (t + 1) * 2]!;
      }
      p[b + 1 + (TRAIL - 1) * 2] = nx;
      p[b + 2 + (TRAIL - 1) * 2] = ny;
      p[b] = age;

      const sp = Math.sqrt(uu * uu + vv * vv);
      const path = out[bucket(sp)]!;
      path.moveTo(p[b + 1]! * W, p[b + 2]! * H);
      for (let t = 1; t < TRAIL; t++) {
        path.lineTo(p[b + 1 + t * 2]! * W, p[b + 2 + t * 2]! * H);
      }
    }
    p0.value = out[0]!.build();
    p1.value = out[1]!.build();
    p2.value = out[2]!.build();
    p3.value = out[3]!.build();
  });

  if (!grid) return null;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(ev) =>
        setSize({
          w: ev.nativeEvent.layout.width,
          h: ev.nativeEvent.layout.height,
        })
      }
    >
      <Canvas style={{ flex: 1, opacity: active ? 0.95 : 0 }}>
        <Path path={p0} color={BUCKET_COLOR[0]} style="stroke" strokeWidth={1.6} strokeCap="round" strokeJoin="round" />
        <Path path={p1} color={BUCKET_COLOR[1]} style="stroke" strokeWidth={1.8} strokeCap="round" strokeJoin="round" />
        <Path path={p2} color={BUCKET_COLOR[2]} style="stroke" strokeWidth={2.1} strokeCap="round" strokeJoin="round" />
        <Path path={p3} color={BUCKET_COLOR[3]} style="stroke" strokeWidth={2.4} strokeCap="round" strokeJoin="round" />
      </Canvas>
    </View>
  );
}
