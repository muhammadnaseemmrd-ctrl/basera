import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { colors } from "../theme/colors";
import { useAuthStore } from "../store/useAuthStore";
import { AuthNavigator } from "./AuthNavigator";
import { MainTabNavigator } from "./MainTabNavigator";
import { ListingDetailScreen } from "../screens/ListingDetailScreen";
import { BookingScreen } from "../screens/BookingScreen";
import { ComingSoonScreen } from "../screens/ComingSoonScreen";

const Stack = createNativeStackNavigator();

// Switches between the Auth stack and the Main tab navigator based on auth state from
// useAuthStore. ListingDetail/Booking/ComingSoon are registered as siblings of "Main" so
// any tab screen can call navigation.navigate("ListingDetail", ...) etc. and have the
// call bubble up to this stack (standard React Navigation nested-navigator behavior).
export function RootNavigator() {
  const token = useAuthStore((state) => state.token);

  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.ink,
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false
      }}
    >
      {token ? (
        <>
          <Stack.Screen name="Main" component={MainTabNavigator} options={{ headerShown: false }} />
          <Stack.Screen name="ListingDetail" component={ListingDetailScreen} options={{ title: "Listing" }} />
          <Stack.Screen name="Booking" component={BookingScreen} options={{ title: "Book Now" }} />
          <Stack.Screen name="ComingSoon" component={ComingSoonScreen} options={{ title: "" }} />
        </>
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} options={{ headerShown: false }} />
      )}
    </Stack.Navigator>
  );
}

export default RootNavigator;
