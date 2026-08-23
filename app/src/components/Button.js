import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from "react-native";
import { colors } from "../theme/colors";

// Small branded button used across screens instead of pulling in a UI library.
// variant: "primary" | "secondary" | "outline"
export function Button({ title, onPress, variant = "primary", loading = false, disabled = false, style }) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.base, variantStyles[variant], isDisabled && styles.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "outline" ? colors.primary[600] : "#FFFFFF"} />
      ) : (
        <Text style={[styles.text, textVariantStyles[variant]]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row"
  },
  disabled: {
    opacity: 0.6
  },
  text: {
    fontSize: 15,
    fontWeight: "700"
  }
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.primary[500]
  },
  secondary: {
    backgroundColor: colors.secondary[600]
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.primary[500]
  }
});

const textVariantStyles = StyleSheet.create({
  primary: {
    color: "#FFFFFF"
  },
  secondary: {
    color: "#FFFFFF"
  },
  outline: {
    color: colors.primary[600]
  }
});

export default Button;
