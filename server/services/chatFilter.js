const { maskContact, scanText } = require("./contactGatingService");

const filterChatMessage = (message = "") => {
  const scan = scanText(message);
  if (!scan.flagged) {
    return {
      message: String(message || ""),
      originalMessage: String(message || ""),
      isFlagged: false,
      flagReason: ""
    };
  }
  return {
    message: maskContact(message),
    originalMessage: String(message || ""),
    isFlagged: true,
    flagReason: scan.reasons.join(",")
  };
};

module.exports = { filterChatMessage };
