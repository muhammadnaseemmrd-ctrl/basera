require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const { ensureIndexes } = require("./config/indexes");
const { notFound, errorHandler } = require("./middleware/error");
const { generalApiLimiter, authLimiter, paymentLimiter, mapLimiter } = require("./middleware/rateLimit");
const { hostels } = require("./data/mockData");
const { filterChatMessage } = require("./services/chatFilter");

const authRoutes = require("./routes/authRoutes");
const hostelRoutes = require("./routes/hostelRoutes");
const hostelGroupRoutes = require("./routes/hostelGroupRoutes");
const blockRoutes = require("./routes/blockRoutes");
const roomRoutes = require("./routes/roomRoutes");
const stayRoutes = require("./routes/stayRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const chatRoutes = require("./routes/chatRoutes");
const discountRoutes = require("./routes/discountRoutes");
const documentRoutes = require("./routes/documentRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const reminderRoutes = require("./routes/reminderRoutes");
const financeRoutes = require("./routes/financeRoutes");
const reportRoutes = require("./routes/reportRoutes");
const engagementRoutes = require("./routes/engagementRoutes");
const alertRoutes = require("./routes/alertRoutes");
const maintenanceRoutes = require("./routes/maintenanceRoutes");
const operationsRoutes = require("./routes/operationsRoutes");
const communityRoutes = require("./routes/communityRoutes");
const mapRoutes = require("./routes/mapRoutes");
const studySessionRoutes = require("./routes/studySessionRoutes");
const walletRoutes = require("./routes/walletRoutes");
const recommendationRoutes = require("./routes/recommendationRoutes");
const toolRoutes = require("./routes/toolRoutes");
const shortlistRoutes = require("./routes/shortlistRoutes");
const hostToolRoutes = require("./routes/hostToolRoutes");
const adminTrustRoutes = require("./routes/adminTrustRoutes");
const aiRoutes = require("./routes/aiRoutes");
const routeRoutes = require("./routes/routeRoutes");
const v6AliasRoutes = require("./routes/v6AliasRoutes");
const refundRoutes = require("./routes/refundRoutes");
const mapStoryAliasRoutes = require("./routes/mapStoryAliasRoutes");
const manualPaymentRoutes = require("./routes/manualPaymentRoutes");
const parentRoutes = require("./routes/parentRoutes");
const fieldVerificationRoutes = require("./routes/fieldVerificationRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const vendorRoutes = require("./routes/vendorRoutes");
const moveInPassRoutes = require("./routes/moveInPassRoutes");
const trustOpsRoutes = require("./routes/trustOpsRoutes");
const ambassadorRoutes = require("./routes/ambassadorRoutes");
const waitlistAutomationRoutes = require("./routes/waitlistAutomationRoutes");
const utilityBillRoutes = require("./routes/utilityBillRoutes");
const offerRoutes = require("./routes/offerRoutes").router;
const familyRoutes = require("./routes/familyRoutes");
const academicCalendarRoutes = require("./routes/academicCalendarRoutes");
const groupBookingRoutes = require("./routes/groupBookingRoutes");
const studentTrustRoutes = require("./routes/studentTrustRoutes");
const apiMarketplaceRoutes = require("./routes/apiMarketplaceRoutes");
const messMenuRoutes = require("./routes/messMenuRoutes");
const newsletterRoutes = require("./routes/newsletterRoutes");

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  console.error(
    "FATAL SECURITY WARNING: JWT_SECRET is not set in production. " +
      "The server is falling back to a hardcoded dev secret baked into the public repo, " +
      "which means anyone can forge valid auth tokens. Set JWT_SECRET in the environment immediately."
  );
}

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5000;

const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:4173",
  "https://basera.pk",
  "https://www.basera.pk"
].filter(Boolean);

const isLocalDevOrigin = (origin = "") => {
  try {
    const url = new URL(origin);
    return process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
};

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || isLocalDevOrigin(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true
};

app.set("trust proxy", 1);
app.set("etag", "weak");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors(corsOptions));
app.use(compression());
app.use("/api/v1/payments/stripe/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use("/api/v1/auth", authLimiter);
app.use("/api/v1/payments", paymentLimiter);
app.use("/api/v1/manual-payments", paymentLimiter);
app.use("/api/v1/map", mapLimiter);
app.use("/api/v1", generalApiLimiter);

app.get("/", (req, res) => {
  res.json({
    name: "Basera Pakistan API",
    version: "1.0.0",
    status: "online",
    docs: "/api/v1/health"
  });
});

app.get("/api/v1/health", (req, res) => {
  res.json({
    status: "ok",
    database: req.app.locals.dbReady ? "mongodb" : "demo-data",
    timestamp: new Date().toISOString()
  });
});

app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(["User-agent: *", "Allow: /", "Disallow: /admin", "Disallow: /dashboard", "Sitemap: https://basera.pk/sitemap.xml"].join("\n"));
});

