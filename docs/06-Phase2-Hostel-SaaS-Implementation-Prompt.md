# Prompt for Claude Code — Phase 2: Complete Hostel-Management SaaS

*Paste everything below the line into Claude Code, opened in the `E:\basera` repo. Reference review of `Sudhanshu-SRS/smart-hostel-management-system` is in §A.*

---

## A. Why this prompt exists (review summary — for your information)

The reference repo (`smart-hostel-management-system`, MERN) is a **single-hostel** app: admin / warden / student, rooms, Razorpay payments, complaints, visitor requests, Socket.io notifications, email. Compared with Basera it is useful only as a feature checklist:

| Reference has | Basera status | Action |
|---|---|---|
| Rooms, allocation | Done (Phase 1: blocks, seats, admit resident) | – |
| Complaints | Done (Phase 1: warden → student confirms) | – |
| Payments | Done for cash/bank/wallet receipts; gateway optional | – |
| **Visitor management** | Missing | Build (P2) |
| Email notifications | Partial (templates exist, not wired to hostel events) | Wire (P2) |
| Analytics dashboard | Partial (head-office overview) | Extend with reports/CSV (P2) |
| Hard-coded admin credentials, single tenant | **Anti-pattern** | Do NOT copy. Basera stays multi-tenant (one hostel can never see another) |

The reference has **none** of what you asked for next (notice-before-leaving, late fines + waiver, offers/discounts, offline students treated as first-class, per-hostel SaaS policies). Those are specified below.

---

# ====== PROMPT STARTS ======

You are a senior full-stack engineer working in `E:\basera` (Node 20 / Express 5 / Mongoose 9 / React 19 + Vite + Tailwind). Phase 1 (hostel & block management) is already built — read `docs/05-Phase1-Hostel-Block-Management.md` first, then the files it lists (`server/services/hostelOpsRules.js`, `hostelAccess.js`, `seatMapService.js`, `routes/headOfficeRoutes.js`, `feeRoutes.js`, `staffRoutes.js`, `complaintRoutes.js`, `noticeRoutes.js`, `parentPanelRoutes.js`, and `client/src/pages/ops/*`). **Extend that code; do not rewrite it or create a parallel system.**

## 0. Goal
Turn Basera into a complete **SaaS hostel-management system**: any hostel can sign up, configure its own policies, load students who registered **offline**, bill them, fine late payers, take leave notices, run offers/discounts, and give wardens, parents and students their own panels — with strict tenant isolation.

## 1. Non-negotiable engineering rules (learned from Phase 1 and QA)
1. **Mongoose 9:** pre-hooks take no `next`; pipeline updates need `{ updatePipeline: true }`; partial indexes can't use `$ne` (use `$in`/`$type`/equality).
2. **Tenant isolation:** every route resolves the hostel from the record, then checks `canManageHostel` / `staffScope` / own-student / linked-parent. Never trust a client-supplied hostel/block id. Add a 403 test for every new endpoint (other hostel's owner, other block's warden, other student, unlinked parent).
3. **Money = integer PKR.** No floats. Whole-number validation on every amount.
4. **Atomic, idempotent state changes** (`findOneAndUpdate` guarded by the expected current status). Scheduled jobs must be safe to run twice, run late, or run for a missed day.
5. **Pure rules first.** Put every business rule (notice-period check, fine calculation, waiver maths, discount eligibility/stacking) in `services/hostelOpsRules.js` or a new pure `services/policyRules.js` with **no DB access**, and unit-test it with `node --test`.
6. **One clock.** Create `services/clock.js` exporting `now()` and `startOfDayKarachi(date)`. All date logic uses it and the **Asia/Karachi** timezone (UTC+5, no DST). In non-production only, `CLOCK_OFFSET_DAYS` (env) or `POST /api/v1/dev/clock` (admin, disabled when `NODE_ENV=production`) shifts it so QA can time-travel. Never call `new Date()` for business dates elsewhere.
7. **Audit everything** that changes money, policy, a student's stay, or staff (`recordAudit`), including who and why.
8. New modules return `503` without a live DB (no mock fallback for money flows). Keep existing demo-mode marketplace routes untouched.
9. Every new page gets a route in `client/src/App.jsx` and a nav/link entry. UI must work at 375 px width and by keyboard; use existing `.panel`, `.btn-*`, `.input` classes.
10. Don't touch secrets or production data. Don't weaken any existing check to make a test pass.

## 2. Feature 1 — Per-hostel policy settings (foundation for everything else)

