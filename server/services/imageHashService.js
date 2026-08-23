// Perceptual image hashing for duplicate/stolen listing-photo detection.
//
// Preferred path: uses `sharp` (if installed) to decode + resize any common
// image format (JPEG/PNG/WebP/etc.) to a small grayscale grid and computes a
// difference hash (dHash). A dHash is robust to re-compression, minor
// cropping, and resizing -- exactly what a host copying a photo from another
// listing would produce.
//
// Fallback path (sharp is NOT currently listed in server/package.json's
// dependencies): Node has no built-in JPEG/PNG pixel decoder, so without
// `sharp` we cannot build a true perceptual hash. Instead we fall back to a
// coarse byte-sampling hash of the raw (still-compressed) file bytes. This
// only catches EXACT or near-byte-identical re-uploads (e.g. the same file
// downloaded and re-uploaded unmodified) -- it will NOT detect resized,
// re-compressed, or cropped copies the way a real perceptual hash would.
//
// To get full perceptual robustness: run `npm install sharp` in server/.
// No other code changes are required -- this module auto-detects `sharp` at
// require time and switches hashing strategy accordingly.

let sharp = null;
try {
  // eslint-disable-next-line global-require, import/no-unresolved
  sharp = require("sharp");
} catch (error) {
  sharp = null;
  // eslint-disable-next-line no-console
  console.warn(
    "[imageHashService] `sharp` is not installed - falling back to a coarse byte-sampling hash for duplicate photo detection. " +
    "Run `npm install sharp` in server/ for real perceptual (resize/recompress-resistant) hashing."
  );
}

const HASH_GRID_WIDTH = 9; // 9 columns -> 8 horizontal diffs per row (classic dHash)
const HASH_GRID_HEIGHT = 8;
const FETCH_TIMEOUT_MS = 8000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const DUPLICATE_HAMMING_THRESHOLD = 5;

const fetchImageBuffer = async (imageUrl) => {
  if (!imageUrl || typeof imageUrl !== "string") return null;
  if (imageUrl.startsWith("demo-upload://") || imageUrl.startsWith("demo-document://")) return null;
  try {
    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES || arrayBuffer.byteLength === 0) return null;
    return Buffer.from(arrayBuffer);
  } catch (error) {
    return null;
  }
};

const bitsToHex = (bits) => {
  let hex = "";
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4).padEnd(4, "0"), 2).toString(16);
  }
  return hex;
};

const hexToBits = (hex) => {
  let bits = "";
  for (const char of hex) {
    bits += parseInt(char, 16).toString(2).padStart(4, "0");
  }
  return bits;
};

// Difference hash (dHash) via sharp: for each of 8 rows, compare each of 9
// grayscale pixels against the next pixel in the row -> 8x8 = 64 bits, packed
// into a 16-character hex string.
const hashWithSharp = async (buffer) => {
  const { data } = await sharp(buffer)
    .resize(HASH_GRID_WIDTH, HASH_GRID_HEIGHT, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let bits = "";
  for (let row = 0; row < HASH_GRID_HEIGHT; row += 1) {
    for (let col = 0; col < HASH_GRID_WIDTH - 1; col += 1) {
      const left = data[row * HASH_GRID_WIDTH + col];
      const right = data[row * HASH_GRID_WIDTH + col + 1];
      bits += left > right ? "1" : "0";
    }
  }
  return bitsToHex(bits);
};

// Coarse fallback when `sharp` isn't available -- see module header comment.
// Samples 64 evenly-spaced bytes from the raw file and compares each against
// the running average of all samples, producing a 64-bit (16 hex char) hash
// with the same shape as the sharp-based hash so comparison code doesn't need
// to special-case which strategy produced a given hash.
const hashFallback = (buffer) => {
  if (!buffer || buffer.length < 64) return null;
  const sampleCount = 64;
  const step = Math.floor(buffer.length / sampleCount);
  const samples = [];
  for (let i = 0; i < sampleCount; i += 1) {
    samples.push(buffer[i * step] || 0);
  }
  const avg = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const bits = samples.map((value) => (value > avg ? "1" : "0")).join("");
  return bitsToHex(bits);
};

/**
 * Computes a perceptual (or fallback) hash string for an image at a URL.
 * Returns null if the image can't be fetched or decoded -- callers should
 * treat that as "hashing unavailable for this image", not a hard error.
 */
const computeImageHash = async (imageUrl) => {
  const buffer = await fetchImageBuffer(imageUrl);
  if (!buffer) return null;

  if (sharp) {
    try {
      return await hashWithSharp(buffer);
    } catch (error) {
      // Corrupt/unsupported file for sharp -- fall through to the coarse fallback.
    }
  }
  return hashFallback(buffer);
};

/**
 * Hamming distance between two equal-length hex hash strings. Returns
 * Infinity if either hash is missing or lengths don't match, so mismatched
 * comparisons never accidentally register as "close".
 */
const hammingDistance = (hashA, hashB) => {
  if (!hashA || !hashB || hashA.length !== hashB.length) return Infinity;
  const bitsA = hexToBits(hashA);
  const bitsB = hexToBits(hashB);
  let distance = 0;
  for (let i = 0; i < bitsA.length; i += 1) {
    if (bitsA[i] !== bitsB[i]) distance += 1;
  }
  return distance;
};

const isLikelyDuplicate = (hashA, hashB, threshold = DUPLICATE_HAMMING_THRESHOLD) =>
  hammingDistance(hashA, hashB) <= threshold;

module.exports = {
  computeImageHash,
  hammingDistance,
  isLikelyDuplicate,
  DUPLICATE_HAMMING_THRESHOLD,
  isSharpAvailable: () => Boolean(sharp)
};
