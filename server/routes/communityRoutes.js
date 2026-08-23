const express = require("express");
const mongoose = require("mongoose");
const CommunityPost = require("../models/CommunityPost");
const RoommateRequest = require("../models/RoommateRequest");
const VisitRequest = require("../models/VisitRequest");
const MoveInChecklist = require("../models/MoveInChecklist");
const HostelPoll = require("../models/HostelPoll");
const MarketplaceItem = require("../models/MarketplaceItem");
const LostFoundItem = require("../models/LostFoundItem");
const DigitalAgreement = require("../models/DigitalAgreement");
const Hostel = require("../models/Hostel");
const Room = require("../models/Room");
const Review = require("../models/Review");
const { protect, authorize, canonicalRole } = require("../middleware/auth");
const { assertNoContactLeak } = require("../services/contactGatingService");
const { recordAudit } = require("../services/auditService");
const { demoHostLeaderboard, scoreHostel } = require("../services/hostScoreService");
const { hostels, rooms, reviews } = require("../data/mockData");
const {
  demoCommunityPosts,
  demoRoommateRequests,
  demoVisitRequests,
  demoMoveInChecklists,
  demoHostelPolls,
  demoMarketplaceItems,
  demoLostFoundItems,
  demoDigitalAgreements
} = require("../data/demoRuntime");

const router = express.Router();
const isDbReady = () => mongoose.connection.readyState === 1;
const toId = (value) => String(value?._id || value?.id || value || "");

const publicDoc = (doc) => {
  const source = doc?.toObject ? doc.toObject() : doc;
  return {
    ...source,
    id: toId(source),
    authorName: source.author?.name || source.authorName,
    requesterName: source.requester?.name || source.requesterName,
    studentName: source.student?.name || source.studentName,
    sellerName: source.seller?.name || source.sellerName,
    reporterName: source.reporter?.name || source.reporterName,
    hostelName: source.hostel?.name || source.hostelName,
    roomTitle: source.room?.title || source.roomTitle
  };
};

const matchesScope = (item, query = {}) => {
  const cityOk = !item.city || !query.city || String(item.city).toLowerCase() === String(query.city).toLowerCase();
  const universityOk = !item.university || !query.university || String(item.university).toLowerCase() === String(query.university).toLowerCase();
  const hostelOk = !item.hostel || !query.hostelId || String(item.hostel) === String(query.hostelId);
  return cityOk && universityOk && hostelOk;
};

const defaultChecklistItems = () => [
  { key: "identity_uploaded", label: "Identity and university proof uploaded", completed: false },
  { key: "payment_confirmed", label: "Booking payment confirmed", completed: false },
  { key: "emergency_contact", label: "Emergency contact added", completed: false },
  { key: "rules_accepted", label: "Hostel rules accepted", completed: false },
  { key: "condition_photos", label: "Room condition photos uploaded", completed: false },
  { key: "agreement_signed", label: "Digital move-in agreement signed", completed: false }
];

const verificationBadge = (user = {}) => {
  const docs = user.verificationDocuments || [];
  const approvedDocs = docs.filter((doc) => doc.status === "approved").length;
  const hasStudentId = Boolean(user.studentId || docs.some((doc) => doc.type === "university_id"));
  const emergencyReady = Boolean(user.emergencyContact?.phone);
  const trusted = Boolean(user.isVerified && hasStudentId && emergencyReady);
  const level = trusted ? "trusted_tenant" : user.isVerified ? "university_verified" : approvedDocs ? "basic_verified" : "starter";
  return {
    level,
    label: level.replaceAll("_", " "),
    score: trusted ? 92 : user.isVerified ? 78 : approvedDocs ? 55 : 30,
    checklist: [
      { label: "Identity approved", completed: Boolean(user.isVerified || approvedDocs) },
      { label: "University ID added", completed: hasStudentId },
      { label: "Emergency contact added", completed: emergencyReady },
      { label: "No open disputes", completed: true }
    ]
  };
};

