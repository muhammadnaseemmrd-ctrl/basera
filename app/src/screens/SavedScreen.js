import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { api, safeRequest } from "../api/client";
import { ListingCard } from "../components/ListingCard";

// Saved/shortlisted rooms tab. The backend exposes shortlists under GET /shortlists
// (see README.md "V6 student decision APIs"); this screen reads that list via
// safeRequest so an unreachable API just shows the empty state instead of erroring.
export function SavedScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const data = await safeRequest(() => api.get("/shortlists"), { results: [] });
      if (!ignore) {
        setItems(data.results || data.shortlists || []);
        setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const openListing = (item) => navigation.navigate("ListingDetail", { id: item.id || item._id || item.roomId, item });

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <Text style={styles.title}>Saved</Text>
      <FlatList
        data={items}
        keyExtractor={(item, index) => String(item.id || item._id || index)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>You haven't saved any listings yet.</Text>
              <Text style={styles.emptyHint}>Tap the heart on a room or hostel to save it here.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => <ListingCard item={item} onPress={() => openListing(item)} style={styles.card} />}
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
    width: "100%"
  },
  empty: {
    marginTop: 48,
    alignItems: "center",
    paddingHorizontal: 24
  },
  emptyText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center"
  },
  emptyHint: {
    color: colors.neutral[500],
    fontSize: 13,
    textAlign: "center",
    marginTop: 6
  }
});

export default SavedScreen;