Create `HostelPolicy` (one per hostel) plus optional per-block overrides:

```
HostelPolicy {
  hostel (unique), updatedBy,
  leaveNotice:   { days: 30, shortNoticeAction: "allow_with_charge" | "allow_flag_only" | "block", shortNoticeChargeDays: 0 },
  lateFee:       { enabled: true, dueDayOfMonth: 5, finePerDay: 100, graceDays: 0, maxFine: null /* PKR cap or null */, stopsWhenRentPaid: true },
  feeAllocation: "rent_first" | "fine_first"   // default rent_first
  blockOverrides: [{ block, leaveNoticeDays?, dueDayOfMonth?, finePerDay?, maxFine? }]
}
```
- Resolution order: **block override → hostel policy → platform default** (30 days / 5th / 100 PKR). Implement `resolvePolicy(hostelId, blockId)` and return the effective values *and which level supplied each*.
- Only the head office (owner / group owner / admin) can edit policy, hostel-wide **and** per block. Wardens can read the effective policy for their block, not change it. Changes apply to **future** invoices/notices; already-issued invoices keep the terms they were issued with (snapshot `dueDate`, `finePerDay`, `maxFine` onto the invoice at creation).
- UI: Head Office → new **Policies** tab: hostel defaults, a table of blocks with "inherit / override" toggles, and a plain-language preview ("A student in Block A must give 45 days' notice; fines start on the 6th at PKR 100/day").

## 3. Feature 2 — Offline-registered students are first-class

Today `POST /head-office/hostels/:id/residents` creates a login + an `active` booking. Generalise it so **an offline student is indistinguishable from an online one everywhere** (seat map, fees, fines, complaints, notices, leave, parents, offers, reports).

- Add `Booking.source: "online" | "offline"` (default online) and `Booking.admittedBy`. Offline stays: `commission = 0`, no escrow, no platform payout.
- Richer offline registration form + endpoint: name, phone, CNIC, DOB, gender, university/employer, home address, guardian(s) (name, relation, phone), emergency contact, photo + CNIC image/PDF uploads (reuse `/uploads`), join date, seat, monthly rent, security deposit (record it as a `FeeInvoice kind:"security_deposit"` + payment if collected), billing plan (monthly | semester | custom), optional first-month discount/offer. Wardens may register students **into their own block only**; head office anywhere.
- **Bulk import:** CSV upload (download a template) to load a whole hostel: validate every row first, show an error table, import only if the user confirms; duplicates (same phone) skipped and reported; never partially apply a failed file.
- Login is optional: if no email/phone login is wanted the student still exists as a managed resident (`User.loginEnabled=false` style flag or a lightweight `Resident` profile) and can be **invited later** (send invite code/WhatsApp link); when they claim it, history stays attached. Decide the simplest model that keeps one code path, and document it.
- **Everything below (fees, fines, leave, offers, notices) must operate on the resident, not on "online booking"**, so offline and online students use identical code.
- Parents of offline students are invited exactly as in Phase 1 (`ParentLink`).

## 4. Feature 3 — Leave notice (default 30 days, configurable per block, head-office controlled)

`LeaveNotice { hostel, block, student, booking, requestedAt, intendedLeaveDate, reason, policyDays (snapshot), noticeDaysGiven, shortBy, status: submitted|approved|rejected|withdrawn|completed, decidedBy, decidedAt, decisionNote, shortNoticeCharge, depositSettlement }`

Rules (pure functions, unit-tested):
- `noticeDaysGiven = daysBetween(startOfDayKarachi(requestedAt), startOfDayKarachi(intendedLeaveDate))`.
- Compliant if `noticeDaysGiven >= policyDays` for the student's block (resolved policy at submission time, snapshotted).
- Short notice → follow `shortNoticeAction`: **block** (reject submission with the earliest allowed date shown), **allow_flag_only** (accept, flagged), **allow_with_charge** (accept; create a `fee` charge of `shortNoticeChargeDays × (monthlyRent/30)` rounded to whole PKR, on a clearly labelled invoice line).
- Intended leave date can't be in the past, can't be before the student's join date; one open notice per stay; student can withdraw before approval; head office (or the warden if head office enabled `wardenCanApproveLeave`) approves/rejects with a note.
- Approval **marks the seat "leaving on <date>"** in the seat map (new seat state `leaving`, still occupied until the date) and exposes "available from <date>" for planning.
- On/after the leave date, **checkout** (existing endpoint) requires: no unpaid rent invoice (outstanding fines may be waived/settled first), then computes a **settlement**: deposit − dues − damages (damage line items entered by head office) = refund/payable; stores it; completes the notice; frees the seat; returns the bed to the marketplace.
- Notifications: student + parent(s) get notice on submit/decision; warden and head office get notice on submit; a reminder 7 days and 1 day before the leave date.
- UI: Student → "Leave hostel" card (shows policy, earliest compliant date, short-notice warning before submit); Parent panel shows an active leave notice read-only; Warden/Head office → "Leave requests" tab with filters and an approve/reject dialog; Head Office → policy tab (above) controls the days.

