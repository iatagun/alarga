import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { colors, space } from "../theme.ts";

/** Sekme ekranlarının başlık çubuğu zaten var — üst güvenli alanı ekleme. */
export function Screen({ children }: { children: ReactNode }) {
  return <View style={styles.inner}>{children}</View>;
}

const styles = StyleSheet.create({
  inner: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
});
