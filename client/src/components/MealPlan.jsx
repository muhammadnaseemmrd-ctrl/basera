import { Utensils } from "lucide-react";

const labels = {
  NONE: "No meals",
  BREAKFAST: "Breakfast",
  TWO_MEALS: "2 meals",
  FULL_BOARD: "3 meals",
  KITCHEN_ACCESS: "Kitchen access"
};

export function MealPlan({ value = "NONE", cost = 0 }) {
  return (
    <span className="chip">
      <Utensils size={14} />
      {labels[value] || value}
      {cost ? ` + PKR ${Number(cost).toLocaleString("en-PK")}` : ""}
    </span>
  );
}
