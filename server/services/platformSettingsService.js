const mongoose = require("mongoose");
const PlatformSetting = require("../models/PlatformSetting");
const { demoPlatformSettings } = require("../data/demoRuntime");

const SETTING_KEYS = [
  "hostManagementMonthlyFee",
  "loyaltyReferralPoints",
  "loyaltyClaimThreshold",
  "loyaltyDiscountMin",
  "loyaltyDiscountMax",
  "alertDisplayHours",
  "studentMonthlyPlatformFeePkr"
];

const normalizePlatformSettings = (payload = {}) => {
  const next = { ...demoPlatformSettings };
  SETTING_KEYS.forEach((key) => {
    if (payload[key] !== undefined && payload[key] !== "") next[key] = Math.max(0, Number(payload[key]));
  });
  if (next.loyaltyDiscountMin < 5) next.loyaltyDiscountMin = 5;
  if (next.loyaltyDiscountMax > 10) next.loyaltyDiscountMax = 10;
  if (next.loyaltyDiscountMax < next.loyaltyDiscountMin) next.loyaltyDiscountMax = next.loyaltyDiscountMin;
  if (next.hostManagementMonthlyFee < 0) next.hostManagementMonthlyFee = 0;
  if (next.alertDisplayHours < 1) next.alertDisplayHours = 48;
  if (!(next.studentMonthlyPlatformFeePkr > 0)) next.studentMonthlyPlatformFeePkr = 200;
  return next;
};

const getPlatformSettings = async () => {
  if (mongoose.connection.readyState !== 1) return { ...demoPlatformSettings };
  const record = await PlatformSetting.findOne({ key: "platformControls" });
  return normalizePlatformSettings(record?.value || demoPlatformSettings);
};

const savePlatformSettings = async (payload, user) => {
  const value = normalizePlatformSettings(payload);
  if (mongoose.connection.readyState !== 1) {
    Object.assign(demoPlatformSettings, value);
    return value;
  }
  await PlatformSetting.findOneAndUpdate(
    { key: "platformControls" },
    { value, updatedBy: user?._id || user?.id },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return value;
};

module.exports = { getPlatformSettings, savePlatformSettings, normalizePlatformSettings, SETTING_KEYS };
