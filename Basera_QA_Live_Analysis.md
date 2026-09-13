# Basera — Live QA Testing Analysis (Working Document)

*Started September 13, 2026. This is a live, step-by-step-updated companion to `Basera_Production_Readiness_Audit.md`. That file holds the original static audit plus deployment history (ADDENDUM 1-6); this file holds the detailed, ongoing QA Engineer test log for the current end-to-end live pass — every test run, its exact result, and every bug found/fixed during this pass. Updated after each test batch, not just at the end.*

**Test environment:** live production — frontend `https://basera-pk.netlify.app`, backend `https://basera-api-production.up.railway.app`, real MongoDB Atlas (`Cluster0` / `basera` database). All test data uses the `qa.*` synthetic-account naming convention and `[QA] ...` synthetic property names per the safe-test-data rules — never real customer data, never real payment credentials, never real notifications.

**QA accounts in use** (all created earlier this pass, tokens cached client-side):
qa.student.001, qa.student.002, qa.hostelowner.001, qa.hostelowner.002, qa.hotelowner.001, qa.guesthouseowner.001, qa.groupowner.001, qa.admin.001, qa.finance.001.

---

## 0. Deploy + regression retest — September 13, 2026 (commit `82f5093`)

User pushed the fixes from §5 items 3, 4, 5, 6, 7, 10 (Room geo-index, Room fake-lister, booking confirm/accept/decline IDOR, deposit IDOR, hostel-bookings-view IDOR, document payout/earnings IDOR, group-attach IDOR). Railway auto-deploy still did not fire on its own, so I re-triggered via `connect-service-source` as before; build completed clean (`SUCCESS`, no errors in build log) and I re-ran every exploit that previously succeeded:

| Retest | Before fix | After fix | Result |
|---|---|---|---|
| Room creation with no coordinates | `500` | `201`, `location`/`coordinates` correctly omitted | PASS |
| Room create response `lister` field | fabricated ("Alex H.", stock photo) | real host, correctly masked via `publicHostProfile` ("QA H.") | PASS |
| `qa.hostelowner.002` confirms `qa.hostelowner.001`'s booking | `200` (hijacked) | `403 "Not authorized for this booking."` | PASS |
| `qa.hostelowner.002` requests deposit deduction on that booking | would have succeeded | `403` | PASS |
| `qa.hostelowner.002` views `GET /bookings/hostel/:id` for a hostel they don't own | `200` (full student PII leak) | `403 "You can only view bookings for hostels you own."` | PASS |
| `qa.hostelowner.001` (real owner) views the same endpoint | — | `200`, full correct data | PASS (no regression for legitimate use) |
| `qa.hostelowner.002` downloads payout PDF for another host's booking | `200` | `403 "You can only view your own payout statements."` | PASS |
| `qa.hostelowner.001` attaches their own hostel into `qa.groupowner.001`'s group without being that group's owner | would have succeeded | `403 "You can only manage your own hostel group."` | PASS |

**All 8 fixes confirmed working in production with zero regressions on the legitimate-use path.** Still outstanding: the `COMMISSION_RATE_DEFAULT` env-var misconfiguration (§5 item 8) — code-side nothing to deploy there, needs the env var value corrected directly.

---

## 1. Status snapshot

