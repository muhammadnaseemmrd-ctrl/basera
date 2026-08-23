import { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { api, safeRequest } from "../api/client";
import { ListingCard } from "../components/ListingCard";

const CITIES = ["Islamabad", "Lahore", "Karachi", "Peshawar"];
const GENDERS = [
  { label: "Any", value: "any" },
  { label: "Boys", value: "male" },
  { label: "Girls", value: "female" }
];
const BUDGETS = [
  { label: "Any budget", value: undefined },
  { label: "Under 15k", value: 15000 },
  { label: "Under 25k", value: 25000 },
  { label: "Under 40k", value: 40000 }
];

// Search input + filter chips calling GET /rooms with query params, mirroring the
// filters used on client/src/pages/RoomsMarketPage.jsx (city, gender, maxPrice).
export function SearchScreen({ navigation }) {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState(CITIES[0]);
  const [gender, setGender] = useState("any");
  const [maxPrice, setMaxPrice] = useState(undefined);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(async () => {
    setLoading(true);
    const data = await safeRequest(
      () =>
        api.get("/rooms", {
          params: {
            search: query.trim() || undefined,
            city,
            gender: gender === "any" ? undefined : gender,
            maxPrice
          }
        }),
      { results: [] }
    );
    setResults(data.results || []);
    setLoading(false);
  }, [query, city, gender, maxPrice]);

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  const openListing = (item) => navigation.navigate("ListingDetail", { id: item.id || item._id, item });

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by area, university, or hostel name"
          placeholderTextColor={colors.neutral[400]}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={runSearch}
          returnKeyType="search"
        />

        <ChipRow label="City">
          {CITIES.map((option) => (
            <Chip key={option} label={option} active={city === option} onPress={() => setCity(option)} />
          ))}
        </ChipRow>

        <ChipRow label="Gender">
          {GENDERS.map((option) => (
            <Chip key={option.value} label={option.label} active={gender === option.value} onPress={() => setGender(option.value)} />
          ))}
        </ChipRow>

        <ChipRow label="Budget">
          {BUDGETS.map((option) => (
            <Chip
              key={option.label}
              label={option.label}
              active={maxPrice === option.value}
              onPress={() => setMaxPrice(option.value)}
            />
          ))}
        </ChipRow>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item, index) => String(item.id || item._id || index)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>No results yet. Adjust your filters and try again.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <ListingCard item={item} onPress={() => openListing(item)} style={styles.card} />
        )}
      />
    </SafeAreaView>
  );
}

function ChipRow({ label, children }) {
  return (
    <View style={styles.chipRow}>
      <Text style={styles.chipLabel}>{label}</Text>
      <View style={styles.chipWrap}>{children}</View>
    </View>
  );
}

function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: 12
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.ink,
    marginBottom: 14
  },
  chipRow: {
    marginBottom: 10
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.neutral[500],
    marginBottom: 6
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line
  },
  chipActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500]
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral[600]
  },
  chipTextActive: {
    color: "#FFFFFF"
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12
  },
  card: {
    width: "100%"
  },
  emptyText: {
    color: colors.neutral[500],
    fontSize: 13,
    textAlign: "center",
    marginTop: 32
  }
});

export default SearchScreen;