## 5. Feature 4 — Late-fee fines (default: due on the 5th, PKR 100/day) + waiver requests

**Default rule (confirm with product owner — implement as configurable, ship these defaults):** monthly rent is due on the **5th**. If unpaid after the due date, a fine of **PKR 100 per day** accrues for each day late — the **6th is day 1 (PKR 100)**, the 10th is day 5 (PKR 500). Paid on or before the 5th = no fine. The fine stops growing the moment the rent invoice is fully paid, and is capped by `maxFine` if set.

Data & logic:
- Add to `FeeInvoice`: `dueDate` (snapshotted), `finePerDay`, `maxFine`, `fineAccrued`, `fineWaived`, `fineStatus: none|accruing|frozen|waived|paid`, `fineAsOf`. Keep the fine **inside the invoice document**, not as a separate invoice, so a payment screen shows "Rent 8,000 + Fine 500".
- Pure `computeFine({dueDate, paidInFullAt, asOf, finePerDay, maxFine, graceDays})` → integer PKR. Deterministic from dates — **recomputed, never incremented**, so missed cron runs self-heal.
- A daily job (`POST /api/v1/jobs/late-fees`, protected by `CRON_SECRET`, plus lazy recompute whenever an invoice is read or a payment is taken) updates `fineAccrued` for every open invoice, writes `JobLog`, and is idempotent. Provide the Railway cron config in the docs.
- Payment allocation follows `feeAllocation` (default rent first). A payment screen must show the exact amount needed to clear everything today, and tomorrow's amount.
- **Fine waiver workflow:** `FineWaiverRequest { invoice, student, requestedAmount|"all", reason, evidence[], status: pending|approved|partial|rejected|cancelled, decidedBy, decisionNote, approvedAmount }`.
  - Student (or warden on the student's behalf, flagged) submits with a reason; one pending request per invoice.
  - **Only head office** can approve (full/partial) or reject, with a mandatory note; wardens can *recommend* (note) but not decide.
  - Approval atomically increases `fineWaived` (never above `fineAccrued` at that moment); future accrual after waiver continues unless the head office chooses "waive and freeze".
  - Student and parent are notified; everything audited; head office sees a queue with age and amount, and a monthly "fines charged vs waived" report.
- Head office can also **waive proactively** (no request), with a reason.
- UI: invoice rows show fine badge and breakdown; student "Request waiver" button; head-office "Waivers" tab; parent panel shows fines read-only.

## 6. Feature 5 — Offers & discounts (managed by head office, applied transparently)

Check the existing marketplace `Discount` model/`discountRoutes.js` first. **Do not break it.** Build hostel-operations offers as a separate `HostelOffer` unless reuse is clearly cleaner; document the decision.

```
HostelOffer { hostel, scope: hostel|block, blocks[], name, code?, type: percent|flat|free_days,
  value, appliesTo: rent|all_fees|specific_invoice_kinds[], trigger: manual|early_payment|advance_months|long_stay|referral|sibling|scholarship|coupon,
  condition: { payBeforeDay?, minAdvanceMonths?, minStayMonths? },
  validFrom, validTo, maxRedemptions, perStudentLimit, stackable, requiresApproval, status: draft|active|paused|expired, createdBy }
OfferRedemption { offer, student, invoice, amountOff, appliedBy, appliedAt, status: applied|reversed, reversedReason }
```
- Pure `evaluateOffer` / `bestCombination` (respects stackable, caps, validity, scope, per-student limits; discount never exceeds the line amount; never negative).
- Auto-triggers: **early-payment** (e.g. 2% if paid by the 3rd) applied at payment time; **advance** (pay N months ahead); coupon codes; manual per-student scholarship/waiver with approval.
- Discounts appear as an **explicit negative line** on the invoice and on the receipt PDF ("Early payment 2%: −160"); never silently change `amount`. Redemptions can be reversed (with reason) when a payment is voided.
- Offers must interact correctly with fines: an early-payment discount does not apply to a late invoice; a fine is never discounted unless via the waiver workflow.
- UI: Head Office → **Offers** tab (create/edit/pause, usage counters, expiry), invoice screen shows eligible offers, student sees "Offers for you" and applied savings.

## 7. Feature 6 — Other missing hostel-management essentials (build after 2–6, in this order)
1. **Notification centre:** one `emitHostelEvent()` fan-out → in-app (existing `User.notifications`), email (existing `emailService`, only if configured), and WhatsApp `wa.me` links for staff-initiated broadcasts. Events: invoice issued, due soon (3 days before), fine started, payment received, waiver decision, leave decisions/reminders, complaint status, staff terminated.
2. **Visitor management** (borrowed from the reference repo, done properly): student pre-registers or guard logs a visitor (name, CNIC last-4, purpose, in/out time, host student, block); warden approves/denies; visitor log per block; curfew/visiting-hours from policy; parents see their child's visitors.
3. **Reports & exports (CSV/PDF):** collections by day/month/method, outstanding & ageing (0–7, 8–30, 30+ days), fines charged/waived, occupancy by block, move-in/move-out, complaint turnaround, offer usage. Date-range filters; wardens limited to their block.
4. **Expenses** (simple): head office/accountant logs hostel expenses by category; monthly profit view = collections − expenses.
5. **Room/seat transfer** within the hostel (request → approve → atomically move, with fee-plan carry-over).
6. **SaaS tenancy polish:** hostel onboarding wizard (create hostel → blocks → rooms → policies → staff → import students), per-hostel branding on receipts (name, logo, address, contact), per-hostel data export ("download everything"), subscription tier gates mapped to existing `saasPlan` (e.g. STARTER ≤ 50 seats, PRO ≤ 300, PREMIUM unlimited) with clear upgrade messages — never silently drop data when a limit is hit.

## 8. Work plan (do in this order; commit after each; keep the tree green)
1. Read Phase 1 docs/code; write a **short design note** (`docs/06a-design-note.md`): data model deltas, route list, decisions on ambiguities (list them; default to the stated defaults).
2. `clock.js` + `HostelPolicy` + `resolvePolicy` + Policies tab. Unit tests.
3. Offline-student generalisation + CSV import. Unit + integration tests.
4. Late-fee engine (pure) → invoice fields → job endpoint → payment screen → waiver workflow. Unit tests for `computeFine` across edge cases (see §9).
5. Leave notice engine → seat `leaving` state → checkout settlement.
6. Offers & discounts.
7. §7 essentials in listed order.
8. Extend `scripts/hostelOpsUseCases.js` (or add `scripts/phase2UseCases.js`) with live checks for every new endpoint including the 403s. Update `docs/05-…` or add `docs/07-…` with the implementation log and known limits.
9. Run `npm test`, the use-case scripts, `npm run lint` and `npm run build` (client). **Fix everything red before reporting.** If a command can't run in your environment, say so explicitly — never claim a test passed that you didn't run.

## 9. Required unit-test cases (minimum)
- Fine: paid on the 5th → 0; unpaid on the 6th → 100; on the 10th → 500; paid on the 8th → 300 and frozen after; invoice created after the due date (e.g. admit on the 20th) → no back-dated fine for days before issue; month-end/leap-year; `maxFine` cap; `graceDays`; clock in Asia/Karachi near midnight UTC (19:00 UTC = 00:00 PKT).
- Leave notice: exactly `policyDays` → compliant; one day short → flagged/blocked/charged per action; past date; before join date; block override beats hostel default; policy change after submission doesn't alter the snapshot.
- Waiver: partial approval; approving more than accrued → clamp/reject; double approval → 409; waiver after full payment; accrual after waiver.
- Offers: stackable vs non-stackable, expiry boundary (inclusive end date), max redemptions race (two concurrent), per-student limit, discount > amount, fine not discountable, reversal on payment void.
- Offline source: commission 0, no escrow, same seat/fee/fine/leave behaviour as online.

## 10. Definition of done
- Every feature above works for **online and offline students** with the same code path.
- Every endpoint: success path, validation failure, wrong-tenant 403, double-submit/race safe.
- No hard-coded dates/timezones; no `new Date()` for business dates outside `clock.js`.
- Docs updated; `npm test`, use-case scripts, lint and build green (or honestly reported otherwise).
- Final message lists: what was built, what was **run and passed**, what was not run and why, assumptions you made, and anything needing a product decision.

# ====== PROMPT ENDS ======
