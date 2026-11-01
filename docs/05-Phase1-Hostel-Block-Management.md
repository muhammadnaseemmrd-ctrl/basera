# Basera — Phase 1: Hostel & Block Management (Gap Analysis + Build Prompt)

*Scope: everything needed to onboard real hostels before the public marketplace "goes living". Reviewed against docs 01–04 and the live code in `server/` and `client/`.*

---

## 1. Where the product stands (honest assessment)

| Area | Status | Evidence |
|---|---|---|
| Marketplace, booking, escrow, ledger, AI, maps, community | ~90% built | docs 01 §6; QA report `Basera_QA_Live_Analysis.md` |
| Hostel / HostelGroup / Block / Room / Bed data | Built | `models/Hostel,Block,Room,BedBlock` |
| Seat state per bed | **Partial** | beds are `Room.totalBeds` + `Booking.bedIndex` + `BedBlock`; no single seat map, no per-block / per-hostel rollup, "reserved" not distinguished from "occupied" |
| Warden | **Partial** | one `wardenId` on `Block`; no staff register, no suspension / termination, no notice |
| Fee management | **Partial** | `ManualPayment` challan → admin approval only; no per-student fee ledger, no cash receipt flow for wardens, no txn-ID/screenshot enforcement, no system receipt tied to a fee, no WhatsApp share |
| Parent panel | **Partial** | token share-link, read-only demo payload (`parentRoutes.js` serves mock data); no parent account, no live fees / complaints / notices |
| Complaints | **Partial** | `MaintenanceTicket` exists (open→resolved, host-driven); no warden review stage, no student "mark resolved", no reopen, no escalation |
| Head office view | **Missing** | no hostel-wide dashboard of seats, fees, staff, complaints |
| Staff termination notice to students + parents | **Missing** | – |

**Overall:** platform ≈ 85–90% complete; Phase 1 hostel-operations layer (this document) was ≈ 30% complete before this build.

---

## 2. Requirements (from product owner)

1. **Seats** in every block — head office sees each seat as `free`, `reserved`, `occupied`, `offline-booked` or `maintenance`.
2. **Fees** — record payment by cash or bank/wallet. Bank/wallet requires a **transaction ID or screenshot**. System generates a **receipt** (PDF, receipt number, QR verify) and a **Share on WhatsApp** button to the student.
3. **Staff / warden management** incl. **termination**. On termination, a **notice goes to all students (and their parents) of that block/hostel**: "X is terminated — do not pay or deal with this person."
4. **Parent panel** — parents log in, see their child's seat, fees/receipts, complaints, notices.
5. **Complaint flow** — student raises → warden reviews → warden fixes → **student marks resolved** (or reopens). Head office can see/escalate all.
6. **Head office** (hostel owner / group owner) has access to all of the above.

---

## 3. Build prompt (reusable — hand this to an engineer or AI agent)

> You are a senior full-stack engineer on Basera (Node 20 / Express 5 / Mongoose 9 / React 19 + Vite + Tailwind). Implement the *Hostel & Block Management* layer below without rewriting existing architecture.
>
> **Conventions (non-negotiable)**
> - Mongoose 9: pre-hooks take **no `next`**.
> - Every write route is ownership-checked server-side (`canManageHostel`, `isBlockWarden`), never role-only (IDOR class found in QA).
> - No demo/mock data in live paths. If `mongoose.connection.readyState !== 1` return `503 {demo:true}` for new modules.
> - Atomic updates for money/state transitions (`findOneAndUpdate` with guard filter).
> - Never leak contact details of other people; parents only see their own linked child.
>
> **Deliver**
> 1. `seatMapService` — derive per-seat state for block / hostel from Room, Booking, BedBlock. Endpoints: `GET /api/v1/head-office/hostels/:id/seats`, `GET /api/v1/blocks/:id/seats`.
> 2. `StaffMember` model + `/api/v1/staff` (create, list, suspend, **terminate**). Terminating: mark terminated, unassign blocks, ban linked login, create `Notice` for block/hostel, push in-app notification to every active resident and linked parent, return WhatsApp broadcast links.
> 3. `Notice` model + `GET /api/v1/notices/my` (student/parent/staff).
> 4. `FeeInvoice` + `FeePayment` + `/api/v1/fees` — invoices per student/period; payment record validation (bank/wallet ⇒ transactionId **or** screenshotUrl; cash ⇒ receivedBy); unique transactionId per hostel; atomic balance update; sequential receipt numbers; `GET /fees/payments/:id/receipt.pdf` (pdfkit + QR); `GET /fees/payments/:id/whatsapp` returns `wa.me` link + text with public verify URL.
> 5. `Complaint` model + `/api/v1/complaints` with strict state machine: `raised → under_review → in_progress → fixed → resolved`, `fixed → reopened`, `escalated` (head office). Student only: create, resolve, reopen. Warden of that block only: review/in_progress/fixed. Head office: all + escalate/assign. Full timeline.
> 6. Parent role (`parent`) + `ParentLink`; `/api/v1/parent-panel/*` (children, overview, fees, complaints, notices). Link by invite token from the student (existing `ParentAccess` token) or by head office/warden registering the parent phone.
> 7. `GET /api/v1/head-office/overview` — seats, collection vs pending, complaints by status, staff, latest notices.
> 8. UI: Head Office dashboard, Warden panel (seats, collect fee, complaints), Student (complaints, receipts, notices), Parent panel. Routes added to `App.jsx`.
> 9. Tests: unit tests for pure logic (seat state, fee validation, complaint transitions, termination notice) runnable with `node --test`, plus a live API use-case script.
>
> **Definition of done:** all use cases in §5 pass; 403 on every cross-hostel / cross-block / cross-student attempt; build and lint clean.

