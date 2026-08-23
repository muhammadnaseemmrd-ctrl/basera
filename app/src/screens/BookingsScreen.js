import { useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { api, safeRequest } from "../api/client";
import { Badge } from "../components/Badge";

const STATUS_TONE = {
  confirmed: "success",
  pending: "warning",
  cancelled: "danger",
  completed: "primary"
};

// The logged-in student's bookings via GET /bookings/my, mirroring
// client/src/pages/student/StudentPayments.jsx's use of the same endpoint.
export function BookingsScreen() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const data = await safeRequest(() => api.get("/bookings/my"), { results: [] });
    setBookings(data.results || data.bookings || []);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <Text style={styles.title}>My Bookings</Text>
      <FlatList
        data={bookings}
        keyExtractor={(item, index) => String(item.id || item._id || index)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
        ListEmptyComponent={
          !loading ? <Text style={styles.emptyText}>You don&apos;t have any bookings yet.</Text> : null
        }
        renderItem={({ item }) => {
          const status = String(item.status || "pending").toLowerCase();
          const title = item.room?.title || item.hostel?.name || item.title || "Booking";
          const amount = item.totalAmount || item.rent || item.price;
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {title}
                </Text>
                <Badge label={status} tone={STATUS_TONE[status] || "neutral"} />
              </View>
              {item.checkIn ? <Text style={styles.cardMeta}>Move-in: {item.checkIn}</Text> : null}
              {amount ? <Text style={styles.cardAmount}>PKR {Number(amount).toLocaleString("en-PK")}</Text> : null}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.ink,
    paddingHorizontal: 20,
    paddingTop: 16,
    marginBottom: 8
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    gap: 8
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
    flexShrink: 1
  },
  cardMeta: {
    fontSize: 12,
    color: colors.neutral[500],
    marginBottom: 4
  },
  cardAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary[600]
  },
  emptyText: {
    color: colors.neutral[500],
    fontSize: 13,
    textAlign: "center",
    marginTop: 32
  }
});

export default BookingsScreen;
