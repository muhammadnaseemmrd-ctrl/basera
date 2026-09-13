const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    message: String,
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const verificationDocumentSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["cnic", "university_id", "cnic_front", "cnic_back", "property_proof", "utility_bill", "agreement"], required: true },
    url: { type: String, required: true },
    originalName: String,
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    uploadedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["student", "host", "owner", "landlord", "property_manager", "admin", "finance", "warden"], default: "student" },
    avatar: String,
    studentId: String,
    isVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    university: String,
    gender: { type: String, enum: ["male", "female", "other"] },
    city: String,
    emergencyContact: {
      name: String,
      relationship: String,
      phone: String,
      city: String
    },
    guardianConsent: {
      required: { type: Boolean, default: false },
      accepted: { type: Boolean, default: false },
      acceptedAt: Date
    },
    // Category-level "who will be my roommate" info a tenant can choose to share with
    // prospective roommates browsing a shared room before they book. Deliberately never
    // includes name/email/phone -- see contactGatingService.js for the same philosophy
    // applied to host contact info. `visibleToProspectiveRoommates` is the occupant's own
    // opt-out switch and defaults to on.
    occupantProfile: {
      occupantType: { type: String, enum: ["student", "teacher", "working_professional", "freelancer", "other"] },
      fieldOrSubject: { type: String, trim: true },
      studyLevel: { type: String, trim: true },
      bio: { type: String, trim: true, maxlength: 280 },
      visibleToProspectiveRoommates: { type: Boolean, default: true }
    },
    verificationDocuments: [verificationDocumentSchema],
    landlordProfile: {
      listerType: { type: String, enum: ["hostel_owner", "individual_landlord", "pg_operator"], default: "individual_landlord" },
      verificationTier: { type: String, enum: ["unverified", "identity_verified", "property_verified", "superhost"], default: "unverified" },
      agreementAccepted: { type: Boolean, default: false },
      agreementSignedBy: String,
      agreementSignedAt: Date,
      commissionAcknowledged: { type: Boolean, default: false },
      saasPlan: {
        tier: { type: String, enum: ["STARTER", "PRO", "PREMIUM"], default: "STARTER" },
        billingStatus: { type: String, enum: ["trial", "active", "past_due", "cancelled"], default: "trial" },
        startedAt: Date,
        nextInvoiceAt: Date
      },
      reviewStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" }
    },
    hostProfile: {
      type: { type: String, enum: ["hostel_host", "individual_host", "pg_host"], default: "individual_host" },
      verificationTier: { type: String, enum: ["unverified", "id_verified", "property_verified", "superhost"], default: "unverified" },
      payoutMethod: { type: String, enum: ["jazzcash", "easypaisa", "bank"], default: "jazzcash" },
      payoutAccountTitle: String,
      payoutAccountNumber: String,
      agreementAccepted: { type: Boolean, default: false },
      agreementSignedBy: String,
      agreementSignedAt: Date,
      commissionAcknowledged: { type: Boolean, default: false },
      offPlatformPolicyAccepted: { type: Boolean, default: false },
      saasPlan: {
        tier: { type: String, enum: ["STARTER", "PRO", "PREMIUM"], default: "STARTER" },
        billingStatus: { type: String, enum: ["trial", "active", "past_due", "cancelled"], default: "trial" },
        startedAt: Date,
        nextInvoiceAt: Date
      },
      reviewStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" }
    },
    savedHostels: [{ type: mongoose.Schema.Types.ObjectId, ref: "Hostel" }],
    notifications: [notificationSchema]
  },
  { timestamps: true }
);

// Mongoose 9 no longer passes a `next` callback into async pre-hooks (an async
// function signals completion via its returned promise instead). The previous
// version of this hook declared `async function hashPassword(next)` and called
// next() explicitly -- since Mongoose never supplies next() to an async hook,
// `next` was undefined and every single User.create()/save() against a real
// database threw "next is not a function", meaning no user could ever actually
// be created once demo mode was off. This was invisible all session because
// every prior test ran against the in-memory demo-mode arrays, which never
// invoke Mongoose middleware at all. Fixed by dropping the next() calls.
userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("User", userSchema);
