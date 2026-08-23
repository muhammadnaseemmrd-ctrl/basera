const Booking = require("../models/Booking");
const JobLog = require("../models/JobLog");
const { releaseEligibleEscrows } = require("./escrowService");
const { sendEmail } = require("./emailService");

const chunk = (items = [], size = 100) => {
  const groups = [];
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
  return groups;
};

const withJobLog = async (jobName, fn) => {
  const startedAt = new Date();
  let log = null;
  try {
    if (JobLog.db.readyState === 1) log = await JobLog.create({ jobName, startedAt, status: "running" });
    const result = await fn();
    if (log) {
      log.completedAt = new Date();
      log.processedCount = result.sent || result.processed || result.overdueMarked || result.processedCount || 0;
      log.errorCount = result.errorCount || 0;
      log.status = "completed";
      await log.save();
    }
    return { ...result, jobLogId: log?._id };
  } catch (error) {
    if (log) {
      log.completedAt = new Date();
      log.errorCount = 1;
      log.status = "failed";
      log.notes = error.message;
      await log.save();
    }
    throw error;
  }
};

const reminderMessage = (days, booking) => ({
  bookingId: booking._id || booking.id,
  days,
  amount: booking.totalRent || booking.totalAmount,
  dueDate: booking.nextRentDueDate || booking.checkIn,
  message: `Rent is due in ${days} day${days === 1 ? "" : "s"}. Pay through Basera to keep escrow and dispute protection active.`
});

const sendRentReminders = async (days = 7) => {
  const target = new Date();
  target.setDate(target.getDate() + Number(days));
  const from = new Date(target);
  from.setHours(0, 0, 0, 0);
  const to = new Date(target);
  to.setHours(23, 59, 59, 999);
  const bookings = await Booking.find({
    nextRentDueDate: { $gte: from, $lte: to },
    status: { $in: ["confirmed", "active", "overdue"] },
    lifecycleStatus: { $nin: ["leave_approved", "switch_approved"] }
  })
    .populate("student", "name email")
    .populate("hostel", "name")
    .populate("room", "title");
  const results = [];
  for (const group of chunk(bookings, 100)) {
    const batch = await Promise.all(group.map(async (booking) => {
      const message = reminderMessage(Number(days), booking);
      if (booking.student?.email) {
        await sendEmail({
          to: booking.student.email,
          template: Number(days) <= 1 ? "E-10" : "E-09",
          data: {
            amount: booking.totalRent || booking.totalAmount,
            property: booking.hostel?.name || booking.room?.title || "your room",
            dueDate: booking.nextRentDueDate?.toISOString?.().slice(0, 10)
          }
        });
      }
      return message;
    }));
    results.push(...batch);
  }
  return { sent: results.length, results };
};

const processOverdue = async () => {
  const now = new Date();
  const lateFee = Number(process.env.LATE_FEE_PKR || 500);
  const result = await Booking.updateMany(
    { nextRentDueDate: { $lt: now }, paymentStatus: { $ne: "paid" }, status: { $nin: ["cancelled", "completed", "disputed"] } },
    { $set: { status: "overdue" }, $inc: { lateFee } }
  );
  return { overdueMarked: result.modifiedCount || 0, lateFee };
};

const processEscrowReleases = async () => {
  const result = await releaseEligibleEscrows();
  return { ...result, processed: result.processed || result.released || 0 };
};

const runDailyReminderJobs = async () => {
  const [sevenDay, oneDay, overdue, payout] = await Promise.all([
    withJobLog("rent-reminders-7d", () => sendRentReminders(7)),
    withJobLog("rent-reminders-1d", () => sendRentReminders(1)),
    withJobLog("overdue-processing", () => processOverdue()),
    withJobLog("escrow-release", () => processEscrowReleases())
  ]);
  return { sevenDay, oneDay, overdue, payout };
};

module.exports = { chunk, sendRentReminders, processOverdue, processEscrowReleases, runDailyReminderJobs, withJobLog };
