# Phase 2 — Hostel-management SaaS: implementation log

*Branch `feature/hostel-saas-phase2`. Builds on Phase 1 (`05-Phase1-Hostel-Block-Management.md`). Design decisions and data-model deltas: `06a-design-note.md`. Browser QA plan: `07-Phase2-UseCase-and-QA-Prompt.md` (not yet run).*

## 1. What was built

| Area | What it does | Main files |
|---|---|---|
| One clock | All business dates use Asia/Karachi calendar days. In non-production, QA can time-travel with `CLOCK_OFFSET_DAYS` or `POST /api/v1/dev/clock` (admin only; the route returns 404 in production). | `services/clock.js`, `routes/devRoutes.js` |
| Policies | One `HostelPolicy` per hostel, plus per-block overrides. Resolution order is block → hostel → platform default (30 days notice / rent due on the 5th / PKR 100 per day), and each value reports which level set it. Head office edits the policy; a warden reads only the effective values for their own blocks. Invoices and notices copy the terms in force when they are created. | `models/HostelPolicy.js`, `routes/policyRoutes.js`, `services/policyRules.js` |
| Offline students | An offline student is the same `User` + `Booking` as an online one, with `source:"offline"`: commission 0 and no escrow. A login is optional (`loginEnabled`), and the student can claim one later by invite code plus phone, with all history kept. The registration form takes the full profile, uploads, deposit and first invoice. CSV import has a template, a preview, and an all-or-nothing commit with rollback; duplicates are skipped and reported. | `services/residentService.js`, `services/residentRules.js`, `routes/residentRoutes.js` |
| Fee engine | Invoices copy the late-fee terms at creation. The fine is stored inside the invoice and recomputed from dates (never added to day by day). Payments are split rent-first or fine-first according to policy. Quotes show the amount for today and tomorrow. | `services/feeService.js`, `routes/feeRoutes.js` |
| Late fines | Fines are recomputed lazily on every read and payment, and by `POST /api/v1/jobs/late-fees` and `/jobs/daily` (CRON_SECRET or admin; logged in JobLog; safe to run twice). | `routes/jobRoutes.js` |
| Fine waivers | The student, or a warden on the student's behalf (flagged), submits a request. The warden can add a recommendation. Only head office decides (full, partial or reject, with a mandatory note; optionally waive and freeze). The student can cancel. Head office can also waive directly. There is one pending request per invoice, and a monthly charged-vs-waived report. | `models/FineWaiverRequest.js`, `routes/waiverRoutes.js` |
| Leave notice | The policy is copied onto the notice at submission. Short notice is handled per policy: block (shows the earliest allowed date), flag only, or charge (charge days × rent/30). There is one open notice per stay. Head office approves; a warden can approve only if the policy allows it. An approved seat shows **leaving on <date>** on the seat map. Reminders go out 7 days and 1 day before. | `models/LeaveNotice.js`, `routes/leaveRoutes.js`, `services/leaveService.js` |
| Checkout | Unpaid rent blocks checkout and the dues are listed. Settlement = deposit − dues − damages, and dues are cleared from the deposit through internal `deposit_adjustment` receipts. The seat is freed and the bed returns to the marketplace. Checking out twice is refused. | `services/leaveService.js#checkout` |
| Offers | `HostelOffer` and `OfferRedemption`, kept separate from the marketplace `Discount` model and mounted at **`/api/v1/hostel-offers`** (`/api/v1/offers` is the existing rent-negotiation API). Capacity is reserved atomically, a unique index makes double-clicks safe, and per-student limits apply. Discounts appear as explicit negative lines on the invoice and the receipt. Payment-time offers (early payment, advance, long stay) apply only when the payment clears the rent, never to a late invoice, and fines are never discounted. Coupons, manual and scholarship offers need head-office approval when flagged. Discounts can be reversed, and voiding a payment reverses its discount. | `services/offerService.js`, `routes/hostelOfferRoutes.js` |
| Notifications | `emitHostelEvent` fans out to in-app notifications (`User.notifications`) and to email only when SMTP, Gmail or SendGrid is configured. WhatsApp is never sent automatically; staff get `wa.me` links instead. Scheduled reminders are de-duplicated through `HostelEventLog`. | `services/hostelEvents.js`, `models/HostelEventLog.js` |
| Visitors | A student pre-registers a visitor, or a warden or head office logs a walk-in. Only the last 4 digits of the visitor's CNIC are stored. The warden approves or denies; check-in and check-out are recorded against the policy's visiting hours, and an outside-hours check-in needs an override note and is flagged. There is a visitor log per block, and parents can see it. | `models/Visitor.js`, `routes/visitorRoutes.js` |
| Reports | `/api/v1/ops-reports/:report` for collections, outstanding + ageing, fines, occupancy, movements, complaints, offers and profit. Each takes a date range and exports to CSV (Excel BOM, safe against formula injection) or PDF. Wardens see only their own blocks; profit is head office only. | `routes/opsReportRoutes.js`, `services/reportRules.js` |
| Expenses | Head office records expenses by category. Profit = collections − expenses, where collections exclude refundable deposits. | `models/HostelExpense.js`, `routes/expenseRoutes.js` |
| Transfers | Request → approve → atomic move. Open invoices and leave notices follow the student to the new block, and an optional new rent applies to future billing. Students see free seats only. | `models/SeatTransfer.js`, `routes/transferRoutes.js` |
| SaaS | An onboarding checklist, receipt branding (logo, footer, contact), a per-hostel "download everything" export, and plan seat limits (STARTER 50 / PRO 300 / PREMIUM unlimited, counted per owner). Going over the limit returns 402 with an upgrade message and writes nothing. | `routes/headOfficeRoutes.js` |
| UI | New tabs in the Head Office and Warden consoles: Residents, Waivers, Leave requests, Offers, Visitors, Transfers, Reports, Expenses, Policies, Setup wizard. The student page gains offers, an invoice breakdown with a waiver request and coupon entry, Leave hostel, Visitors and Change room. The parent panel gains fines, leave and visitors (read-only). There is a new `/claim` page. | `client/src/pages/ops/*`, `client/src/pages/ClaimAccountPage.jsx` |

