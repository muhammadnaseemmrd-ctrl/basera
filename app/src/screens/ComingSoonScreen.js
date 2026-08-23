import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";
import { Button } from "../components/Button";

// Single reusable placeholder screen for future-roadmap features. Navigate to it with
// navigation.navigate("ComingSoon", { title, icon, description }). Used today for Rider
// Booking, Food Ordering, and Job Seeker -- none of these have real functionality yet.
export function ComingSoonScreen({ route, navigation }) {
  const { title = "Coming Soon", icon = "\u{1F6A7}", description = "This feature is on our roadmap." } =
    route?.params || {};

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.badge}>{"\u{1F6A7} Coming Soon"}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <Button title="Back" variant="outline" onPress={() => navigation.goBack()} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
    padding: 32
  },
  icon: {
    fontSize: 56,
    marginBottom: 12
  },
  badge: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary[600],
    backgroundColor: colors.primary[50],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 16,
    overflow: "hidden"
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.ink,
    textAlign: "center",
    marginBottom: 10
  },
  description: {
    fontSize: 14,
    color: colors.neutral[500],
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24
  },
  button: {
    minWidth: 140
  }
});

export default ComingSoonScreen;
