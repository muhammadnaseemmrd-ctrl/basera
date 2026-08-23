import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { api } from "../api/client";
import { Button } from "../components/Button";

// Minimal booking stub reached from ListingDetailScreen's "Book Now" button. It collects
// the bare minimum (move-in date, duration) and posts to POST /bookings, mirroring the
// payload shape used by client/src/pages/BookingPage.jsx. This intentionally does not
// replicate the web app's full multi-step flow (payment method, instalments, discounts,
// deposit protection) -- that is future work for the mobile app.
export function BookingScreen({ route, navigation }) {
  const { roomId, item } = route.params || {};
  const [checkIn, setCheckIn] = useState("");
  const [duration, setDuration] = useState("6");
  const [specialRequests, setSpecialRequests] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const onSubmit = async () => {
    setError("");
    if (!checkIn.trim()) {
      setError("Enter a move-in date (YYYY-MM-DD).");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post("/bookings", {
        room: roomId,
        checkIn: checkIn.trim(),
        moveInDate: checkIn.trim(),
        duration: Number(duration) || 1,
        specialRequests: specialRequests.trim() || undefined
      });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || "Could not create booking. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.confirmContainer}>
          <Text style={styles.confirmTitle}>Booking request sent</Text>
          <Text style={styles.confirmText}>
            We&apos;ve sent your booking request for {item?.title || "this listing"}. You can track its status from
            the Bookings tab.
          </Text>
          <Button title="View my bookings" onPress={() => navigation.navigate("Main", { screen: "Bookings" })} style={styles.confirmButton} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Book {item?.title || "this listing"}</Text>
        <Text style={styles.subtitle}>Send a booking request. The host will confirm availability.</Text>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Move-in date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            placeholder="2026-09-01"
            placeholderTextColor={colors.neutral[400]}
            value={checkIn}
            onChangeText={setCheckIn}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Duration (months)</Text>
          <TextInput
            style={styles.input}
            placeholder="6"
            placeholderTextColor={colors.neutral[400]}
            keyboardType="number-pad"
            value={duration}
            onChangeText={setDuration}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Special requests (optional)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Anything the host should know?"
            placeholderTextColor={colors.neutral[400]}
            value={specialRequests}
            onChangeText={setSpecialRequests}
            multiline
            numberOfLines={3}
          />
        </View>

        <Button title="Confirm booking request" onPress={onSubmit} loading={submitting} />
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
    paddingBottom: 48
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: 4
  },
  subtitle: {
    fontSize: 13,
    color: colors.neutral[500],
    marginBottom: 20
  },
  errorBox: {
    backgroundColor: colors.danger[50],
    borderRadius: 10,
    padding: 12,
    marginBottom: 16
  },
  errorText: {
    color: colors.danger[700],
    fontSize: 13
  },
  field: {
    marginBottom: 16
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.neutral[600],
    marginBottom: 6
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink
  },
  multiline: {
    height: 90,
    textAlignVertical: "top"
  },
  confirmContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: 8,
    textAlign: "center"
  },
  confirmText: {
    fontSize: 14,
    color: colors.neutral[500],
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20
  },
  confirmButton: {
    minWidth: 200
  }
});

export default BookingScreen;
