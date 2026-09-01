import { StyleSheet, Text, View } from "react-native";
import { Screen } from "./Screen.tsx";
import { colors, type } from "../theme.ts";

/** Henüz yapılmamış ekranlar için geçici yer tutucu. */
export function Soon({ emoji, title }: { emoji: string; title: string }) {
  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={{ fontSize: 64 }}>{emoji}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>Yakında</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  title: {
    color: colors.text,
    fontWeight: "800",
    fontSize: type.h2,
    textAlign: "center",
  },
  sub: { color: colors.textDim, fontSize: type.body },
});