| Area | Status |
|---|---|
| Railway auto-deploy investigation | Done — see master audit ADDENDUM 6. Conclusion: no confirmed passive webhook; every deploy so far required a manual re-trigger. |
| Mongoose-9 hook bug (Hostel/Property/HostelGroup/Dispute/DepositCase) | Fixed, deployed, retested live — all pass. See master audit ADDENDUM 6. |
| RBAC + IDOR (hostel routes) | Tested — pass. See §2. |
| Property management create flow (hostel/hotel/guest-house/group) | Tested — pass, with 2 new bugs found or fixed. See §3. |
| Room creation | Tested — 1 new bug found + fixed (geo-index), 1 new bug found + fixed (fake lister fallback). **Both fixed locally, NOT yet deployed.** See §3.1/§3.2. |
| Booking journey | Tested — 3 critical IDOR bugs found + fixed locally (confirm/accept/decline, deposit deduction/refund, hostel-bookings view). **Not yet deployed.** See §4/§5. |
| Group owner tenant isolation | Partially tested — 1 bug found + fixed (group-attach didn't check group ownership). Full isolation retest pending deploy. See §5 item 10. |
| Payments / offline ledger | Manual-payment approval was completely broken (invalid ledger enum) — fixed locally, pending deploy. Commission-rate misconfiguration (§5 item 8) still blocked pending your action. Gateway sandbox NOT TESTED (no credentials). |
| Chat platform-mediation | Tested — contact-leak filter works server-side; direct student→host chat not blocked server-side (architecture decision needed from you, §5a). |
| Loyalty idempotency | Tested — referrals race-safe; claims redemption had a critical race condition, fixed locally, pending deploy. See §5c. |
| Search/ranking/maps/trip planning | In progress. |
| SEO/performance/accessibility spot checks | Pending. |

---

## 2. RBAC / IDOR testing — Hostel routes

Target hostel: `[QA] Hostel Alpha` (`6aa6838c8300e2e31493c708`), owned by `qa.hostelowner.001`.

| # | Test | Expected | Actual | Result |
|---|---|---|---|---|
| 1 | `qa.hostelowner.002` (different owner) PUTs owner.001's hostel | 403 | `403 "You can only update hostels you own."` | PASS |
| 2 | `qa.hostelowner.002` DELETEs owner.001's hostel | 403 | `403 "You can only delete hostels you own."` | PASS |
| 3 | `qa.student.001` POSTs a new hostel (role escalation attempt) | 403 | `403 "host or admin access only."` | PASS |
| 4 | Unauthenticated PUT (no token) | 401 | `401 "Not authorized. Token missing."` | PASS |
| 5 | PUT with a JWT whose signature is tampered (last 4 chars of sig flipped) | 401 | `401 "Invalid token."` | PASS |
| 6 | `qa.student.001` POSTs to admin-only `/verify` | 403 | `403 "admin access only."` | PASS |
| 7 | Legit owner (`qa.hostelowner.001`) PUTs their own hostel | 200 | `200`, description updated | PASS |
| 8 | Admin (`qa.admin.001`) PUTs any hostel | 200 | `200`, updated | PASS |

**Conclusion:** hostel-route RBAC/IDOR/JWT-tampering protections are correctly implemented and functioning against the live database. No bugs found in this batch.

---

## 3. Property management flow

### 3.1 Hostel / hotel / guest-house / group creation (initial retest)

| Flow | Endpoint | Account | Result |
|---|---|---|---|
| Hostel creation, incomplete payload | `POST /hostels` | qa.hostelowner.001 | `422`, clean validation-error list (identity doc, property doc, agreement fields) — correct behavior, not a crash |
| Hostel creation, full valid payload | `POST /hostels` | qa.hostelowner.001 | `201`, persisted (verified via direct DB `count`) |
| Hotel property creation | `POST /stays/properties` | qa.hotelowner.001 | `201` |
| Guest-house property creation | `POST /stays/properties` | qa.guesthouseowner.001 | `201` |
| Hostel group creation | `POST /hostel-groups` | qa.groupowner.001 | `201` |

### 3.2 BUG — Room creation crashes with 500 when no coordinates supplied

**Severity:** High (blocks a core write path for any host who doesn't have exact lat/lng on hand).

**Repro:** `POST /api/v1/rooms` as `qa.hostelowner.001` with a full valid room payload but no `coordinates`/`location` field → `500 "Can't extract geo keys: ... Point must be an array or object, instead got type missing"`.

**Root cause:** `Room.js` has a 2dsphere index on the whole `location` object (`roomSchema.index({ location: "2dsphere" })`), unlike `Hostel.js`/`Property.js` which index only `location.coordinates` (a plain array path, safely absent-able). `location.type` has a schema default of `"Point"` that Mongoose applies to the nested subdocument regardless of whether the parent key was supplied in the input; `location.coordinates` has no default. Result: when no coordinates are given, the saved document ends up with `location: { type: "Point" }` — half-valid GeoJSON — which MongoDB's 2dsphere index rejects outright at the driver level.

**Fix applied (`server/models/Room.js`):** added a `pre("validate")` hook (`ensureValidGeoLocation`, no `next` parameter per the established Mongoose-9 pattern) that forces `this.location = undefined` whenever `location.coordinates` isn't a valid 2-element numeric array — so the field is either fully valid GeoJSON or fully absent, both of which the 2dsphere index accepts.

**Status:** fixed locally, **not yet pushed/deployed**. Verified the workaround (supplying `coordinates: {lat, lng}` explicitly) succeeds (`201`) so testing could continue past this point.

### 3.3 BUG — Room create/update responses show a fabricated "lister" (fake host) instead of the real one

**Severity:** Medium (data-integrity/trust issue, not a security hole — the fake data is only ever shown to the host who just created/edited their own room, and real search/detail pages were confirmed unaffected).

**Repro:** immediately after `POST /api/v1/rooms` succeeds, the returned `room.lister` object was `{"id":"u-owner","name":"Alex H.","avatar":"https://images.unsplash.com/...","role":"host", ...}` — a demo/mock-data record, not `qa.hostelowner.001` (the actual real account that just created the room).

**Root cause:** `roomRoutes.js`'s shared `normalizeRoom()` helper falls back to `data/mockData.js`'s demo `users` array whenever `listedBy` isn't a *populated* document — which is exactly the state of the object returned directly by `Room.create()`/`findByIdAndUpdate()` before any `.populate()` call. This fallback is legitimate in demo mode (no real DB) but was firing in live mode too, because the create/update routes never populated `listedBy` before normalizing. Search and detail-page routes were already populating correctly and are unaffected — confirmed by reading all `Room.find`/`findById` call sites in the file.

**Fix applied (`server/routes/roomRoutes.js`):**
- `normalizeRoom()` now only falls back to the mock `users` array when `mongoose.connection.readyState !== 1` (genuinely in demo mode); in live mode with an unpopulated `listedBy` it now returns `lister: null` instead of inventing one.
- Both `POST /` and `PUT /:id` now call `.populate("listedBy", "name role avatar landlordProfile hostProfile")` before normalizing, so their responses show the real host, matching every other route in the file.

**Status:** fixed locally, **not yet pushed/deployed**.

### 3.4 Confirmed working

- `[QA] Room 101` created successfully under `[QA] Hostel Alpha` once coordinates were supplied (`201`, id `6aa686688300e2e31493c70d`).

---

## 4. Student booking journey

Created `[QA] Room 101` (`6aa686688300e2e31493c70d`) under `[QA] Hostel Alpha`, then a real booking as `qa.student.001` (`POST /bookings`, room + checkIn + duration:"monthly", `201`). Financial breakdown returned: `totalRent 15000, serviceFee 400, securityDeposit 5000, totalAmount 20400`. This surfaced a critical financial-configuration bug — see §5 item 8.

| # | Test | Expected | Actual | Result |
|---|---|---|---|---|
| 1 | `qa.student.002` (unrelated) GETs `qa.student.001`'s booking | 403 | `403 "Not authorized for this booking."` | PASS |
| 2 | `qa.student.002` PUTs `/cancel` on it | 403 | `403 "Not authorized for this booking."` | PASS |
| 3 | `qa.hostelowner.002` (unrelated host — does not own this room/hostel) PUTs `/confirm` | 403 | **`200` — succeeded. Booking flipped to `status: confirmed`, `paymentStatus: paid`.** | **FAIL — critical IDOR, see §5 item 5** |
| 4 | Unauthenticated GET | 401 | `401 "Not authorized. Token missing."` | PASS |
| 5 | `qa.student.001` (real owner) GETs their own booking | 200 | `200`, full booking + populated hostel/room + revealed host contact | PASS |
| 6 | `qa.hostelowner.001` (real host) PUTs `/confirm` | 200 | `200` | PASS (already confirmed by the bug in test 3, so this was a no-op re-confirm) |
| 7 | Admin GETs any booking | 200 | `200` | PASS |

**Conclusion:** student-side booking authorization (view/cancel) is correctly enforced. Host-side booking mutation (confirm/accept/decline) had **zero resource-ownership check** — fixed, see §5.

---

## 5. Bugs found this pass — running list

| # | Bug | File(s) | Severity | Status |
|---|---|---|---|---|
| 1 | Mongoose 9 `next is not a function` on Hostel/Property/HostelGroup/Dispute/DepositCase pre-hooks | `server/models/{Hostel,Property,HostelGroup,Dispute,DepositCase}.js` | Critical | **Fixed + deployed + retested live** |
| 2 | Global error handler never logged 5xx errors server-side | `server/middleware/error.js` | High (observability) | **Fixed + deployed** |
| 3 | Room creation 500s when no coordinates supplied (2dsphere index on half-populated GeoJSON) | `server/models/Room.js` | High | Fixed locally, **not yet deployed** |
| 4 | Room create/update responses show a fabricated mock host instead of the real one | `server/routes/roomRoutes.js` | Medium | Fixed locally, **not yet deployed** |
| 5 | **Critical IDOR**: any host account (not just the room's actual host) could confirm/accept/decline ANY booking on the platform via `PUT /bookings/:id/{confirm,accept,decline}`. `confirm` also force-sets `paymentStatus: "paid"` with no real payment-gateway confirmation — a payment-integrity hole stacked on the IDOR. Reproduced live: `qa.hostelowner.002` confirmed a booking on `qa.hostelowner.001`'s room. | `server/routes/bookingRoutes.js` | **Critical** | Fixed locally, **not yet deployed** |
| 6 | Same IDOR class on deposit handling: any host could request a deposit deduction or issue a deposit "refund" on ANY booking via `POST /bookings/:id/deposit/{deduction,refund}`, not just their own tenants'. | `server/routes/bookingRoutes.js` | Critical (financial) | Fixed locally, **not yet deployed** |
| 7 | Same IDOR class on `GET /bookings/hostel/:hostelId`: any host could pull every student's personal details + full booking/payment history for ANY hostel by ID, not just their own. | `server/routes/bookingRoutes.js` | Critical (PII leak) | Fixed locally, **not yet deployed** |
| 8 | **Critical financial misconfiguration**: the live `COMMISSION_RATE_DEFAULT` Railway env var is set to `0.07` instead of `7`. `commissionRateForBooking()` expects a whole-number percent (its other tiers hardcode 5/6/8/10); the escrow breakdown for the QA booking above computed a commission of PKR 11 on PKR 15,000 rent (0.07%) instead of the intended PKR 1,050 (7%) — i.e. the platform is currently collecting essentially zero commission on every booking in this price tier. **I attempted to fix this directly via Railway's env-var API but the action was blocked by my own tool-use safety classifier as a sensitive production financial-config change; I did not attempt to work around that block.** You'll need to update `COMMISSION_RATE_DEFAULT` to `7` yourself in the Railway dashboard (`basera-api` → Variables), or explicitly tell me to retry it. | Railway env var (not code) | **Critical (revenue)** | **Found, NOT fixed — needs your action** |
| 9 | Financial-document IDOR: `GET /documents/payout/:payoutId` let any host download any OTHER host's payout statement by guessing a booking ID; `GET /documents/earnings/:hostId` never checked the requester owned `:hostId` **and** aggregated ALL paid bookings platform-wide regardless of host, so any host got a PDF mislabeled with their own ID that actually showed the entire platform's gross rent/commission/payout totals. | `server/routes/documentRoutes.js` | Critical (financial data leak) | Fixed locally, **not yet deployed** |
| 10 | Group tenant-isolation gap: `POST /hostel-groups/:id/hostels/:hostelId` checked that the requester owned the *hostel* being attached, but never checked they owned (or were admin of) the *group* — so any host could force their own hostel into an unrelated group owner's group without consent. | `server/routes/hostelGroupRoutes.js` | High (tenant isolation) | Fixed locally, **not yet deployed** |

**Pattern note:** items 5-10 are all the same root defect class as the original Mongoose-9 hook bug in spirit (though technically unrelated): a resource-mutating/viewing route checked only the requester's *role* (`authorize("host", "admin")`) and never checked that the requester actually *owns the specific resource* named in the URL. A repo-wide grep (`authorize("host"` across `server/routes/*.js`) turned up roughly 20 more routes using this same role-only pattern — most were manually spot-checked and found to already scope correctly by using `req.user.id` internally rather than trusting a URL param (e.g. `dashboardRoutes.js`'s `/host/*` endpoints), but a handful with an explicit `:id`/`:hostId` param were not individually verified in this pass (e.g. `documentRoutes.js`'s `/hosts/:id/pl-statement`, `/hosts/:id/report-card-certificate`, `/hosts/:hostId/approval-letter`; `offerRoutes.js`'s `/:id/accept|counter|decline`; `blockRoutes.js`'s `PUT /:id`). **Recommendation: a dedicated follow-up pass to audit every remaining `authorize("host", ...)` route that accepts a resource ID in its URL**, applying the same ownership-check pattern used in the fixes above.

---

## 5a. Chat platform-mediation testing

Business rule under test (from your original spec): "Customer → Platform Chat → Admin/Support → Property/Internal Ops" — customers must NOT directly chat with owners unless explicitly permitted, with moderation/audit visibility.

| # | Test | Expected | Actual | Result |
|---|---|---|---|---|
| 1 | Student sends a message with `receiverId` set directly to a host's real user ID (bypassing Support), content: *"can we skip the platform and I pay you directly in cash?"* | Should be blocked/redirected per the stated business rule, or at minimum flagged | `201` — delivered straight to the host, unflagged, no redirection | **Gap found** |
| 2 | Same, but message body contains a raw phone number + email | Contact info should be redacted/flagged | `201` — message stored as `"Call me at [contact hidden until booking] or email [email hidden]"`, `isFlagged: true`, `flagReason: "phone_number,email"` | PASS — content-level contact-leak filtering works correctly server-side |
| 3 | `GET /chat/support-contact` | Resolves to the real admin account | `200` — resolved to `qa.admin.001`/Super Admin correctly | PASS |

**Finding:** the platform-mediation rule ("customers must not directly chat with owners") is currently enforced only by the **frontend's** default UI flow (`ChatPanel.jsx`'s `lockToSupport`), not by the backend API. `POST /chat/messages` accepts any `receiverId` from an authenticated user with no server-side check on the sender/receiver relationship — a student can message any host directly by calling the API, completely bypassing Admin/Support routing and any moderation/audit trail for that conversation. The contact-info redaction filter (`filterChatMessage`) is a real, working, server-side safety net for the "no off-platform payment" concern specifically, but it doesn't address the "no direct chat" architecture requirement on its own.

**This is a product/architecture decision, not a one-line bug fix** — per your rule about not rewriting architecture without justification, I did not unilaterally change this. Two reasonable options, for you to choose between:
- **(a)** Block direct student→host messages server-side entirely until a confirmed booking exists between them (mirroring how deposit/dispute actions are already scoped to a real booking relationship), with all pre-booking contact forced through the admin/support account.
- **(b)** Keep direct chat allowed (many marketplaces do allow host↔guest chat, especially post-booking) but add server-side audit logging/flagging of the *first* message in any new student↔host thread so Admin has visibility, rather than blocking it outright.

Not yet fixed — awaiting your decision on (a) vs (b) vs another approach.

---

## 5b. Payment lifecycle + offline payment/ledger testing

Tested the offline/manual-payment ("challan") workflow end-to-end live: `qa.student.001` issues a partial-amount challan (PKR 3,000) against the existing QA booking → submits proof → `qa.finance.001` reviews.

| # | Test | Expected | Actual | Result |
|---|---|---|---|---|
| 1 | Student creates a challan (offline payment claim) | `201`, status `challan_issued` | `201` | PASS |
| 2 | Student submits proof (slip image + reference) | `200`, status → `proof_submitted` | `200` | PASS |
| 3 | `qa.student.002` (unrelated) lists `/manual-payments/my` | Should not see student.001's challan | `200`, `results: []` | PASS |
| 4 | The student themself tries to self-approve their own challan | 403 | `403 "admin or finance access only."` | PASS |
| 5 | `qa.finance.001` approves the challan | `200`, ledger entry created | **`500 "LedgerEntry validation failed: type: MANUAL_PAYMENT_APPROVED is not a valid enum value for path type."`** | **FAIL — critical bug, see below** |
| 6 | Admin lists all manual payments | `200`, full list with populated student+booking | `200` | PASS |

**BUG — manual/offline payment approval has never worked against a real database.** `manualPaymentRoutes.js`'s admin/finance approval step posts `createLedgerTransaction({ type: "MANUAL_PAYMENT_APPROVED", ... })`, but `"MANUAL_PAYMENT_APPROVED"` was never added to `LedgerEntry.js`'s `type` enum — so the call always throws a Mongoose validation error, meaning **every single manual/offline payment approval in this project's history has 500'd before ever updating the booking, crediting the ledger, or notifying anyone**, for the same underlying reason as the Mongoose-9 hook bug and the earlier Hostel/Property bugs: demo mode never touches real Mongoose schema validation, so this was invisible through every prior "live" test pass until an admin/finance account actually tried to approve a real challan just now. A second, cascading bug was hiding behind the first: the ledger lines also referenced an `account` value (`"manual_payment_clearing"`) that was never in the `account` enum either — it would have failed immediately after the `type` fix if not caught in the same pass.

**Fix applied:**
- `server/models/LedgerEntry.js`: added `"MANUAL_PAYMENT_APPROVED"` to the `type` enum.
- `server/routes/manualPaymentRoutes.js`: changed the credit line's account from the invalid `"manual_payment_clearing"` to the existing, semantically-correct `"student_receivable"` (cash debited in, the student's outstanding balance credited down — mirroring how the real gateway-payment ledger lines already model this).

**Status:** fixed locally, **not yet deployed.** This directly blocks the exact partial-payment math scenario from your spec (pay 3,000 of 10,000 → 7,000 remaining, Partially Paid; then +7,000 → Paid, 0 remaining) — I could not complete that test because the very first approval crashes. Will retest fully once this is deployed.

**Also noted (not a bug, a scope gap):** there is no dedicated running-balance "Fee" record that tracks *cumulative* partial payments against a fixed total (e.g. "10,000 due, 3,000 paid, 7,000 remaining, status Partially Paid"). The closest analogs are `Booking.instalments[]` (fixed-schedule instalments, each fully PAID or not — no partial-amount-within-an-instalment tracking) and the manual-payment challan system tested above (each challan is a discrete claimed amount, approved or rejected as a whole; nothing sums multiple challans against one fixed due amount to compute a running "remaining balance" or a "Partially Paid" status label). If you need the exact "partial payment reduces a running balance until it hits zero" UX described in your spec, that's a small-to-medium feature gap, not a bug — flagging it for your prioritization rather than building it unprompted.

**NOT TESTED (per your own safe-test-data rules):** real payment gateway sandbox testing (JazzCash/EasyPaisa/Stripe) — no sandbox credentials are configured in this environment. REASON: no test API keys available. WHAT IS REQUIRED: sandbox/test merchant credentials for each gateway. HOW IT SHOULD BE TESTED: once configured, replay this same success/failure/cancelled/duplicate/retry/partial-refund matrix against each gateway's sandbox using their documented test card/wallet numbers, never real payment instruments.

---

## 5c. Loyalty idempotency testing

| # | Test | Expected | Actual | Result |
|---|---|---|---|---|
| 1 | Submit a referral, then immediately resubmit the identical referral (sequential duplicate) | Second attempt rejected, no double credit | `409 "This student has already been referred."`, balance unchanged | PASS |
| 2 | Fire 5 truly concurrent (`Promise.all`) identical referral requests for the same referredEmail | Exactly 1 succeeds | `[409,409,201,409,409]` — exactly one `201`, final balance correct (not 5x credited) | **PASS — genuinely race-safe**, uses an atomic `findOneAndUpdate` with a `$ne` filter |
| 3 | Fire 5 truly concurrent identical loyalty-claim (points redemption) requests when the account has exactly enough points for one claim | Exactly 1 succeeds | **All 5 returned `201`** — 5 separate pending claims for 5,000 points each were created against a single 5,000-point balance | **FAIL — critical race condition, see below** |

**BUG — loyalty point-claim redemption was not race-safe.** `POST /engagement/loyalty/claims` checked `account.pointsBalance < threshold` and then did a plain read-modify-write (`account.pointsBalance -= threshold; await account.save()`), unlike the sibling `loyalty/referrals` endpoint a few lines above it, which already uses a correct atomic `findOneAndUpdate`. Firing 5 identical concurrent claim requests against a 5,000-point balance (threshold 5,000) produced 5 separate `201`s and 5 pending `LoyaltyClaim` documents each nominally worth 5,000 points — 25,000 points' worth of claims from a 5,000-point balance. If an admin later approved all 5 (nothing in the admin-review step cross-checks against the account's actual balance at approval time), this would be a real, exploitable point-duplication/discount-fraud path, exactly the failure mode your spec called out explicitly ("never duplicate points from... race condition").

