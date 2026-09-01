import { StyleSheet, Text, View } from "react-native";
import { colors, type, sevColor, type Severity } from "../theme.ts";

interface Props {
  label: string;
  value: string;
  /** Alt satır — birim/ikincil bilgi. */
  sub?: string;
  /** Sol kenar şerit rengi (şiddet). */
  severity?: Severity;
}

export function StatTile({ label, value, sub, severity }: Props) {
  return (
    <View style={styles.tile}>
      {severity && (
        <View style={[styles.bar, { backgroundColor: sevColor[severity] }]} />
      )}
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 100,
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 10,
    overflow: "hidden",
  },
  bar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  label: { color: colors.textDim, fontSize: type.small, fontWeight: "600" },
  value: { color: colors.text, fontSize: 22, fontWeight: "800", marginTop: 2 },
  sub: { color: colors.textDim, fontSize: type.tiny, marginTop: 1 },
});
