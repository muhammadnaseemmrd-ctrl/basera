import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../../theme/colors";
import { Button } from "../../components/Button";
import { useAuthStore } from "../../store/useAuthStore";

export function LoginScreen({ navigation }) {
  const login = useAuthStore((state) => state.login);
  const loading = useAuthStore((state) => state.loading);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async () => {
    setError("");
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    try {
      await login({ email: email.trim(), password });
      // RootNavigator swaps to the Main tab navigator automatically once the store
      // has a token -- no explicit navigation call needed here.
    } catch (err) {
      setError(err.message || "Login failed.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>Basera</Text>
        <Text style={styles.tagline}>Find your Basera.</Text>

        <Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.subheading}>Log in to manage your bookings and saved listings.</Text>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.neutral[400]}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="********"
            placeholderTextColor={colors.neutral[400]}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <Button title="Log in" onPress={onSubmit} loading={loading} style={styles.submit} />

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>New to Basera?</Text>
          <Text style={styles.footerLink} onPress={() => navigation.navigate("Register")}>
            {" "}Create an account
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.canvas },
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center"
  },
  brand: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.primary[600]
  },
  tagline: {
    fontSize: 14,
    color: colors.neutral[500],
    marginBottom: 28
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink
  },
  subheading: {
    fontSize: 14,
    color: colors.neutral[500],
    marginTop: 4,
    marginBottom: 24
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
  submit: {
    marginTop: 8
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24
  },
  footerText: {
    color: colors.neutral[500],
    fontSize: 13
  },
  footerLink: {
    color: colors.primary[600],
    fontSize: 13,
    fontWeight: "700"
  }
});

export default LoginScreen;