---

## 4. What was implemented

Everything in the prompt, plus the onboarding gaps found while building it (no way to create blocks/rooms in bulk, put rooms in blocks, or admit residents who never booked online — without these a real hostel cannot be loaded). See §6.

## 5. Use cases (acceptance)

| # | Use case | Expected |
|---|---|---|
| UC1 | Owner creates hostel → Block A with 3 rooms (2/3/4 beds) | Seat map shows 9 seats, all `free` |
| UC2 | Student books a bed | that seat → `occupied` (or `reserved` while pending) |
| UC3 | Warden marks bed offline-booked / maintenance | seat state changes; head office sees it |
| UC4 | Warden records **cash** fee | receipt no. issued, invoice balance reduced |
| UC5 | Warden records **bank** fee with no txn ID and no screenshot | 400 |
| UC6 | Same bank txn ID reused | 409 |
| UC7 | Receipt PDF + WhatsApp link | PDF 200; link `https://wa.me/<student phone>?text=…verify URL` |
| UC8 | Warden of Block B tries to collect fee / see complaints of Block A | 403 |
| UC9 | Owner terminates warden | warden login blocked; block unassigned; Notice created; every resident + parent notified |
| UC10 | Owner of another hostel tries to terminate | 403 |
| UC11 | Student raises complaint → warden review → in progress → fixed → student resolves | statuses in order, timeline complete |
| UC12 | Warden tries to mark `resolved`; student tries to mark `fixed` | 403 |
| UC13 | Student reopens a `fixed` complaint | `reopened`, visible to warden |
| UC14 | Parent logs in | sees only own child; other child → 403/404 |
| UC15 | Head office overview | seat totals = sum of block seats; fees and complaints match |

UC16–UC18 (added): bulk rooms / duplicate / foreign-block; admit resident into a free seat (login + guardian invite), same seat refused, bed count on marketplace drops; checkout frees the seat; rooms move only within the hostel.

## 6. Implementation log