### Fixes to existing behaviour made along the way
- **Tenant leak:** offline admission checked seat state before authorisation, so another hostel's owner got "seat not free" (409) instead of 403. Authorisation now always runs first, and the use-case script checks this (O2b).
- **Express 5 body handling:** Express 5 leaves `req.body` undefined when a request has no body, so a POST with no body (for example, checkout) returned 500. `server.js` now defaults `req.body` to `{}`.
- **Business clock in Phase 1 routes:** parent-invite expiry, staff suspension and termination dates, and complaint timestamps now use the business clock. Before, invites issued on the business clock were checked against wall-clock time.
- **Time bomb in the Phase 1 script:** its fixed due date of 2026-11-10 would have started failing once that date passed; it is now relative.
- **Recovered overwrite:** `routes/offerRoutes.js` (marketplace rent negotiation) was overwritten for a moment while building this phase and was restored from git before any commit. Hostel offers live in `routes/hostelOfferRoutes.js`.

## 2. Scheduled job (Railway cron)
Fines and reminders self-heal, because fines are recomputed on every read and reminders are de-duplicated. The daily job only makes notifications timely.

```
# Railway → New service → "Cron job" (schedule is UTC; 19:05 UTC = 00:05 Asia/Karachi)
Schedule: 5 19 * * *
Command:  curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" "$API_PUBLIC_URL/api/v1/jobs/daily"
Env:      CRON_SECRET (same value as the API service), API_PUBLIC_URL
```
`/jobs/daily` = late fees + due-soon reminders (3 days before) + 7-day and 1-day leave reminders. `/jobs/late-fees` runs the fine refresh on its own.

## 3. Verification (run 2026-11-01, Windows / Node 22, throwaway MongoDB 7.0.14)

| Command | Result |
|---|---|
| `cd server && npm test` (pure rules: policy, fines, leave, waivers, offers, settlement, residents, CSV, reports, Phase 1 rules) | **91 / 91 pass** |
| `npm run usecases:hostel` (Phase 1 regression) | **90 / 90 pass** |
| `npm run usecases:phase2` (live API: policies, offline + CSV, fines F0–F11, waivers W1–W12, leave L0–L13, offers D0–D13, visitors, reports, expenses, transfers, SaaS, notifications, cross-tenant 403s) | **119 / 119 pass** |
| `cd client && npm run lint` | 0 problems |
| `cd client && npm run build` | success |

Both live scripts need the API running outside production against the **same** throwaway database (`MONGO_URI`), ideally with `RATE_LIMIT_DISABLED=true`. They create and delete `[QA-HOPS]` / `[QA-P2]` data only, and reset the clock at the end.

**Not run:**
- the browser walkthrough (375 px width, keyboard-only use, console errors). That is `07-Phase2-UseCase-and-QA-Prompt.md`, written for Claude in Chrome;
- real email or WhatsApp delivery;
- a run against staging;
- load testing at 300 students / 1,000 invoices.

## 4. Known limits (honest list)
1. **Staff-termination notices** still use the Phase 1 direct in-app push, not `emitHostelEvent`: in-app only, no email.
2. **No accountant or guard logins.** Expenses are head office only, and wardens log walk-in visitors. `StaffMember` roles other than warden still have no login.
3. **Online-booking deposits** come from `Booking.securityDeposit`, which is held by platform escrow. Checkout records the refund amount but does not move escrow money; paying the refund is still a manual step.
4. **Plan limits** count the seats of every hostel the owner owns. Hostels in a group owned by someone else are not added together.
5. **Advance-month offers** are checked against one invoice's period at payment time. There is no "pay 3 months in one go" bundle.
6. **Two transfers into the same seat** are prevented by a re-check after the move plus a rollback, not by a database constraint on (room, bed) for live bookings.
7. **The runtime clock offset is per process.** With several API instances, use `CLOCK_OFFSET_DAYS`, which is shared through the environment.
8. **List screens recompute the fines of open invoices on each request.** That is fine at pilot scale but not load-tested; at large scale, rely on the daily job and cache.
9. **Offline residents must have a phone number**, because it is the duplicate key and the claim check.
10. **Six pre-existing marketplace pages** keep a targeted `react-hooks/set-state-in-effect` disable, and older routes still use Mongoose's deprecated `{ new: true }` (a warning only). New Phase 2 code uses `returnDocument: "after"`.
11. **PDF reports are plain tables**; CSV is the format meant for analysis.
12. **Receipt numbers** are sequential per year across the platform (Phase 1 behaviour). A rejected payment can skip a number, and numbers are never reused.

## 5. Needs a product decision (defaults shipped; see `06a` §1)
- **Late admission:** fines on an invoice issued after its due date start the day after issue. The alternative is to give a fresh due date.
- **Grace days** are free days after the due date: due on the 5th with 2 grace days means the first fine day is the 8th.
- **Default short-notice action** = flag only, with 0 charge days.
- **Payment allocation default** = rent first.
- **Early-payment discounts** apply only when the payment clears the whole remaining rent.
- **Profit** excludes refundable security deposits from income.
- **Walk-in visitors** logged by staff are approved automatically; a warden's offer applications always go to head office for approval.
- **Plan seat limits** (50 / 300 / unlimited per owner) and whether a 402 should block only new rooms (current behaviour) or also admissions.
