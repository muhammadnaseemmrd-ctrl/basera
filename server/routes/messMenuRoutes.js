const express = require("express");
const mongoose = require("mongoose");
const { protect } = require("../middleware/auth");
const MessMenu = require("../models/MessMenu");

const router = express.Router();

router.post("/meals/:mealId/rate", protect, async (req, res, next) => {
  try {
    const rating = Math.max(1, Math.min(5, Number(req.body.rating || 5)));
    if (mongoose.connection.readyState !== 1) {
      return res.status(201).json({
        meal: {
          mealId: req.params.mealId,
          rating,
          ratingCount: 24,
          averageRating: 4.6
        },
        demo: true
      });
    }

    const menu = await MessMenu.findOne({ "meals.mealId": req.params.mealId });
    if (!menu) return res.status(404).json({ message: "Meal not found." });
    const meal = menu.meals.find((item) => item.mealId === req.params.mealId);
    const nextCount = Number(meal.ratingCount || 0) + 1;
    meal.rating = Number((((Number(meal.rating || 0) * Number(meal.ratingCount || 0)) + rating) / nextCount).toFixed(2));
    meal.ratingCount = nextCount;
    menu.messScore = Number((menu.meals.reduce((sum, item) => sum + Number(item.rating || 0), 0) / Math.max(menu.meals.length, 1)).toFixed(2));
    await menu.save();
    return res.status(201).json({ meal });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