router.get("/feed", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) {
      return res.json({ results: demoCommunityPosts.filter((post) => post.status === "published").filter((post) => matchesScope(post, req.query)).map(publicDoc), demo: true });
    }
    const query = { status: "published" };
    if (req.query.city) query.$or = [{ city: { $exists: false } }, { city: "" }, { city: new RegExp(`^${req.query.city}$`, "i") }];
    const results = await CommunityPost.find(query).populate("author hostel", "name role city area").sort({ createdAt: -1 }).limit(100);
    return res.json({ results: results.filter((post) => matchesScope(post, req.query)).map(publicDoc) });
  } catch (error) {
    return next(error);
  }
});

router.post("/feed", protect, async (req, res, next) => {
  try {
    assertNoContactLeak({ title: req.body.title, body: req.body.body });
    const role = canonicalRole(req.user.role);
    const payload = {
      author: req.user._id || req.user.id,
      authorName: req.user.name || req.user.email,
      authorRole: req.user.role,
      scope: req.body.scope || "city",
      city: req.body.city || req.user.city,
      university: req.body.university || req.user.university,
      hostel: req.body.hostel || req.body.hostelId,
      hostelName: req.body.hostelName,
      type: req.body.type || "general",
      title: req.body.title,
      body: req.body.body,
      images: req.body.images || [],
      status: role === "admin" || role === "host" ? "published" : "pending"
    };
    if (!payload.title || !payload.body) return res.status(400).json({ message: "Post title and body are required." });

    if (!isDbReady()) {
      const post = { id: `post-${Date.now()}`, ...payload, createdAt: new Date().toISOString(), likes: 0, commentsCount: 0 };
      demoCommunityPosts.unshift(post);
      await recordAudit(req, { action: "community.post.created", entityType: "CommunityPost", entityId: post.id, metadata: { status: post.status } });
      return res.status(201).json({ post: publicDoc(post), requiresApproval: post.status === "pending", demo: true });
    }

    const post = await CommunityPost.create(payload);
    await recordAudit(req, { action: "community.post.created", entityType: "CommunityPost", entityId: post._id, metadata: { status: post.status } });
    return res.status(201).json({ post: publicDoc(post), requiresApproval: post.status === "pending" });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/moderation", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (!isDbReady()) {
      return res.json({
        posts: demoCommunityPosts.map(publicDoc),
        marketplace: demoMarketplaceItems.map(publicDoc),
        lostFound: demoLostFoundItems.map(publicDoc),
        visits: demoVisitRequests.map(publicDoc),
        demo: true
      });
    }
    const [posts, marketplace, lostFound, visits] = await Promise.all([
      CommunityPost.find().populate("author hostel", "name role").sort({ createdAt: -1 }).limit(50),
      MarketplaceItem.find().populate("seller hostel", "name role").sort({ createdAt: -1 }).limit(50),
      LostFoundItem.find().populate("reporter hostel", "name role").sort({ createdAt: -1 }).limit(50),
      VisitRequest.find().populate("student hostel", "name city area").sort({ createdAt: -1 }).limit(50)
    ]);
    return res.json({ posts: posts.map(publicDoc), marketplace: marketplace.map(publicDoc), lostFound: lostFound.map(publicDoc), visits: visits.map(publicDoc) });
  } catch (error) {
    return next(error);
  }
});

router.put("/feed/:id/moderate", protect, authorize("admin"), async (req, res, next) => {
  try {
    const status = req.body.status || "published";
    if (!isDbReady()) {
      const post = demoCommunityPosts.find((item) => item.id === req.params.id) || demoCommunityPosts[0];
      Object.assign(post, { status, moderationNote: req.body.note });
      await recordAudit(req, { action: `community.post.${status}`, entityType: "CommunityPost", entityId: post.id });
      return res.json({ post: publicDoc(post), demo: true });
    }
    const post = await CommunityPost.findByIdAndUpdate(req.params.id, { status, moderationNote: req.body.note }, { new: true });
    if (!post) return res.status(404).json({ message: "Post not found." });
    await recordAudit(req, { action: `community.post.${status}`, entityType: "CommunityPost", entityId: post._id });
    return res.json({ post: publicDoc(post) });
  } catch (error) {
    return next(error);
  }
});