app.get("/sitemap.xml", (req, res) => {
  const staticRoutes = ["", "hostels", "about", "contact"];
  const urls = [
    ...staticRoutes.map((route) => `https://basera.pk/${route}`),
    ...hostels.map((hostel) => `https://basera.pk/hostels/${hostel.slug}`),
    ...["islamabad", "lahore", "karachi", "rawalpindi"].map((city) => `https://basera.pk/hostels/${city}`)
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${url}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`).join("\n")}
</urlset>`;

  res.type("application/xml").send(xml);
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/hostels", hostelRoutes);
app.use("/api/v1/hostel-groups", hostelGroupRoutes);
app.use("/api/v1/blocks", blockRoutes);
app.use("/api/v1/rooms", roomRoutes);
app.use("/api/v1/stays", stayRoutes);
app.use("/api/v1/bookings", bookingRoutes);
app.use("/api/v1/reviews", reviewRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/uploads", uploadRoutes);
app.use("/api/v1/chat", chatRoutes);
app.use("/api/v1/discounts", discountRoutes);
app.use("/api/v1/documents", documentRoutes);
app.use("/api/v1/verify", (req, res, next) => {
  const originalUrl = req.url;
  req.url = `/verify${req.url === "/" ? "" : req.url}`;
  return documentRoutes(req, res, (error) => {
    req.url = originalUrl;
    return next(error);
  });
});
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/reminders", reminderRoutes);
app.use("/api/v1/finance", financeRoutes);
app.use("/api/v1/admin/reports", reportRoutes);
app.use("/api/v1/engagement", engagementRoutes);
app.use("/api/v1/alerts", alertRoutes);
app.use("/api/v1/maintenance", maintenanceRoutes);
app.use("/api/v1/operations", operationsRoutes);
app.use("/api/v1/community", communityRoutes);
app.use("/api/v1/map", mapRoutes);
app.use("/api/v1/study-sessions", studySessionRoutes);
app.use("/api/v1/wallet", walletRoutes);
app.use("/api/v1/recommendations", recommendationRoutes);
app.use("/api/v1/tools", toolRoutes);
app.use("/api/v1/shortlists", shortlistRoutes);
app.use("/api/v1/host", hostToolRoutes);
app.use("/api/v1/admin", adminTrustRoutes);
app.use("/api/v1/ai", aiRoutes);
app.use("/api/v1/routes", routeRoutes);
app.use("/api/v1/refunds", refundRoutes);
app.use("/api/v1/map-stories", mapStoryAliasRoutes);
app.use("/api/v1/manual-payments", manualPaymentRoutes);
app.use("/api/v1/parent", parentRoutes);
app.use("/api/v1/field-verification", fieldVerificationRoutes);
app.use("/api/v1/subscriptions", subscriptionRoutes);
app.use("/api/v1/vendors", vendorRoutes);
app.use("/api/v1/move-in-pass", moveInPassRoutes);
app.use("/api/v1/trust-ops", trustOpsRoutes);
app.use("/api/v1/ambassadors", ambassadorRoutes);
app.use("/api/v1/waitlist", waitlistAutomationRoutes);
app.use("/api/v1/utility-bills", utilityBillRoutes);
app.use("/api/v1/offers", offerRoutes);
app.use("/api/v1/family", familyRoutes);
app.use("/api/v1/academic-calendar", academicCalendarRoutes);
app.use("/api/v1/admin/academic-calendar", academicCalendarRoutes);
app.use("/api/v1/group-bookings", groupBookingRoutes);
app.use("/api/v1/students", studentTrustRoutes);
app.use("/api/v1/api-marketplace", apiMarketplaceRoutes);
app.use("/api/v1/mess-menu", messMenuRoutes);
app.use("/api/v1/newsletter", newsletterRoutes);
app.use("/api/v1", v6AliasRoutes);

app.use(notFound);
app.use(errorHandler);

const io = new Server(server, {
  cors: corsOptions
});

io.on("connection", (socket) => {
  socket.on("join", ({ userId }) => {
    if (userId) {
      socket.join(`user:${userId}`);
      socket.join(`/student/${userId}`);
      socket.join(`/host/${userId}`);
    }
  });

  socket.on("join:role", ({ userId, role }) => {
    if (userId) socket.join(`${role || "user"}:${userId}`);
  });

  let typingTimeout;
  socket.on("chat:typing", (payload = {}) => {
    if (payload.receiverId) io.to(`user:${payload.receiverId}`).emit("chat:typing", { ...payload, at: new Date().toISOString() });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      if (payload.receiverId) io.to(`user:${payload.receiverId}`).emit("chat:stopped-typing", { ...payload, at: new Date().toISOString() });
    }, 1000);
  });

  socket.on("chat:send", (payload) => {
    const filtered = filterChatMessage(payload.message || "");
    const message = {
      id: `msg-${Date.now()}`,
      ...payload,
      message: filtered.message,
      originalMessage: filtered.isFlagged ? filtered.originalMessage : undefined,
      isFlagged: filtered.isFlagged,
      flagReason: filtered.flagReason,
      createdAt: new Date().toISOString()
    };
    if (payload.receiverId) io.to(`user:${payload.receiverId}`).emit("chat:message", message);
    socket.emit("chat:message", message);
  });

  socket.on("booking:update", (payload) => {
    io.emit("booking:updated", { ...payload, updatedAt: new Date().toISOString() });
  });
});

connectDB().then((ready) => {
  app.locals.dbReady = ready;
  if (ready) {
    ensureIndexes().then((result) => {
      console.log(`MongoDB indexes ensured: ${result.created?.length || 0}`);
    }).catch((error) => {
      console.warn(`MongoDB index setup failed: ${error.message}`);
    });
  }
  server.listen(port, () => {
    console.log(`Basera API running on http://localhost:${port}`);
  });
});
