const { scanText } = require("./contactGatingService");

const scanUploadMetadata = (file = {}) => {
  const joined = [file.originalname, file.filename, file.mimetype].filter(Boolean).join(" ");
  const scan = scanText(joined);
  return {
    status: scan.flagged ? "flagged" : "clean",
    reasons: scan.reasons,
    provider: process.env.OCR_PROVIDER || "metadata-only",
    note: process.env.OCR_PROVIDER
      ? "OCR provider configured; scanned metadata now and provider hook can process file bytes asynchronously."
      : "Metadata scan complete. Configure OCR_PROVIDER to scan text embedded in uploaded images."
  };
};

module.exports = { scanUploadMetadata };
