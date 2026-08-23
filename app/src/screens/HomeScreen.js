import { useEffect, useState } from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { api, safeRequest } from "../api/client";
import { ListingCard } from "../components/ListingCard";
import { useAuthStore } from "../store/useAuthStore";

// Mirrors client/src/pages/HomePage.jsx: fetch featured rooms and hostels through
// safeRequest so the screen still renders (with empty sections) if the API is
// unreachable, instead of crashing.
export function HomeScreen({ navigation }) {
  const user = useAuthStore((state) => state.user);
  const [rooms, setRooms] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadListings = async () => {
    const [roomData, hostelData] = await Promise.all([
      safeRequest(() => api.get("/rooms"), { results: [] }),
      safeRequest(() => api.get("/hostels", { params: { sort: "rating", limit: 12 } }), { results: [] })
    ]);
    setRooms((roomData.results || []).slice(0, 8));
    setHostels((hostelData.results || []).slice(0, 8));
  };

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      await loadListings();
      if (!ignore) setLoading(false);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadListings();
    setRefreshing(false);
  };

  const openListing = (item) => navigation.navigate("ListingDetail", { id: item.id || item._id, item });

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
      >
        <View style={styles.hero}>
          <Text style={styles.brand}>Basera</Text>
          <Text style={styles.heroTitle}>Find your Basera.</Text>
          <Text style={styles.heroSubtitle}>
            {user ? `Welcome back, ${user.name?.split(" ")[0] || "there"}.` : "Verified hostels, PGs, and rooms near your campus."}
          </Text>
        </View>

        <Section
          title="Featured rooms"
          empty={!loading && rooms.length === 0}
          emptyText="No rooms available right now. Pull to refresh."
        >
          <FlatList
            data={rooms}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, index) => String(item.id || item._id || index)}
            contentContainerStyle={styles.row}
            renderItem={({ item }) => <ListingCard item={item} onPress={() => openListing(item)} />}
          />
        </Section>

        <Section
          title="Top verified hostels"
          empty={!loading && hostels.length === 0}
          emptyText="No hostels available right now. Pull to refresh."
        >
          <FlatList
            data={hostels}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, index) => String(item.id || item._id || index)}
            contentContainerStyle={styles.row}
            renderItem={({ item }) => <ListingCard item={item} onPress={() => openListing(item)} />}
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, empty, emptyText, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {empty ? <Text style={styles.emptyText}>{emptyText}</Text> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas
  },
  container: {
    paddingBottom: 32
  },
  hero: {
    backgroundColor: colors.secondary[700],
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 32,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24
  },
  brand: {
    color: colors.primary[300],
    fontWeight: "800",
    fontSize: 16,
    marginBottom: 8
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 8
  },
  heroSubtitle: {
    color: colors.secondary[100],
    fontSize: 14
  },
  section: {
    marginTop: 24,
    paddingLeft: 20
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 12
  },
  row: {
    gap: 12,
    paddingRight: 20
  },
  emptyText: {
    color: colors.neutral[500],
    fontSize: 13,
    paddingRight: 20
  }
});

export default HomeScreen;