router.get("/roommate-requests", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ results: demoRoommateRequests.map(publicDoc), demo: true });
    const userId = req.user._id || req.user.id;
    const results = await RoommateRequest.find({ $or: [{ requester: userId }, { targetStudent: userId }] }).populate("requester targetStudent room hostel", "name title city area").sort({ createdAt: -1 });
    return res.json({ results: results.map(publicDoc) });
  } catch (error) {
    return next(error);
  }
});

router.post("/roommate-requests", protect, async (req, res, next) => {
  try {
    const room = !isDbReady() ? rooms.find((item) => item.id === req.body.roomId) || rooms[1] : await Room.findById(req.body.room || req.body.roomId);
    const hostel = !isDbReady() ? hostels.find((item) => item.id === (room?.hostel || req.body.hostelId)) || hostels[0] : null;
    const payload = {
      requester: req.user._id || req.user.id,
      requesterName: req.user.name || req.user.email,
      targetStudent: req.body.targetStudent,
      targetName: req.body.targetName || "Matched student",
      room: req.body.room || req.body.roomId,
      roomTitle: req.body.roomTitle || room?.title,
      hostel: req.body.hostel || req.body.hostelId || room?.hostel,
      hostelName: req.body.hostelName || hostel?.name,
      city: req.body.city || room?.city,
      university: req.body.university || room?.nearestUniversity,
      compatibilityScore: Number(req.body.compatibilityScore || 88),
      message: req.body.message || "I think we are a good room sharing match.",
      status: "pending"
    };
    if (!isDbReady()) {
      const request = { id: `rr-${Date.now()}`, ...payload, createdAt: new Date().toISOString() };
      demoRoommateRequests.unshift(request);
      return res.status(201).json({ request: publicDoc(request), demo: true });
    }
    const request = await RoommateRequest.create(payload);
    return res.status(201).json({ request: publicDoc(request) });
  } catch (error) {
    return next(error);
  }
});

router.put("/roommate-requests/:id", protect, async (req, res, next) => {
  try {
    const status = req.body.status || "accepted";
    if (!isDbReady()) {
      const request = demoRoommateRequests.find((item) => item.id === req.params.id) || demoRoommateRequests[0];
      Object.assign(request, { status, respondedAt: new Date().toISOString() });
      return res.json({ request: publicDoc(request), chatEnabled: status === "accepted", demo: true });
    }
    const request = await RoommateRequest.findByIdAndUpdate(req.params.id, { status, respondedAt: new Date() }, { new: true });
    if (!request) return res.status(404).json({ message: "Roommate request not found." });
    return res.json({ request: publicDoc(request), chatEnabled: status === "accepted" });
  } catch (error) {
    return next(error);
  }
});

router.get("/visits", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ results: demoVisitRequests.map(publicDoc), demo: true });
    const role = canonicalRole(req.user.role);
    const query = role === "student" ? { student: req.user._id || req.user.id } : {};
    const results = await VisitRequest.find(query).populate("student hostel", "name city area").sort({ preferredDate: 1 });
    return res.json({ results: results.map(publicDoc) });
  } catch (error) {
    return next(error);
  }
});

router.post("/visits", protect, async (req, res, next) => {
  try {
    const hostel = !isDbReady() ? hostels.find((item) => item.id === (req.body.hostel || req.body.hostelId)) || hostels[0] : null;
    const payload = {
      student: req.user._id || req.user.id,
      studentName: req.user.name || req.user.email,
      hostel: req.body.hostel || req.body.hostelId || "h1",
      hostelName: req.body.hostelName || hostel?.name,
      preferredDate: req.body.preferredDate,
      preferredTime: req.body.preferredTime,
      note: req.body.note,
      status: "pending"
    };
    if (!payload.preferredDate) return res.status(400).json({ message: "Preferred visit date is required." });
    if (!isDbReady()) {
      const visit = { id: `visit-${Date.now()}`, ...payload, createdAt: new Date().toISOString() };
      demoVisitRequests.unshift(visit);
      return res.status(201).json({ visit: publicDoc(visit), demo: true });
    }
    const visit = await VisitRequest.create(payload);
    return res.status(201).json({ visit: publicDoc(visit) });
  } catch (error) {
    return next(error);
  }
});

