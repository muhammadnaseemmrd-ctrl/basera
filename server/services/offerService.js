// Placeholder hooks used by the fee engine; implemented in the offers step.
async function reserveAutoOffers() {
  return null;
}
async function reverseRedemptionsForPayment() {
  return 0;
}
async function eligibleOffersFor() {
  return [];
}
module.exports = { reserveAutoOffers, reverseRedemptionsForPayment, eligibleOffersFor };
