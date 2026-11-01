const HostelPolicy = require("../models/HostelPolicy");
const { resolvePolicy } = require("./policyRules");

/** Effective policy for a hostel/block (DB wrapper around the pure resolver). */
async function effectivePolicy(hostelId, blockId = null) {
  const policy = await HostelPolicy.findOne({ hostel: hostelId }).lean();
  return resolvePolicy(policy, blockId);
}

module.exports = { effectivePolicy };
