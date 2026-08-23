const addDays = (date, days) => new Date(new Date(date).getTime() + days * 24 * 60 * 60 * 1000);

const numberOrZero = (value) => Math.max(0, Number(value || 0));

const calculateRefundPreview = ({ booking = {}, amount, checkIn, now = new Date(), reason = "student_cancelled" } = {}) => {
  const totalAmount = numberOrZero(amount ?? booking.totalAmount ?? booking.totalRent);
  const securityDeposit = numberOrZero(booking.securityDeposit);
  const serviceFee = numberOrZero(booking.serviceFee);
  const paidRent = Math.max(0, totalAmount - securityDeposit - serviceFee);
  const moveIn = new Date(checkIn || booking.moveInDate || booking.checkIn || now);
  const hoursBeforeMoveIn = Math.round((moveIn.getTime() - new Date(now).getTime()) / 36e5);

  let rentRefundRate = 0;
  let policyLabel = "No rent refund after move-in window";

  if (hoursBeforeMoveIn >= 72) {
    rentRefundRate = 1;
    policyLabel = "Full rent refund because cancellation is 72+ hours before move-in";
  } else if (hoursBeforeMoveIn >= 24) {
    rentRefundRate = 0.5;
    policyLabel = "50% rent refund because cancellation is 24-72 hours before move-in";
  } else if (hoursBeforeMoveIn >= 0) {
    rentRefundRate = 0.25;
    policyLabel = "25% rent refund because cancellation is within 24 hours before move-in";
  }

  if (reason === "host_cancelled" || reason === "safety") {
    rentRefundRate = 1;
    policyLabel = "Full refund because the Host or platform initiated the cancellation";
  }

  const rentRefund = Math.round(paidRent * rentRefundRate);
  const depositRefund = securityDeposit;
  const refundAmount = rentRefund + depositRefund;
  const nonRefundableAmount = Math.max(0, totalAmount - refundAmount);

  return {
    totalAmount,
    securityDeposit,
    serviceFee,
    paidRent,
    hoursBeforeMoveIn,
    rentRefundRate,
    rentRefund,
    depositRefund,
    refundAmount,
    nonRefundableAmount,
    policyLabel,
    refundEta: addDays(now, 5).toISOString()
  };
};

const calculateLeaveSettlement = ({ booking = {}, moveOutDate, now = new Date() } = {}) => {
  const monthlyRent = numberOrZero(booking.totalRent || booking.totalAmount);
  const securityDeposit = numberOrZero(booking.securityDeposit);
  const cycleEnd = booking.nextRentDueDate ? new Date(booking.nextRentDueDate) : addDays(now, 30);
  const cycleStart = addDays(cycleEnd, -30);
  const totalCycleDays = Math.max(1, Math.round((cycleEnd.getTime() - cycleStart.getTime()) / 864e5));
  const moveOut = new Date(moveOutDate || now);
  const usedDays = Math.min(totalCycleDays, Math.max(0, Math.round((moveOut.getTime() - cycleStart.getTime()) / 864e5)));
  const unusedDays = Math.max(0, totalCycleDays - usedDays);
  const proratedRentRefund = Math.round((monthlyRent / totalCycleDays) * unusedDays);

  return {
    monthlyRent,
    totalCycleDays,
    usedDays,
    unusedDays,
    proratedRentRefund,
    securityDeposit,
    estimatedTotalRefund: proratedRentRefund + securityDeposit,
    moveOutDate: moveOut.toISOString(),
    policyLabel: `Prorated refund for ${unusedDays} unused day(s) of the current billing cycle. Security deposit is finalized separately after move-out inspection.`
  };
};

module.exports = { calculateRefundPreview, calculateLeaveSettlement };