router.put("/visits/:id/status", protect, authorize("host", "owner", "landlord", "admin"), async (req, res, next) => {
  try {
    const status = req.body.status || "confirmed";
    if (!isDbReady()) {
      const visit = demoVisitRequests.find((item) => item.id === req.params.id) || demoVisitRequests[0];
      Object.assign(visit, { status, preferredDate: req.body.preferredDate || visit.preferredDate, preferredTime: req.body.preferredTime || visit.preferredTime });
      return res.json({ visit: publicDoc(visit), demo: true });
    }
    const visit = await VisitRequest.findByIdAndUpdate(req.params.id, { status, preferredDate: req.body.preferredDate, preferredTime: req.body.preferredTime }, { new: true });
    if (!visit) return res.status(404).json({ message: "Visit request not found." });
    return res.json({ visit: publicDoc(visit) });
  } catch (error) {
    return next(error);
  }
});

router.get("/move-in-checklist/:bookingId", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) {
      const checklist = demoMoveInChecklists.find((item) => item.bookingRef === req.params.bookingId) || { id: `checklist-${req.params.bookingId}`, bookingRef: req.params.bookingId, status: "pending", items: defaultChecklistItems(), roomConditionPhotos: [] };
      return res.json({ checklist: publicDoc(checklist), demo: true });
    }
    let checklist = await MoveInChecklist.findOne({ $or: [{ booking: req.params.bookingId }, { bookingRef: req.params.bookingId }] });
    if (!checklist) checklist = await MoveInChecklist.create({ bookingRef: req.params.bookingId, student: req.user._id || req.user.id, items: defaultChecklistItems() });
    return res.json({ checklist: publicDoc(checklist) });
  } catch (error) {
    return next(error);
  }
});

router.put("/move-in-checklist/:bookingId", protect, async (req, res, next) => {
  try {
    const patchItems = req.body.items || [];
    if (!isDbReady()) {
      let checklist = demoMoveInChecklists.find((item) => item.bookingRef === req.params.bookingId);
      if (!checklist) {
        checklist = { id: `checklist-${req.params.bookingId}`, bookingRef: req.params.bookingId, status: "pending", items: defaultChecklistItems(), roomConditionPhotos: [] };
        demoMoveInChecklists.unshift(checklist);
      }
      checklist.items = checklist.items.map((item) => ({ ...item, ...(patchItems.find((patch) => patch.key === item.key) || {}) }));
      checklist.roomConditionPhotos = req.body.roomConditionPhotos || checklist.roomConditionPhotos || [];
      checklist.status = checklist.items.every((item) => item.completed) ? "completed" : req.body.status || checklist.status;
      return res.json({ checklist: publicDoc(checklist), demo: true });
    }
    const checklist = await MoveInChecklist.findOneAndUpdate(
      { $or: [{ booking: req.params.bookingId }, { bookingRef: req.params.bookingId }] },
      { items: patchItems.length ? patchItems : defaultChecklistItems(), roomConditionPhotos: req.body.roomConditionPhotos || [], status: req.body.status || "student_ready" },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return res.json({ checklist: publicDoc(checklist) });
  } catch (error) {
    return next(error);
  }
});

router.get("/polls", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ results: demoHostelPolls.filter((poll) => poll.status === "active").filter((poll) => matchesScope(poll, req.query)).map(publicDoc), demo: true });
    const results = await HostelPoll.find({ status: "active" }).populate("createdBy hostel", "name").sort({ createdAt: -1 }).limit(50);
    return res.json({ results: results.filter((poll) => matchesScope(poll, req.query)).map(publicDoc) });
  } catch (error) {
    return next(error);
  }
});

