import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { api, safeRequest } from "../api/client";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";

// Room/hostel detail screen. Reads GET /rooms/:id (falling back to the item passed via
// navigation params if the network call fails), and offers a "Book Now" button that
// pushes the BookingScreen stub with the resolved room id.
export function ListingDetailScreen({ route, navigation }) {
  const { id, item: initialItem } = route.params || {};
  const [item, setItem] = useState(initialItem || null);
  const [loading, setLoading] = useState(!initialItem);

  useEffect(() => {
    if (!id) return;
    let ignore = false;
    (async () => {
      const data = await safeRequest(() => api.get(`/rooms/${id}`), { room: initialItem });
      if (!ignore && data.room) {
        setItem(data.room);
      }
      if (!ignore) setLoading(false);
    })();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!item && loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <Text style={styles.loadingText}>Loading listing...</Text>
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <Text style={styles.loadingText}>Listing not found.</Text>
      </SafeAreaView>
    );
  }

  const title = item.title || item.name || "Basera listing";
  const price = item.pricePerHead || item.price || item.pricePerRoom || item.minPrice;
  const amenities = item.amenities || item.facilities || [];
  const isVerified = item.verified ?? item.isVerified;
  const genderPolicy = item.genderPolicy || item.gender;
  const description = item.description || "No description provided for this listing yet.";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.photoPlaceholder}>
          <Text style={styles.photoPlaceholderText}>Photos coming soon</Text>
        </View>

        <View style={styles.badgeRow}>
          {isVerified ? <Badge label="Verified" tone="success" /> : <Badge label="Unverified" tone="warning" />}
          {!!genderPolicy && <Badge label={String(genderPolicy)} tone="neutral" />}
        </View>

        <Text style={styles.title}>{title}</Text>
        {price ? <Text style={styles.price}>PKR {Number(price).toLocaleString("en-PK")}/mo</Text> : null}

        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.description}>{description}</Text>

        {amenities.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Amenities</Text>
            <View style={styles.amenityWrap}>
              {amenities.map((amenity, index) => (
                <Badge key={`${amenity}-${index}`} label={String(amenity)} tone="primary" />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Book Now"
          onPress={() => navigation.navigate("Booking", { roomId: item.id || item._id || id, item })}
        />
      </View>
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
    paddingBottom: 100
  },
  loadingText: {
    padding: 20,
    color: colors.neutral[500],
    fontSize: 14
  },
  photoPlaceholder: {
    height: 180,
    borderRadius: 16,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16
  },
  photoPlaceholderText: {
    color: colors.primary[500],
    fontWeight: "700"
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: 4
  },
  price: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary[600],
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
    marginTop: 12,
    marginBottom: 8
  },
  description: {
    fontSize: 14,
    color: colors.neutral[600],
    lineHeight: 20
  },
  amenityWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    backgroundColor: colors.canvas,
    borderTopWidth: 1,
    borderTopColor: colors.line
  }
});

export default ListingDetailScreen;
