const EscrowTransaction = require("../models/EscrowTransaction");

const serviceFee = () => Number(process.env.STUDENT_SERVICE_FEE_PKR || 400);

// Deposit Protection add-on fee: a small percentage of the security deposit,
// capped at a reasonable PKR amount. See Booking.depositProtection and the
// POST /bookings and POST /bookings/:id/deposit-protection/claim routes.
const depositProtectionFeeFor = (securityDeposit = 0, optedIn = false) => {
  if (!optedIn) return 0;
  const rate = Number(process.env.DEPOSIT_PROTECTION_FEE_RATE || 0.03);
  const cap = Number(process.env.DEPOSIT_PROTECTION_FEE_CAP_PKR || 2000);
  return Math.min(cap, Math.round(Number(securityDeposit || 0) * rate));
};

const commissionRateForBooking = ({ rentAmount, duration, bookingType }) => {
  if (bookingType === "TRIAL" || duration === "trial" || duration === "daily") return 10;
  if (duration === "semester" || duration === "annual") return 6;
  if (Number(rentAmount) <= 10000) return 5;
  if (Number(rentAmount) <= 25000) return Number(process.env.COMMISSION_RATE_DEFAULT || 7);
  if (Number(rentAmount) <= 60000) return 8;
  return 6;
};

const calculateEscrowBreakdown = ({ rentAmount = 0, securityDeposit = 0, duration, bookingType, discountAmount = 0, depositProtectionOptIn = false }) => {
  const rate = commissionRateForBooking({ rentAmount, duration, bookingType });
  const fee = serviceFee();
  const depositProtectionFee = depositProtectionFeeFor(securityDeposit, depositProtectionOptIn);
  const commissionAmount = Math.round(Number(rentAmount) * (rate / 100));
  const hostPayoutAmount = Math.max(0, Number(rentAmount) - commissionAmount);
  const totalAmount = Math.max(0, Number(rentAmount) + Number(securityDeposit) + fee + depositProtectionFee - Number(discountAmount || 0));
  return {
    rentAmount: Number(rentAmount),
    securityDeposit: Number(securityDeposit),
    depositAmount: Number(securityDeposit),
    serviceFee: fee,
    depositProtectionFee,
    depositProtectionOptIn: Boolean(depositProtectionOptIn),
    discountAmount: Number(discountAmount || 0),
    commissionRate: rate,
    commissionAmount,
    hostPayoutAmount,
    totalAmount
  };
};

const releaseAfterFor = (moveInDate) => {
  const hours = Number(process.env.ESCROW_HOLD_HOURS || 48);
  const base = moveInDate ? new Date(moveInDate) : new Date();
  return new Date(base.getTime() + hours * 60 * 60 * 1000);
};

const createEscrowForBooking = async ({ booking, room, host }) => {
  const breakdown = calculateEscrowBreakdown({
    rentAmount: booking.totalRent || booking.totalAmount,
    securityDeposit: booking.securityDeposit,
    duration: booking.duration,
    bookingType: booking.bookingType,
    discountAmount: booking.discountAmount,
    depositProtectionOptIn: booking.depositProtection?.optedIn
  });
  return EscrowTransaction.create({
    bookingId: booking._id,
    paymentId: booking.paymentRef,
    student: booking.student,
    host: host?._id || room?.listedBy,
    room: booking.room,
    totalAmount: breakdown.totalAmount,
    rentAmount: breakdown.rentAmount,
    commissionRate: breakdown.commissionRate,
    commissionAmount: breakdown.commissionAmount,
    hostPayoutAmount: breakdown.hostPayoutAmount,
    serviceFee: breakdown.serviceFee,
    discountAmount: breakdown.discountAmount,
    depositAmount: breakdown.depositAmount,
    releaseAfter: releaseAfterFor(booking.moveInDate || booking.checkIn),
    payoutMethod: host?.hostProfile?.payoutMethod || host?.landlordProfile?.payoutMethod || "jazzcash"
  });
};

const releaseEligibleEscrows = async () => {
  const now = new Date();
  const result = await EscrowTransaction.updateMany(
    { status: "HELD", releaseAfter: { $lte: now }, releaseBlockedBy: { $exists: false } },
    {
      status: "RELEASED",
      releasedAt: now,
      commissionTransferredAt: now,
      hostPayoutTransferredAt: now
    }
  );
  return { processed: result.modifiedCount || 0 };
};

module.exports = {
  serviceFee,
  commissionRateForBooking,
  calculateEscrowBreakdown,
  releaseAfterFor,
  createEscrowForBooking,
  releaseEligibleEscrows
};