router.post("/polls", protect, async (req, res, next) => {
  try {
    const options = (req.body.options || ["Option A", "Option B"]).map((option) => (typeof option === "string" ? { label: option, votes: 0 } : option));
    const payload = {
      createdBy: req.user._id || req.user.id,
      createdByName: req.user.name || req.user.email,
      audience: req.body.audience || "students",
      city: req.body.city || req.user.city,
      university: req.body.university || req.user.university,
      hostel: req.body.hostel || req.body.hostelId,
      hostelName: req.body.hostelName,
      title: req.body.title,
      description: req.body.description,
      category: req.body.category || "general",
      options,
      status: "active",
      closesAt: req.body.closesAt
    };
    if (!payload.title || payload.options.length < 2) return res.status(400).json({ message: "Poll title and at least two options are required." });
    if (!isDbReady()) {
      const poll = { id: `poll-${Date.now()}`, ...payload, createdAt: new Date().toISOString() };
      poll.options = poll.options.map((option, index) => ({ id: `opt-${index}`, ...option }));
      demoHostelPolls.unshift(poll);
      return res.status(201).json({ poll: publicDoc(poll), demo: true });
    }
    const poll = await HostelPoll.create(payload);
    return res.status(201).json({ poll: publicDoc(poll) });
  } catch (error) {
    return next(error);
  }
});

router.post("/polls/:id/vote", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) {
      const poll = demoHostelPolls.find((item) => item.id === req.params.id) || demoHostelPolls[0];
      const option = poll.options.find((item) => item.id === req.body.optionId || item.label === req.body.optionLabel) || poll.options[0];
      option.votes = Number(option.votes || 0) + 1;
      return res.json({ poll: publicDoc(poll), demo: true });
    }
    const poll = await HostelPoll.findById(req.params.id);
    if (!poll) return res.status(404).json({ message: "Poll not found." });
    const option = poll.options.id(req.body.optionId) || poll.options[0];
    option.votes += 1;
    option.voters.addToSet(req.user._id || req.user.id);
    await poll.save();
    return res.json({ poll: publicDoc(poll) });
  } catch (error) {
    return next(error);
  }
});

router.get("/marketplace", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ results: demoMarketplaceItems.filter((item) => item.status === "active").filter((item) => matchesScope(item, req.query)).map(publicDoc), demo: true });
    const results = await MarketplaceItem.find({ status: "active" }).populate("seller hostel", "name").sort({ createdAt: -1 }).limit(100);
    return res.json({ results: results.filter((item) => matchesScope(item, req.query)).map(publicDoc) });
  } catch (error) {
    return next(error);
  }
});

router.post("/marketplace", protect, async (req, res, next) => {
  try {
    assertNoContactLeak({ title: req.body.title, description: req.body.description });
    const payload = {
      seller: req.user._id || req.user.id,
      sellerName: req.user.name || req.user.email,
      city: req.body.city || req.user.city,
      university: req.body.university || req.user.university,
      hostel: req.body.hostel || req.body.hostelId,
      hostelName: req.body.hostelName,
      title: req.body.title,
      description: req.body.description,
      category: req.body.category || "other",
      price: Number(req.body.price || 0),
      condition: req.body.condition || "good",
      images: req.body.images || [],
      status: "active"
    };
    if (!payload.title) return res.status(400).json({ message: "Item title is required." });
    if (!isDbReady()) {
      const item = { id: `market-${Date.now()}`, ...payload, createdAt: new Date().toISOString() };
      demoMarketplaceItems.unshift(item);
      return res.status(201).json({ item: publicDoc(item), demo: true });
    }
    const item = await MarketplaceItem.create(payload);
    return res.status(201).json({ item: publicDoc(item) });
  } catch (error) {
    return next(error);
  }
});

