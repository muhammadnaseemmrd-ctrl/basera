import { useEffect } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { Button } from "../components/Button";
import { useAuthStore } from "../store/useAuthStore";

const COMING_SOON_ITEMS = [
  {
    key: "rider-booking",
    icon: "\u{1F6FA}",
    title: "Rider Booking",
    description: "Book a rickshaw or bike ride to campus — coming soon."
  },
  {
    key: "food-ordering",
    icon: "\u{1F37D}️",
    title: "Food Ordering",
    description: "Order food from hostel mess partners and nearby restaurants — coming soon."
  },
  {
    key: "job-seeker",
    icon: "\u{1F4BC}",
    title: "Job Seeker",
    description: "Find part-time jobs and internships near your hostel — coming soon."
  }
];

// Logged-in user info, logout, and the "More" section listing future-roadmap features
// (Rider Booking, Food Ordering, Job Seeker) that navigate to the shared ComingSoonScreen.
export function ProfileScreen({ navigation }) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const refreshMe = useAuthStore((state) => state.refreshMe);

  useEffect(() => {
    refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openComingSoon = (entry) =>
    navigation.navigate("ComingSoon", { title: entry.title, icon: entry.icon, description: entry.description });

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.name || "?").charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{user?.name || "Guest"}</Text>
        <Text style={styles.email}>{user?.email || ""}</Text>
        {!!user?.university && <Text style={styles.meta}>{user.university} - {user.city}</Text>}

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>More from Basera</Text>
        {COMING_SOON_ITEMS.map((entry) => (
          <TouchableOpacity key={entry.key} style={styles.row} onPress={() => openComingSoon(entry)}>
            <Text style={styles.rowIcon}>{entry.icon}</Text>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{entry.title}</Text>
              <Text style={styles.rowSubtitle} numberOfLines={1}>
                {entry.description}
              </Text>
            </View>
            <Text style={styles.chevron}>{"›"}</Text>
          </TouchableOpacity>
        ))}

        <View style={styles.divider} />

        <Button title="Log out" variant="outline" onPress={logout} style={styles.logoutButton} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas
  },
  container: {
    padding: 20,
    paddingBottom: 48,
    alignItems: "center"
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.primary[600]
  },
  name: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.ink
  },
  email: {
    fontSize: 13,
    color: colors.neutral[500],
    marginTop: 2
  },
  meta: {
    fontSize: 12,
    color: colors.neutral[400],
    marginTop: 4
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
    width: "100%",
    marginVertical: 20
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.neutral[600],
    alignSelf: "flex-start",
    marginBottom: 10
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 10
  },
  rowIcon: {
    fontSize: 22,
    marginRight: 12
  },
  rowBody: {
    flex: 1
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink
  },
  rowSubtitle: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 2
  },
  chevron: {
    fontSize: 20,
    color: colors.neutral[400]
  },
  logoutButton: {
    width: "100%"
  }
});

export default ProfileScreen;
