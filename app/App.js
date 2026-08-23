import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { colors } from "./src/theme/colors";
import { useAuthStore } from "./src/store/useAuthStore";
import { RootNavigator } from "./src/navigation/RootNavigator";

export default function App() {
  const loadStoredAuth = useAuthStore((state) => state.loadStoredAuth);
  const hydrated = useAuthStore((state) => state.hydrated);

  useEffect(() => {
    loadStoredAuth();
  }, [loadStoredAuth]);

  if (!hydrated) {
    // Brief splash-like loading state while AsyncStorage is read, so RootNavigator
    // doesn't flash the Auth stack before a stored session is restored.
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvas
  }
});