router.put("/marketplace/:id/status", protect, async (req, res, next) => {
  try {
    const status = req.body.status || "reserved";
    if (!isDbReady()) {
      const item = demoMarketplaceItems.find((entry) => entry.id === req.params.id) || demoMarketplaceItems[0];
      Object.assign(item, { status });
      return res.json({ item: publicDoc(item), demo: true });
    }
    const item = await MarketplaceItem.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!item) return res.status(404).json({ message: "Marketplace item not found." });
    return res.json({ item: publicDoc(item) });
  } catch (error) {
    return next(error);
  }
});

router.get("/lost-found", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ results: demoLostFoundItems.filter((item) => item.status === "open").filter((item) => matchesScope(item, req.query)).map(publicDoc), demo: true });
    const results = await LostFoundItem.find({ status: "open" }).populate("reporter hostel", "name").sort({ createdAt: -1 }).limit(100);
    return res.json({ results: results.filter((item) => matchesScope(item, req.query)).map(publicDoc) });
  } catch (error) {
    return next(error);
  }
});

router.post("/lost-found", protect, async (req, res, next) => {
  try {
    const payload = {
      reporter: req.user._id || req.user.id,
      reporterName: req.user.name || req.user.email,
      city: req.body.city || req.user.city,
      university: req.body.university || req.user.university,
      hostel: req.body.hostel || req.body.hostelId,
      hostelName: req.body.hostelName,
      type: req.body.type || "lost",
      itemName: req.body.itemName,
      description: req.body.description,
      location: req.body.location,
      images: req.body.images || [],
      status: "open"
    };
    if (!payload.itemName) return res.status(400).json({ message: "Item name is required." });
    if (!isDbReady()) {
      const item = { id: `lost-${Date.now()}`, ...payload, createdAt: new Date().toISOString() };
      demoLostFoundItems.unshift(item);
      return res.status(201).json({ item: publicDoc(item), demo: true });
    }
    const item = await LostFoundItem.create(payload);
    return res.status(201).json({ item: publicDoc(item) });
  } catch (error) {
    return next(error);
  }
});

router.put("/lost-found/:id/claim", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) {
      const item = demoLostFoundItems.find((entry) => entry.id === req.params.id) || demoLostFoundItems[0];
      Object.assign(item, { status: req.body.status || "claimed", claimNote: req.body.claimNote, claimedBy: req.user.id, claimedAt: new Date().toISOString() });
      return res.json({ item: publicDoc(item), demo: true });
    }
    const item = await LostFoundItem.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status || "claimed", claimNote: req.body.claimNote, claimedBy: req.user._id || req.user.id, claimedAt: new Date() },
      { new: true }
    );
    if (!item) return res.status(404).json({ message: "Lost/found item not found." });
    return res.json({ item: publicDoc(item) });
  } catch (error) {
    return next(error);
  }
});

router.get("/agreements/:bookingId", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) {
      const agreement = demoDigitalAgreements.find((item) => item.bookingRef === req.params.bookingId) || {
        id: `agreement-${req.params.bookingId}`,
        bookingRef: req.params.bookingId,
        agreementType: "move_in",
        version: "v1",
        terms: demoDigitalAgreements[0].terms,
        status: "draft"
      };
      return res.json({ agreement: publicDoc(agreement), demo: true });
    }
    let agreement = await DigitalAgreement.findOne({ $or: [{ booking: req.params.bookingId }, { bookingRef: req.params.bookingId }], agreementType: "move_in" });
    if (!agreement) {
      agreement = await DigitalAgreement.create({
        bookingRef: req.params.bookingId,
        student: req.user._id || req.user.id,
        terms: demoDigitalAgreements[0].terms,
        status: "draft"
      });
    }
    return res.json({ agreement: publicDoc(agreement) });
  } catch (error) {
    return next(error);
  }
});

