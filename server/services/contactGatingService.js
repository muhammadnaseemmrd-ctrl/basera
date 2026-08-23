const phonePattern = /(?:\+92|0092|92|0)?3\d{2}[-.\s]?\d{7}\b/g;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const urlPattern = /\b(?:https?:\/\/|www\.)\S+/gi;
const externalPaymentPattern = /\b(?:bank\s*transfer|easypaisa\s*direct|jazzcash\s*direct|whatsapp|wa\.me|cash\s*only)\b/gi;

const hasContactLeak = (value = "") => {
  const text = String(value || "");
  return phonePattern.test(text) || emailPattern.test(text) || urlPattern.test(text) || externalPaymentPattern.test(text);
};

const resettableTest = (pattern, value) => {
  pattern.lastIndex = 0;
  return pattern.test(value);
};

const scanText = (value = "") => {
  const text = String(value || "");
  const reasons = [];
  if (resettableTest(phonePattern, text)) reasons.push("phone_number");
  if (resettableTest(emailPattern, text)) reasons.push("email");
  if (resettableTest(urlPattern, text)) reasons.push("external_link");
  if (resettableTest(externalPaymentPattern, text)) reasons.push("external_payment");
  return { flagged: reasons.length > 0, reasons };
};

const maskContact = (value = "") =>
  String(value || "")
    .replace(phonePattern, "[contact hidden until booking]")
    .replace(emailPattern, "[email hidden]")
    .replace(urlPattern, "[link hidden]")
    .replace(externalPaymentPattern, "[off-platform payment blocked]");

const maskPhone = (phone = "") => {
  const raw = String(phone || "");
  if (raw.length <= 4) return "Hidden until paid booking";
  return `${raw.slice(0, 4)}****${raw.slice(-2)}`;
};

const firstNameOnly = (name = "") => {
  const [first] = String(name || "Host").trim().split(/\s+/);
  return `${first || "Host"} H.`;
};

const publicHostProfile = (user, { reveal = false } = {}) => {
  if (!user) return null;
  const source = user.toObject ? user.toObject() : user;
  if (reveal) {
    return {
      id: source._id || source.id,
      name: source.name,
      phone: source.phone,
      email: source.email,
      role: "host",
      avatar: source.avatar,
      verificationTier: source.hostProfile?.verificationTier || source.landlordProfile?.verificationTier || "property_verified"
    };
  }
  return {
    id: source._id || source.id,
    name: firstNameOnly(source.name),
    role: "host",
    avatar: source.avatar,
    verificationTier: source.hostProfile?.verificationTier || source.landlordProfile?.verificationTier || "property_verified",
    contactGate: "Contact visible after paid confirmed booking."
  };
};

const assertNoContactLeak = (fields = {}) => {
  const flaggedFields = Object.entries(fields)
    .map(([field, value]) => ({ field, ...scanText(value) }))
    .filter((item) => item.flagged);
  if (flaggedFields.length) {
    const error = new Error("Phone numbers, emails, external links, and off-platform payment instructions are not allowed in listing text.");
    error.statusCode = 422;
    error.flaggedFields = flaggedFields;
    throw error;
  }
};

module.exports = {
  phonePattern,
  emailPattern,
  urlPattern,
  scanText,
  hasContactLeak,
  maskContact,
  maskPhone,
  firstNameOnly,
  publicHostProfile,
  assertNoContactLeak
};