**Fix applied (`server/routes/engagementRoutes.js`):** replaced the non-atomic balance check-then-save with the same atomic `findOneAndUpdate({ _id: account._id, pointsBalance: { $gte: threshold } }, { $inc: { pointsBalance: -threshold, pointsRedeemed: threshold } })` pattern already used correctly by the referral endpoint. A request that loses the race now gets a clean `422` instead of over-crediting.

**Status:** fixed locally, **not yet deployed.**

---

## 5d. Search/ranking, maps, trip planning testing

**Maps:** tested `/map/commute` (caching), `/map/route` (save + tenant isolation).

| # | Test | Expected | Actual | Result |
|---|---|---|---|---|
| 1 | Repeat an identical `/map/commute` query | Second call served from `CommuteCache`, not a fresh external routing call | Both calls returned `cached: true` (cache already warm from an earlier identical lookup) | PASS |
| 2 | `qa.student.001` saves a route (`POST /map/route`, `save: true`) | `201`, persisted | `201` | PASS |
| 3 | `qa.student.002` (unrelated) lists `/map/routes` | Should not see student.001's saved route | `200`, `results: []` | PASS — correct tenant isolation |
| 4 | `qa.student.001` lists their own routes | Sees their saved route | `200`, 1 result | PASS |

**Trip planning:** searched the entire codebase (server routes/models and client pages) for any "trip planning" feature (create/edit/delete trip, destinations, budget) as named in your original spec. **NOT IMPLEMENTED** — no matching backend routes, models, or frontend pages exist anywhere in this repository. REASON: the feature doesn't exist in this codebase, not a bug I can reproduce or fix. WHAT IS REQUIRED: a product decision on whether to build it (out of scope for this QA pass, which tests existing functionality) or drop it from the feature list. HOW IT SHOULD BE TESTED once built: create/edit/delete a trip, verify destinations and budget fields persist, verify persistence across refresh/logout and an offline→online transition.

