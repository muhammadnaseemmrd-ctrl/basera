// OCR provider integration for ID/document verification, following the same
// env-key-gated, fail-soft pattern established in server/services/aiService.js
// for the Claude integration: when OCR_API_KEY is not set, extractDocumentText
// always resolves to null immediately with zero network calls, so every
// existing caller keeps behaving exactly as it does today (metadata-only
// document checks).
//
// When OCR_API_KEY *is* set (together with OCR_PROVIDER=google-vision, the
// default assumed provider -- see server/.env.example), this calls Google
// Cloud Vision's REST API directly with `fetch`. No SDK dependency, matching
// the rest of this codebase's "plain fetch + API key" integration style.
//
// Vision's REST API requires base64-encoded image bytes, not a bare URL, so
// when given a URL (e.g. a Cloudinary-hosted verification document) we first
// fetch the bytes ourselves with Node's built-in `fetch` and base64-encode
// them before calling Vision.

const VISION_API_URL = "https://vision.googleapis.com/v1/images:annotate";
const REQUEST_TIMEOUT_MS = 10000;
const IMAGE_FETCH_TIMEOUT_MS = 8000;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // stay well under Vision's ~20MB request cap

// Pakistani CNIC numbers are 13 digits, conventionally formatted
// 00000-0000000-0. This is only a sanity check that OCR text looks like it
// came from an ID document -- it is NOT identity verification.
const CNIC_PATTERN = /\b\d{5}-?\d{7}-?\d{1}\b/;

const isProviderConfigured = () =>
  Boolean(process.env.OCR_API_KEY) && (process.env.OCR_PROVIDER || "google-vision") === "google-vision";

const fetchImageAsBase64 = async (imageUrl) => {
  if (!imageUrl || typeof imageUrl !== "string") return null;
  if (imageUrl.startsWith("demo-upload://") || imageUrl.startsWith("demo-document://")) return null;
  try {
    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS) });
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES || arrayBuffer.byteLength === 0) return null;
    return Buffer.from(arrayBuffer).toString("base64");
  } catch (error) {
    return null;
  }
};

/**
 * Calls Google Cloud Vision's TEXT_DETECTION for the image at `imageUrl` and
 * returns the extracted text, or null on any failure (no key configured,
 * unfetchable image, network error, non-200, timeout, or no text found) so
 * callers can fall back to their existing metadata-only behaviour unchanged.
 */
const extractDocumentText = async (imageUrl) => {
  if (!isProviderConfigured()) return null;

  const base64Content = await fetchImageAsBase64(imageUrl);
  if (!base64Content) return null;

  try {
    const response = await fetch(`${VISION_API_URL}?key=${process.env.OCR_API_KEY}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Content },
            features: [{ type: "TEXT_DETECTION", maxResults: 1 }]
          }
        ]
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });

    if (!response.ok) return null;

    const data = await response.json();
    const visionResponse = data?.responses?.[0];
    if (visionResponse?.error) return null;
    const text = visionResponse?.fullTextAnnotation?.text || visionResponse?.textAnnotations?.[0]?.description;
    return text ? text.trim() : null;
  } catch (error) {
    return null;
  }
};

/**
 * Sanity-checks that OCR-extracted text looks like it came from a Pakistani
 * ID document (contains a 13-digit CNIC-shaped number). This is a shallow
 * "does this look like an ID" check only -- it does NOT verify identity.
 */
const containsCnicPattern = (text) => Boolean(text && CNIC_PATTERN.test(text));

module.exports = { extractDocumentText, containsCnicPattern, isProviderConfigured };