router.post("/agreements/:bookingId/sign", protect, async (req, res, next) => {
  try {
    const role = canonicalRole(req.user.role);
    if (!isDbReady()) {
      let agreement = demoDigitalAgreements.find((item) => item.bookingRef === req.params.bookingId);
      if (!agreement) {
        agreement = { id: `agreement-${req.params.bookingId}`, bookingRef: req.params.bookingId, agreementType: "move_in", version: "v1", terms: demoDigitalAgreements[0].terms, studentSignature: {}, hostSignature: {}, status: "draft" };
        demoDigitalAgreements.unshift(agreement);
      }
      if (role === "student") agreement.studentSignature = { name: req.body.name || req.user.name, signedAt: new Date().toISOString() };
      else agreement.hostSignature = { name: req.body.name || req.user.name, signedAt: new Date().toISOString() };
      agreement.status = agreement.studentSignature?.signedAt && agreement.hostSignature?.signedAt ? "completed" : role === "student" ? "student_signed" : "host_signed";
      return res.json({ agreement: publicDoc(agreement), demo: true });
    }
    const set = role === "student"
      ? { studentSignature: { name: req.body.name || req.user.name, signedAt: new Date(), ip: req.ip }, status: "student_signed" }
      : { hostSignature: { name: req.body.name || req.user.name, signedAt: new Date(), ip: req.ip }, status: "host_signed" };
    const agreement = await DigitalAgreement.findOneAndUpdate(
      { $or: [{ booking: req.params.bookingId }, { bookingRef: req.params.bookingId }], agreementType: "move_in" },
      { $set: set, $setOnInsert: { bookingRef: req.params.bookingId, terms: demoDigitalAgreements[0].terms } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    if (agreement.studentSignature?.signedAt && agreement.hostSignature?.signedAt) {
      agreement.status = "completed";
      await agreement.save();
    }
    return res.json({ agreement: publicDoc(agreement) });
  } catch (error) {
    return next(error);
  }
});

router.get("/nudges", protect, async (req, res) => {
  const badge = verificationBadge(req.user);
  const nudges = [
    { id: "nudge-emergency", type: "profile", priority: "high", title: "Add emergency contact", body: "Emergency contact helps Hosts and Basera respond faster during incidents.", completed: Boolean(req.user.emergencyContact?.phone), actionPath: "/dashboard/student/support" },
    { id: "nudge-rent", type: "payment", priority: "medium", title: "Rent due reminder", body: "Pay rent through Basera to keep escrow and dispute protection active.", completed: false, actionPath: "/dashboard/student/payments" },
    { id: "nudge-badge", type: "trust", priority: "medium", title: `Verification badge: ${badge.label}`, body: "Complete student verification steps to improve Host approval chances.", completed: badge.score >= 90, actionPath: "/dashboard/student/profile" },
    { id: "nudge-community", type: "engagement", priority: "low", title: "Join this week's hostel poll", body: "Vote on mess and activity preferences in the community screen.", completed: false, actionPath: "/dashboard/student/community" }
  ];
  return res.json({ results: nudges, badge, demo: !isDbReady() });
});

router.get("/verification-badge", protect, (req, res) => {
  res.json({ badge: verificationBadge(req.user), demo: !isDbReady() });
});

router.get("/leaderboard", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ results: demoHostLeaderboard(), demo: true });
    const hostelDocs = await Hostel.find({ status: { $ne: "rejected" } }).limit(100);
    const [roomDocs, reviewDocs] = await Promise.all([Room.find().select("hostel"), Review.find({ isPublished: true }).select("hostel rating")]);
    const results = hostelDocs
      .map((hostel) => {
        const roomCount = roomDocs.filter((room) => toId(room.hostel) === toId(hostel._id)).length;
        const reviewCount = reviewDocs.filter((review) => toId(review.hostel) === toId(hostel._id)).length;
        return {
          id: toId(hostel._id),
          name: hostel.name,
          city: hostel.city,
          area: hostel.area,
          rating: hostel.rating?.average || 4.5,
          roomCount,
          reviewCount,
          image: hostel.images?.[0],
          ...scoreHostel({ hostel, roomCount, reviewCount })
        };
      })
      .sort((a, b) => b.score - a.score);
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
