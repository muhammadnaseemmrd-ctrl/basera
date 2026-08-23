const mongoose = require("mongoose");

const demoAllowed = () => process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_MODE === "true";

const connectionOptions = {
  maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 50),
  minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE || 10),
  socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS || 45000),
  serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 5000),
  heartbeatFrequencyMS: Number(process.env.MONGO_HEARTBEAT_FREQUENCY_MS || 10000)
};

let eventsRegistered = false;

const registerConnectionEvents = () => {
  if (eventsRegistered) return;
  eventsRegistered = true;
  mongoose.connection.on("error", (error) => {
    console.error(`MongoDB error: ${error.message}`);
  });
  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected. The app will use demo fallbacks only if allowed by environment.");
  });
  mongoose.connection.on("reconnected", () => {
    console.log("MongoDB reconnected.");
  });
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connectDB = async () => {
  registerConnectionEvents();
  if (!process.env.MONGO_URI) {
    if (!demoAllowed()) {
      throw new Error("MONGO_URI is required in production. Set ALLOW_DEMO_MODE=true only for intentional demo deployments.");
    }
    console.log("MongoDB skipped: MONGO_URI is not configured. API will use demo data.");
    return false;
  }

  let attempt = 0;
  while (attempt < 5) {
    try {
      await mongoose.connect(process.env.MONGO_URI, connectionOptions);
      console.log(`MongoDB connected: ${mongoose.connection.host}`);
      return true;
    } catch (error) {
      attempt += 1;
      if (!demoAllowed() && attempt >= 5) {
        throw error;
      }
      if (demoAllowed()) {
        console.warn(`MongoDB connection failed: ${error.message}`);
        console.warn("API will continue with demo data.");
        return false;
      }
      const delay = Math.min(30000, 1000 * 2 ** (attempt - 1));
      console.warn(`MongoDB connection failed. Retrying in ${delay}ms (${attempt}/5).`);
      await sleep(delay);
    }
  }
  return false;
};

module.exports = connectDB;
