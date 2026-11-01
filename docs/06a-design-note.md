# Phase 2 design note — Hostel-management SaaS

*Extends Phase 1 (`docs/05-…`). Nothing below replaces a Phase 1 module; every item is a delta on existing models/routes.*

## 1. Decisions on ambiguities (defaults chosen; product owner may change)

| # | Question | Decision |
|---|---|---|
| D1 | Offline student without a login — separate `Resident` model or `User`? | **Always a `User` (role `student`)**. New `User.loginEnabled` (default `true`). An offline resident created without login gets `loginEnabled:false`, a placeholder email `<digits>@resident.basera.invalid` and an unusable random password. Login is refused while `loginEnabled` is false. `POST /auth/claim-resident` (one-time code from staff) sets a real password/email and flips the flag. Same `_id` ⇒ invoices, receipts, complaints, leave, parent links stay attached. One code path everywhere. Phone stays mandatory (it is the duplicate key). |
| D2 | Fine start when an invoice is issued after its due date (late admission) | Fines count from `max(dueDay, issueDay)`. Admitted on the 20th with a due date of the 5th ⇒ the 21st is fine day 1. Never back-dated. |
| D3 | `graceDays` semantics | Grace days are free days after the due date: due 5th, grace 2 ⇒ 6th–7th free, 8th = day 1. |
| D4 | When does the fine freeze? | The moment **rent** is fully paid (`stopsWhenRentPaid`, default true). Rent paid on the 8th ⇒ fine = 3 days (6th, 7th, 8th). A frozen fine is still owed until paid or waived. |
| D5 | Payment allocation default | `rent_first` (policy `feeAllocation`). `fine_first` pays the outstanding fine before rent. Each payment stores `rentPortion` / `finePortion`. |
| D6 | Invoice status with fines | `paid` only when rent due **and** fine due are both 0. Rent-only clear ⇒ `partial` with `fineStatus:frozen`. |
| D7 | Short-notice default action | `allow_flag_only` (accept and flag). `shortNoticeChargeDays` default 0. |
| D8 | Who approves leave | Head office; the warden of that block only when the hostel policy sets `leaveNotice.wardenCanApprove: true`. |
| D9 | Offers: reuse marketplace `Discount`? | **No — new `HostelOffer` + `OfferRedemption`.** `Discount` is tied to marketplace checkout (cities, room types, BASERA/HOST funding, booking totals) and is used by `discountRoutes.js`; mixing invoice-level hostel offers into it would change marketplace pricing. Separate models, same naming of concepts. |
| D10 | `requiresApproval` offers | Applying one creates a redemption in `pending_approval`; nothing is deducted until head office approves. Students/wardens can request; only head office approves. |
| D11 | Early-payment offer on a late invoice | Never: evaluation requires `today <= payBeforeDay` of the due month **and** `today <= dueDay`. Fines are never discountable (only the waiver workflow reduces a fine). |
| D12 | Offer validity boundary | `validFrom`/`validTo` are calendar days in Asia/Karachi, both **inclusive**. |
| D13 | Plan gates | Owner's `hostProfile.saasPlan.tier` (or `landlordProfile`): STARTER ≤ 50 seats, PRO ≤ 300, PREMIUM unlimited, counted across all hostels the owner runs. Enforced when **adding** seats (bulk rooms). Existing data is never touched; the API returns `402` with an upgrade message. Admitting residents into existing seats is never blocked. |
| D14 | Time travel | `services/clock.js`: `now()` = real time + `CLOCK_OFFSET_DAYS` (env) + runtime offset set via `POST /api/v1/dev/clock` (admin). Both are ignored when `NODE_ENV=production`; the route returns 404 there. |
| D15 | Notifications | `services/hostelEvents.js#emitHostelEvent` → `User.notifications` (in-app) + email via `emailService` only when SMTP/Gmail/SendGrid is configured. WhatsApp stays `wa.me` links returned to staff. Scheduled reminders are de-duplicated by a unique key in `HostelEventLog`, so jobs can run twice. |
| D16 | Deposit at offline admission | Recorded as `FeeInvoice{kind:"security_deposit"}`; if collected now, a normal `FeePayment` receipt is issued for it. |

## 2. Data model deltas

