const crypto = require("crypto");
const Stripe = require("stripe");

const generateHash = (params, integritySalt = "demo-salt") => {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => params[key])
    .join("&");

  return crypto.createHmac("sha256", integritySalt).update(sorted).digest("hex").toUpperCase();
};

const transactionRef = (prefix = "HH") => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const initiateJazzCash = async ({ amount, mobileNo, bookingId }) => {
  const payload = {
    pp_Version: "1.1",
    pp_TxnType: "MWALLET",
    pp_Language: "EN",
    pp_MerchantID: process.env.JAZZCASH_MERCHANT_ID || "DEMO_MERCHANT",
    pp_Password: process.env.JAZZCASH_PASSWORD || "DEMO_PASSWORD",
    pp_TxnRefNo: transactionRef("JC"),
    pp_Amount: Math.round(amount * 100).toString(),
    pp_TxnCurrency: "PKR",
    pp_TxnDateTime: new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14),
    pp_BillReference: bookingId || "Basera",
    pp_Description: "Basera booking payment",
    pp_MobileNumber: mobileNo || "03000000000"
  };

  payload.pp_SecureHash = generateHash(payload, process.env.JAZZCASH_INTEGRITY_SALT);

  return {
    provider: "jazzcash",
    mode: process.env.JAZZCASH_MERCHANT_ID ? "live-ready" : "demo",
    redirectUrl: "https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform",
    payload
  };
};

const initiateEasypaisa = async ({ amount, mobileNo, bookingId }) => ({
  provider: "easypaisa",
  mode: process.env.EASYPAISA_STORE_ID ? "live-ready" : "demo",
  transactionRef: transactionRef("EP"),
  amount,
  mobileNo,
  bookingId,
  signature: generateHash({ amount, mobileNo, bookingId }, process.env.EASYPAISA_HASH_KEY)
});

const createStripeIntent = async ({ amount, bookingId }) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      provider: "stripe",
      mode: "demo",
      clientSecret: `demo_secret_${transactionRef("ST")}`,
      amount,
      bookingId
    };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const intent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: "pkr",
    metadata: { bookingId }
  });

  return {
    provider: "stripe",
    mode: "live-ready",
    clientSecret: intent.client_secret,
    amount,
    bookingId
  };
};

module.exports = {
  generateHash,
  initiateJazzCash,
  initiateEasypaisa,
  createStripeIntent
};
