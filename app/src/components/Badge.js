import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

// tone: "primary" | "success" | "warning" | "danger" | "neutral"
export function Badge({ label, tone = "neutral" }) {
  const palette = tonePalette[tone] || tonePalette.neutral;

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.text, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

const tonePalette = {
  primary: { bg: colors.primary[50], text: colors.primary[700] },
  success: { bg: colors.success[50], text: colors.success[700] },
  warning: { bg: colors.warning[50], text: colors.warning[700] },
  danger: { bg: colors.danger[50], text: colors.danger[700] },
  neutral: { bg: colors.neutral[100], text: colors.neutral[700] }
};

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignSelf: "flex-start"
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2
  }
});

export default Badge;