- **New** `HostelPolicy` (unique per hostel): `leaveNotice{days, shortNoticeAction, shortNoticeChargeDays, wardenCanApprove}`, `lateFee{enabled, dueDayOfMonth, finePerDay, graceDays, maxFine, stopsWhenRentPaid}`, `feeAllocation`, `visitors{enabled, start, end, curfew}`, `blockOverrides[{block, leaveNoticeDays, dueDayOfMonth, finePerDay, maxFine}]`.
- `Booking`: `source: online|offline`, `admittedBy`. Offline ⇒ `commission 0`, `escrowStatus not_created`, `ownerReceives = rent`.
- `User`: `loginEnabled`, `residentProfile{cnic, dob, homeAddress, employer, guardians[], photoUrl, cnicDocUrl, billingPlan}`, `claimCode`, `claimCodeExpiresAt`.
- `FeeInvoice`: `issuedAt`, `finePerDay`, `maxFine`, `graceDays`, `fineAccrued`, `fineWaived`, `finePaid`, `fineStatus: none|accruing|frozen|waived|paid`, `fineAsOf`, `paidInFullAt`, `discounts[{offer, redemption, name, amountOff}]`, `discountTotal`, `lines[{label, amount}]` (e.g. short-notice charge).
- `FeePayment`: `rentPortion`, `finePortion`, `discountApplied`.
- **New** `FineWaiverRequest`, `LeaveNotice`, `HostelOffer`, `OfferRedemption`, `HostelEventLog`, `Visitor`, `HostelExpense`, `SeatTransfer`.

Money is always integer PKR; every amount is validated with `Number.isInteger`.

## 3. Routes (all `protect` + `requireDb`, tenant resolved from the record)

| Area | Routes |
|---|---|
| Clock | `GET /api/v1/dev/clock`, `POST /api/v1/dev/clock` (admin, non-production) |
| Policy | `GET /api/v1/policies/:hostelId` (head office: full; warden: effective for own blocks), `PUT /api/v1/policies/:hostelId` (head office), `GET /api/v1/policies/:hostelId/effective?blockId=` |
| Residents | `POST /api/v1/residents` (head office any block, warden own block), `POST /api/v1/residents/import/preview`, `POST /api/v1/residents/import/commit`, `GET /api/v1/residents/import/template.csv`, `POST /api/v1/residents/:studentId/invite`, `POST /api/v1/auth/claim-resident` |
| Fines | lazy recompute on every invoice read/payment; `GET /api/v1/fees/invoices/:id/quote`, `POST /api/v1/jobs/late-fees`, `POST /api/v1/jobs/daily` (CRON_SECRET or admin) |
| Waivers | `POST /api/v1/fees/waivers`, `GET /api/v1/fees/waivers`, `GET /api/v1/fees/waivers/my`, `POST /api/v1/fees/waivers/:id/recommend|decide|cancel`, `POST /api/v1/fees/invoices/:id/waive` (proactive), `GET /api/v1/fees/reports/fines` |
| Leave | `POST /api/v1/leave`, `GET /api/v1/leave/my`, `GET /api/v1/leave?hostelId=`, `POST /api/v1/leave/:id/withdraw|decide`, checkout settlement in `POST /head-office/hostels/:id/residents/:bookingId/checkout` |
| Offers | `GET|POST /api/v1/offers`, `PUT /api/v1/offers/:id`, `POST /api/v1/offers/:id/status`, `GET /api/v1/offers/my`, `POST /api/v1/offers/apply`, `POST /api/v1/offers/redemptions/:id/approve|reverse` |
| Extras | `/api/v1/visitors`, `/api/v1/ops-reports/*`, `/api/v1/expenses`, `/api/v1/transfers`, `GET /api/v1/head-office/hostels/:id/export` |

## 4. Rules live in pure modules

`services/policyRules.js` (no DB): `resolvePolicy`, `noticeCheck`, `shortNoticeCharge`, `computeFine`, `invoiceTotals`, `allocatePayment`, `clampWaiver`, `evaluateOffer`, `bestCombination`, `settlement`, `planSeatLimit`. `services/clock.js`: `now`, `startOfDayKarachi`, `karachiParts`, `daysBetween`, `dueDateFor`, `dayKey`. Unit tests: `tests/policyRules.test.js`, `tests/clock.test.js`.
