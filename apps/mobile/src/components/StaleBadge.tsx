import { StyleSheet, Text, View } from "react-native";
import { space, type } from "../theme.ts";

/** Bayat / eski veri uyarısı — verinin ne zaman alındığını gösterir. */
export function StaleBadge({ fetchedAt }: { fetchedAt?: string }) {
  const t = fetchedAt
    ? new Date(fetchedAt).toLocaleString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>
        ⚠ ESKİ VERİ — internet yok{t ? `, en son ${t}` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#7A5C00",
    borderRadius: 8,
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    marginBottom: space.sm,
  },
  text: { color: "#FFFFFF", fontWeight: "700", fontSize: type.small },
});
