# Basera — Live QA Testing Analysis (Working Document)

*Started September 13, 2026. This is a live, step-by-step-updated companion to `Basera_Production_Readiness_Audit.md`. That file holds the original static audit plus deployment history (ADDENDUM 1-6); this file holds the detailed, ongoing QA Engineer test log for the current end-to-end live pass — every test run, its exact result, and every bug found/fixed during this pass. Updated after each test batch, not just at the end.*

**Test environment:** live production — frontend `https://basera-pk.netlify.app`, backend `https://basera-api-production.up.railway.app`, real MongoDB Atlas (`Cluster0` / `basera` database). All test data uses the `qa.*` synthetic-account naming convention and `[QA] ...` synthetic property names per the safe-test-data rules — never real customer data, never real payment credentials, never real notifications.

**QA accounts in use** (all created earlier this pass, tokens cached client-side):
qa.student.001, qa.student.002, qa.hostelowner.001, qa.hostelowner.002, qa.hotelowner.001, qa.guesthouseowner.001, qa.groupowner.001, qa.admin.001, qa.finance.001.

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
| Payments / offline ledger | Blocked pending your action — critical commission-rate misconfiguration found (§5 item 8), classifier blocked me from fixing it directly. |
| Chat platform-mediation | Pending. |
| Loyalty idempotency | Pending. |
| Search/ranking/maps/trip planning | Pending. |
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

## 6. Next steps

1. ~~Booking-journey IDOR testing~~ — done, 3 critical bugs found + fixed locally (pending deploy).
2. Group-owner tenant isolation — 1 bug found + fixed locally (pending deploy); still need to verify a group owner cannot list/manage hostels genuinely outside their group once deployed.
3. Payment lifecycle + offline payment/ledger testing (real gateway sandbox testing will be marked NOT TESTED — no JazzCash/EasyPaisa/Stripe credentials configured). Commission-rate misconfiguration (item 8 above) needs your action before this can be meaningfully tested.
4. Chat platform-mediation, loyalty idempotency, search/maps/trip-planning.
5. SEO/performance/accessibility spot checks.
6. Recommended follow-up: dedicated IDOR sweep of the remaining flagged routes (see §5 pattern note).
7. Push all pending fixes (5 Mongoose-9 model fixes already deployed; Room geo-index, Room fake-lister, and 4 booking/document/group IDOR fixes still pending push) and run a final regression pass.
8. Compile the full sections A-AC final report.
