// Thin wrapper around the Anthropic Messages API. Used by aiRoutes.js to upgrade the
// /student-concierge and /listing-description endpoints to real Claude responses when
// CLAUDE_API_KEY is configured, while leaving every other /ai/* endpoint's pure
// template-based logic untouched.
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-5";
const REQUEST_TIMEOUT_MS = 8000;

const STUDENT_CONCIERGE_SYSTEM_PROMPT = `You are Basera's AI assistant for Pakistani student housing. Basera is a marketplace for verified hostels, PG accommodation, private rooms, and shared rooms near universities across Pakistan (Islamabad, Lahore, Karachi, Rawalpindi, Peshawar).
Only answer questions about: finding housing, comparing rooms/hostels, booking, payments/instalments, verification, safety, meals, amenities, and how the Basera platform works.
Host and student contact details (phone, email, WhatsApp) are always hidden until a booking is paid and confirmed -- never suggest sharing or requesting off-platform contact details, and never invent phone numbers or addresses.
If asked something unrelated to student housing in Pakistan or the Basera platform, politely redirect the user back to housing-related help.
Keep answers concise (2-4 short sentences), practical, and friendly.`;

const LISTING_DESCRIPTION_SYSTEM_PROMPT = `You are Basera's AI assistant for Pakistani student housing, helping Hosts write clear, honest listing descriptions for rooms, PGs, and hostel beds.
Write factual, appealing copy based only on the details provided -- never invent amenities, prices, or contact details, and never include phone numbers, emails, or off-platform contact instructions.
Respond ONLY with strict JSON in the form {"english": "...", "urdu": "..."} and nothing else -- no markdown code fences, no extra commentary.`;

const FINANCE_ANOMALY_SYSTEM_PROMPT = `You are Basera's AI assistant for finance operations, scoping analysis strictly to the transaction/finance data provided.
Look for duplicate payments, unusual amounts relative to typical rent/deposit values, and suspicious timing patterns (e.g. rapid repeat charges, payouts right after a dispute).
Never invent transactions that are not present in the provided data, and never recommend releasing a payout without human review.
Respond ONLY with strict JSON in the form {"anomalies": [{"id": "...", "severity": "low"|"medium"|"high", "title": "...", "amount": <number>, "recommendation": "..."}]} and nothing else -- no markdown code fences, no extra commentary. If nothing looks anomalous, respond with {"anomalies": []}.`;

const DISPUTE_SUMMARY_SYSTEM_PROMPT = `You are Basera's AI assistant helping platform admins triage a booking dispute between a student and a Host.
Summarize only what is supported by the booking/dispute context provided -- never invent evidence, and always keep the final decision with a human admin.
Respond ONLY with strict JSON in the form {"brief": "...", "evidence": ["...", "..."], "recommendedDecision": "..."} and nothing else -- no markdown code fences, no extra commentary.`;

const REVIEW_CLASSIFY_SYSTEM_PROMPT = `You are Basera's AI assistant helping moderate a student hostel/room review for authenticity and policy compliance.
Classify the review text only using the text provided -- flag reviews that look fake, are too vague to verify, or contain contact/off-platform payment leakage or unverified abuse allegations.
Respond ONLY with strict JSON in the form {"classification": "likely_valid"|"needs_review", "reasons": ["...", "..."], "confidence": <number between 0 and 1>, "moderationAction": "approve"|"request_more_context"|"flag_for_admin"} and nothing else -- no markdown code fences, no extra commentary.`;

const stripCodeFence = (text = "") => text.replace(/^```(json)?/i, "").replace(/```$/i, "").trim();

/**
 * Calls the real Anthropic Messages API. Returns the raw text reply on success, or
 * null on any failure (missing key, network error, non-200, timeout) so callers can
 * fall back to their existing template logic unchanged.
 */
const callClaude = async ({ system, userContent, maxTokens = 500 }) => {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: userContent }]
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });

    if (!response.ok) return null;

    const data = await response.json();
    const text = data?.content?.find((block) => block.type === "text")?.text;
    return text ? text.trim() : null;
  } catch (error) {
    return null;
  }
};

const askStudentConcierge = (question) =>
  callClaude({ system: STUDENT_CONCIERGE_SYSTEM_PROMPT, userContent: question });

/**
 * Asks Claude for a listing description and parses the required {english, urdu} JSON
 * shape. Returns null (never throws) if Claude is unavailable or replies with
 * something that isn't valid JSON in the expected shape.
 */
const generateListingDescription = async (listingDetails) => {
  const reply = await callClaude({
    system: LISTING_DESCRIPTION_SYSTEM_PROMPT,
    userContent: `Write an English and Urdu listing description for this student room based only on the details below.\n\n${listingDetails}`
  });
  if (!reply) return null;

  try {
    const parsed = JSON.parse(stripCodeFence(reply));
    if (parsed?.english && parsed?.urdu) return { english: parsed.english, urdu: parsed.urdu };
    return null;
  } catch {
    return null;
  }
};

/**
 * Asks Claude to review finance/transaction data for anomalies and parses the required
 * {anomalies: [...]} shape. Returns null (never throws) if Claude is unavailable or
 * replies with something that isn't valid JSON in the expected shape.
 */
const detectFinanceAnomaly = async (financeContext) => {
  const reply = await callClaude({
    system: FINANCE_ANOMALY_SYSTEM_PROMPT,
    userContent: `Review this finance/transaction data for anomalies.\n\n${financeContext}`,
    maxTokens: 700
  });
  if (!reply) return null;

  try {
    const parsed = JSON.parse(stripCodeFence(reply));
    if (Array.isArray(parsed?.anomalies)) return { anomalies: parsed.anomalies };
    return null;
  } catch {
    return null;
  }
};

/**
 * Asks Claude to summarize a booking dispute and parses the required
 * {brief, evidence, recommendedDecision} shape. Returns null (never throws) if Claude
 * is unavailable or replies with something that isn't valid JSON in the expected shape.
 */
const summarizeDispute = async (disputeContext) => {
  const reply = await callClaude({
    system: DISPUTE_SUMMARY_SYSTEM_PROMPT,
    userContent: `Summarize this booking dispute for admin review.\n\n${disputeContext}`,
    maxTokens: 500
  });
  if (!reply) return null;

  try {
    const parsed = JSON.parse(stripCodeFence(reply));
    if (parsed?.brief && parsed?.recommendedDecision) {
      return { brief: parsed.brief, evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [], recommendedDecision: parsed.recommendedDecision };
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Asks Claude to classify a review's authenticity/policy compliance and parses the
 * required {classification, reasons, confidence, moderationAction} shape. Returns null
 * (never throws) if Claude is unavailable or replies with something that isn't valid
 * JSON in the expected shape.
 */
const classifyReview = async (reviewText) => {
  const reply = await callClaude({
    system: REVIEW_CLASSIFY_SYSTEM_PROMPT,
    userContent: `Classify this student hostel/room review:\n\n${reviewText}`,
    maxTokens: 400
  });
  if (!reply) return null;

  try {
    const parsed = JSON.parse(stripCodeFence(reply));
    if (parsed?.classification && parsed?.moderationAction) {
      return {
        classification: parsed.classification,
        reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.7,
        moderationAction: parsed.moderationAction
      };
    }
    return null;
  } catch {
    return null;
  }
};

module.exports = {
  callClaude,
  askStudentConcierge,
  generateListingDescription,
  detectFinanceAnomaly,
  summarizeDispute,
  classifyReview
};
