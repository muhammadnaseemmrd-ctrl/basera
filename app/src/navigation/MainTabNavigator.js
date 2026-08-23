import { Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { colors } from "../theme/colors";
import { HomeScreen } from "../screens/HomeScreen";
import { SearchScreen } from "../screens/SearchScreen";
import { SavedScreen } from "../screens/SavedScreen";
import { BookingsScreen } from "../screens/BookingsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";

const Tab = createBottomTabNavigator();

// Plain-text emoji tab icons keep the install surface small (no vector-icon dependency).
const TAB_ICONS = {
  Home: "\u{1F3E0}",
  Search: "\u{1F50D}",
  Saved: "\u{2764}\u{FE0F}",
  Bookings: "\u{1F4C5}",
  Profile: "\u{1F464}"
};

function TabIcon({ route, color, size }) {
  return <Text style={{ fontSize: size, color }}>{TAB_ICONS[route.name] || "•"}</Text>;
}

// Bottom tabs: Home, Search, Saved, Bookings, Profile. Profile hosts the "More" section
// with the Rider Booking / Food Ordering / Job Seeker Coming Soon entries.
export function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary[600],
        tabBarInactiveTintColor: colors.neutral[400],
        tabBarStyle: {
          borderTopColor: colors.line,
          backgroundColor: colors.surface
        },
        tabBarIcon: ({ color, size }) => <TabIcon route={route} color={color} size={size} />
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Saved" component={SavedScreen} />
      <Tab.Screen name="Bookings" component={BookingsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default MainTabNavigator;
