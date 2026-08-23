import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../theme/colors";
import { Badge } from "./Badge";

// Renders either a room or a hostel result. The web app's normalizeRoom/normalizeHostel
// helpers (client/src/utils/normalize.js) settle on fields like title/image/pricePerHead/
// price/verified/genderPolicy -- this card reads those same field names so both API
// shapes (raw or normalized) render sensibly without extra mapping per screen.
export function ListingCard({ item, onPress, style }) {
  const title = item.title || item.name || "Basera listing";
  const image = item.image || item.photos?.[0] || item.images?.[0];
  const price = item.pricePerHead || item.price || item.pricePerRoom || item.minPrice;
  const city = item.city || item.location?.city;
  const isVerified = item.verified ?? item.isVerified;

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.card, style]}>
      {image ? (
        <Image source={{ uri: image }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Text style={styles.imagePlaceholderText}>Basera</Text>
        </View>
      )}

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        {!!city && <Text style={styles.city}>{city}</Text>}

        <View style={styles.row}>
          {price ? <Text style={styles.price}>PKR {Number(price).toLocaleString("en-PK")}/mo</Text> : null}
          {isVerified ? <Badge label="Verified" tone="success" /> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 220,
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: "#020617",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },
  image: {
    width: "100%",
    height: 130,
    backgroundColor: colors.neutral[100]
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[50]
  },
  imagePlaceholderText: {
    color: colors.primary[500],
    fontWeight: "700",
    fontSize: 16
  },
  body: {
    padding: 12,
    gap: 6
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink
  },
  city: {
    fontSize: 12,
    color: colors.neutral[500]
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4
  },
  price: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary[600]
  }
});

export default ListingCard;