**Search/ranking — performance finding (not a functional bug):** `GET /hostels` correctly paginates (`page`/`limit`/`skip` + a separate `countDocuments`). `GET /rooms` (the main room search endpoint used by the marketplace search page) has **no pagination at all** — `Room.find(query).populate(...).sort(...)` with no `.limit()`/`.skip()`, returning every matching document in one response. With the current ~2 QA rooms this is invisible, but it will not scale: as room inventory grows this becomes an unbounded single query and an unbounded JSON payload. Not fixed in this pass — changing this endpoint's response shape (adding pagination) is a contract change the frontend's room-search page would need to be updated to consume, so I flagged it rather than silently changing API behavior without confirming the frontend handles it (per your rule against unprompted architecture changes). **Recommendation:** add the same `page`/`limit`/`countDocuments` pattern already used correctly in `hostelRoutes.js`.

---

## 0a. Second deploy + regression retest — September 13, 2026 (commit `9511ed1`)

User pushed the LedgerEntry-enum, manual-payment-account, and loyalty-claim-race fixes; frontend build also succeeded. Backend build was clean (`SUCCESS`, no errors). Retested:

| Retest | Before fix | After fix | Result |
|---|---|---|---|
| `qa.finance.001` approves the pending manual-payment challan (§5b) | `500` (invalid ledger enum) | `200`, real balanced ledger entries created (`gateway_cash` debit / `student_receivable` credit, both tagged `MANUAL_PAYMENT_APPROVED`) | PASS |
| Fresh student (`qa.student.002`) earns exactly 5,000 points via 5 referrals, then fires 5 truly concurrent claim requests | all 5 previously returned `201` (25,000 points' worth of claims from 5,000 real points) | `[201, 422, 422, 422, 422]` — exactly one succeeded, final balance `0`/`pointsRedeemed: 5000`, exactly one claim document created | **PASS — race condition fully resolved** |
| A challan submitted with no real `bookingId` gets approved | not previously tested | **`500 "LedgerEntry validation failed: booking: Cast to ObjectId failed for value 'b1'... student: Cast to ObjectId failed for value 'u-student'"`** | **FAIL — new bug found, see below** |

**BUG — approving a bookingless manual payment crashed by pulling in demo mock data.** `POST /manual-payments/challan` defaults `bookingRef` to the literal string `"b1"` (a demo-mode placeholder) whenever no valid `bookingId` is supplied, and only sets the real `booking` field when the supplied id passes `mongoose.Types.ObjectId.isValid()`. The `/review` (admin/finance approval) handler's fallback — `payment.booking ? await Booking.findById(...) : bookings.find((item) => item.id === payment.bookingRef)` — reached for `data/mockData.js`'s demo `bookings` array in this case, found nothing real, and (when a challan's `bookingRef` happened to coincide with the demo array's `"b1"` id) passed a fake demo booking object with non-ObjectId fields (`student: "u-student"`) straight into a real-database ledger write, which crashed on cast. Same bug class as the Room.js `normalizeRoom` fake-lister fix from earlier this session: demo-mode fallback data leaking into a live-mode code path.

**Fix applied (`server/routes/manualPaymentRoutes.js`):** when a challan has no real `booking`, use a lightweight real stand-in (`{ student: payment.student }`, the payment's own actual student id) instead of reaching for mock data — this still correctly attributes the ledger entry to the paying student even without a booking on file (e.g. a general account top-up), and never touches demo data in a live-mode code path. Removed the now-unused `bookings` mockData import from this file.

**Status:** fixed locally, **not yet deployed.**

---

## 5e. SEO spot checks

| # | Test | Expected | Actual | Result |
|---|---|---|---|---|
| 1 | `GET /robots.txt` on the live site | References this project's actual domain | **`Sitemap: https://basera.pk/sitemap.xml`** | **FAIL — critical, see below** |
| 2 | `GET /sitemap.xml` on the live site | URLs point at this project's actual domain, only real/stable routes | **All 8 URLs pointed at `https://basera.pk/...`**, including 2 hostel-detail URLs (`cozy-boys-hostel-f-10`, `pine-crest-boys-hostel`) that are leftover demo-data slugs with no matching document in the real live database | **FAIL — critical, see below** |
| 3 | `index.html` canonical/Open Graph/Twitter/structured-data URLs | Point at this project's actual domain | All hardcoded to `https://basera.pk` | **FAIL — critical, see below** |
| 4 | Private dashboard routes excluded from crawling | `robots.txt` disallows every private route prefix | Only `/admin` and `/dashboard` were disallowed; the app also has private dashboards at `/owner/dashboard`, `/host/dashboard`, `/host/stays`, `/landlord/dashboard`, `/warden/dashboard` — **none of these were covered** | **FAIL, see below** |

**CRITICAL — the site's SEO metadata pointed at a live, unrelated third-party website.** I fetched `https://basera.pk/` directly to check whether it's a domain you own (e.g. a future custom domain not yet pointed here). It is not: it's a live, fully built WordPress/Elementor real-estate rental listing site called "Basera - Pakistan No #1 Free Rental Property Listing Website," with entirely different branding, contact info (`0334-0393999`, `baserarental@gmail.com`), agents, and property listings (houses/flats in Lahore/Sialkot/Jhelum, not student hostels), and its own social accounts (`@baserarental`). This is an unrelated, already-operating business that happens to share a similar name — **not a domain you control.**

This means the deployed frontend's `robots.txt` `Sitemap:` directive, every URL in `sitemap.xml`, the `<link rel="canonical">`, Open Graph `og:url`/`og:image`, Twitter `twitter:image`, and the JSON-LD `Organization` schema's `url`/`logo` were **all telling search engines and social-media link previews that this site's canonical home is someone else's unrelated live website.** Practically, this could: prevent the real site from being properly indexed under its own identity, cause social share previews of the real site to reference the wrong URL/domain, and is a brand-confusion/trust risk given the other site is a genuine, active competitor-adjacent business.

**Fix applied:** replaced every hardcoded `https://basera.pk` reference with the actual live origin `https://basera-pk.netlify.app` in `client/index.html` (canonical, OG, Twitter, JSON-LD), `client/public/robots.txt` (Sitemap directive), and `client/public/sitemap.xml` (all 8 URLs). Also removed the 2 sitemap entries pointing at nonexistent demo-hostel slugs. Also expanded `robots.txt`'s `Disallow` rules to cover every actual private-dashboard route prefix found in `App.jsx` (`/owner/dashboard`, `/host/dashboard`, `/host/stays`, `/landlord/dashboard`, `/warden/dashboard`), not just `/admin` and `/dashboard` — left `/landlord/onboarding` crawlable since that's a public marketing/signup page, not a private dashboard.

**Status:** fixed locally, **not yet deployed.** This is a frontend (Netlify) change, not a backend one — will need a frontend redeploy, separate from the Railway backend pushes above.

**Not fixed (flagged only):** the sitemap remains a static file, not dynamically generated from real hostel/room/property listings — fine while the live database has only synthetic QA data, but worth generating dynamically once there's real inventory to index individually. Also, robots.txt-level disallow is enforced at crawl time only; adding an explicit `<meta name="robots" content="noindex">` per dashboard page (via the `react-helmet-async` pattern already used in `StaticPage.jsx`) would be a stronger defense-in-depth layer, since these routes are also all auth-gated. Recommending both as follow-ups rather than making a sweeping multi-file change unprompted.

**Important — please double check:** if `basera.pk` is a domain your business separately owns and simply hasn't pointed at this deployment yet, let me know and I'll restore the domain references (once DNS is actually pointed there) instead of the Netlify URL. As found, it's serving someone else's live content, so I fixed it on the assumption you don't currently control it.

---

## 6. Next steps

1. ~~Booking-journey IDOR testing~~ — done, 3 critical bugs found + fixed locally (pending deploy).
2. Group-owner tenant isolation — 1 bug found + fixed locally (pending deploy); still need to verify a group owner cannot list/manage hostels genuinely outside their group once deployed.
3. Payment lifecycle + offline payment/ledger testing (real gateway sandbox testing will be marked NOT TESTED — no JazzCash/EasyPaisa/Stripe credentials configured). Commission-rate misconfiguration (item 8 above) needs your action before this can be meaningfully tested.
4. Chat platform-mediation, loyalty idempotency, search/maps/trip-planning.
5. SEO/performance/accessibility spot checks.
6. Recommended follow-up: dedicated IDOR sweep of the remaining flagged routes (see §5 pattern note).
7. Push all pending fixes (5 Mongoose-9 model fixes already deployed; Room geo-index, Room fake-lister, and 4 booking/document/group IDOR fixes still pending push) and run a final regression pass.
8. Compile the full sections A-AC final report.