### Backend (`server/`)
| Area | Files |
|---|---|
| Pure rules (unit-tested) | `services/hostelOpsRules.js` — seat state, fee validation, WhatsApp/phone helpers, receipt numbers, complaint state machine, termination notice |
| Access control | `services/hostelAccess.js` — `canManageHostel` (admin / hostel owner / group owner), `wardenBlocks` (staff-register aware: suspended or terminated ⇒ no access), `staffScope`, residents, parent links |
| Seat map | `services/seatMapService.js`; `GET /head-office/hostels/:id/seats`, `GET /blocks/:id/seats` |
| Models | `StaffMember`, `Notice`, `FeeInvoice`, `FeePayment`, `Complaint`, `ParentLink`, `Counter` |
| Head office | `routes/headOfficeRoutes.js` — hostels, seats, overview, residents list, bulk rooms, assign rooms to block, admit resident, checkout |
| Staff | `routes/staffRoutes.js` — create (optional warden login), edit, suspend, reinstate, **terminate** (atomic; revokes access; block/hostel notice; in-app push; WhatsApp broadcast list) |
| Fees | `routes/feeRoutes.js` — invoices (single/bulk), payments (cash / bank / JazzCash / Easypaisa / cheque with txn-ID-or-screenshot rule, unique txn per hostel, atomic balance), void, receipt PDF with QR, `POST /payments/:id/whatsapp` (wa.me link), public `GET /fees/verify/:receiptNo` |
| Complaints | `routes/complaintRoutes.js` — raise (auto-routed to the student's block), strict transitions, rating, reopen, escalate |
| Notices | `routes/noticeRoutes.js` |
| Parents | `routes/parentPanelRoutes.js` — staff invite codes, claim (code or student share token), children, overview; new `parent` role |
| Wiring | `server.js` mounts; `models/User.js` + `authRoutes.js` (parent role, banned accounts blocked at login); `middleware/auth.js` (banned users rejected on every request); `middleware/requireDb.js` |

### Second pass (2026-11-01) — spec conformance + hardening
| Change | Why |
|---|---|
| Escalation (`→ escalated`) and `assignedTo` are **head office only**; wardens only review / start / fix | Spec §3.5 ("escalated (head office)", "Warden … only: review/in_progress/fixed"). First pass let wardens escalate. |
| New `recordScope` in `services/hostelAccess.js`: a warden acts on a single invoice / payment / complaint / resident only if it sits in a block they run; block-less records (room not in any block) are head office only | `staffScope` without a block id fell back to hostel-level access, so any warden of the hostel could collect fees / move complaints / issue parent invites for residents of unassigned rooms |
| Parent-link revoke by staff now needs the student's current block (warden) or head office | was hostel-level for any warden |
| `GET /fees/payments/:id/whatsapp` added (POST kept); voided receipts can't be shared | spec names GET |
| `GET /head-office/overview[?hostelId=]` — rollup of all managed hostels (totals, per-hostel rows, latest notices; first 50 hostels) | spec §3.7 named this route; only `/hostels/:id/overview` existed |
| `GET /parent-panel/children/:studentId/fees|complaints|notices` | spec §3.6 lists them; only `children` and `overview` existed |
| `POST /notices` rejects a `blockId` that isn't in `hostelId`; `POST /staff` tolerates a non-array `blockIds` | input hardening |
| UI: warden no longer sees "Escalate"; head office overview shows an "All hostels" strip when >1 hostel; WhatsApp share uses GET; `useLoad` moved to `opsHelpers.js` | lint (fast refresh / compiler rules) + spec |
| Client lint made clean repo-wide: real fixes for unused vars and `Date.now` in WardenDashboard; 6 pre-existing `set-state-in-effect` load-on-mount effects in unrelated pages carry a targeted disable comment (behaviour unchanged, refactor still open) | DoD "lint clean" |

### Security fixes made along the way
- Any host could place/release seat holds on **any** room (role-only check) → now ownership-checked (`guardRoomBeds`).
- Any host/warden could list **any** hostel's blocks and warden names via `?hostelId=` → now scoped.
- Suspended/terminated wardens kept access through the older block/room routes → now staff-register aware.
- Signup screen offered an "Admin" button that could never work → replaced by "Parent".
- Banned accounts could keep using an unexpired token → rejected on every request.

### Frontend (`client/src/pages/ops/`)
`HostelOpsConsole.jsx` (Head Office at `/head-office`, Warden at `/warden/operations`), `StudentHostelLife.jsx` (`/dashboard/student/hostel`), `ParentPanelPage.jsx` (`/parent-panel`), shared `opsUi.jsx`. Links added from the Host dashboard and Warden dashboard.

### Tests
- `server/tests/hostelOpsRules.test.js` — 28 unit tests, no database needed (`npm test`).
- `server/scripts/hostelOpsUseCases.js` — 76 live checks covering UC1–UC18 (`npm run usecases:hostel`). Needs `BASE_URL` and `MONGO_URI` of the same database; creates and deletes `[QA-HOPS]` data only.

## 7. Verification status — read this

**Executed 2026-11-01** on Windows / Node 22, API started with `RATE_LIMIT_DISABLED=true` against a throwaway MongoDB 7.0.14 (mongodb-memory-server):

| Check | Result |
|---|---|
| `cd server && npm test` (incl. 28 hostel-ops unit tests) | 41/41 pass |
| `npm run usecases:hostel` — UC1–UC18 + cross-hostel / cross-block / cross-student 403 sweep | **90/90 pass**, `[QA-HOPS]` data cleaned up |
| `cd client && npm run lint` | 0 problems |
| `cd client && npm run build` | success |

Not yet done: clicking through the four UIs in a browser, and a run against **staging** (Atlas) — do both before onboarding a hostel:
```
BASE_URL=https://<staging-api> MONGO_URI=<staging db> npm run usecases:hostel   # staging API must also run with RATE_LIMIT_DISABLED=true, or the script waits out the auth limiter
```

## 8. Known limits (honest list)
1. **Screenshots need Cloudinary** (`CLOUDINARY_*`). Without it the upload returns a placeholder and the server refuses it as proof — staff must enter a transaction ID instead.
2. **No SMS/OTP** — parent access works by one-time invite code, not by phone ownership. WhatsApp sharing uses `wa.me` deep links (staff taps Send); it is not an automated WhatsApp Business API broadcast.
3. Termination notices reach **residents** (confirmed/active/overdue stays). Students whose booking is still pending/reserved are not in the audience.
4. Receipt numbers can skip a number when a payment is rejected after allocation (e.g. reused transaction ID). Numbers are never reused.
5. New modules return **503 without a live database** (deliberate; no demo fallback for money flows).
6. `COMMISSION_RATE_DEFAULT` on Railway is still `0.07` (must be `7`) — platform bookings only, unrelated to hostel fee collection, but fix before launch.
7. Fee collection here records money received by the hostel; it does not move money. No gateway is involved, by design.
8. Late fees, automated monthly invoice generation and rent reminders for these invoices are not built (bulk "Bill all residents" is manual per period).

## 9. Readiness verdict
Feature-complete for the Phase 1 scope; API proven green locally (§7). Remaining before go-live: browser walkthrough + staging run. After that: pilot with one real hostel (admit residents, bill one month, collect, issue receipts, raise/resolve a complaint, invite 2–3 parents) before opening to more.
