# Prompt for Claude Code — Use-Case Execution & QA of Phase 2 (on your device, with Chrome)

*Paste everything below the line into Claude Code on your own machine, with the **Claude in Chrome** extension connected and the repo at `E:\basera`. Run it after the implementation prompt (`06-…`) has been completed.*

---

# ====== PROMPT STARTS ======

You are a senior QA engineer + fixer. Test the Basera hostel-management SaaS end to end **as real users would, in the real browser**, find bugs, fix them, and prove the fixes. Features under test: per-hostel/per-block policies, offline-registered students, leave notice, late fines + waiver, offers/discounts, plus the Phase 1 base (seats, fees/receipts, staff termination, parents, complaints, head office) and the Phase 2 extras (notifications, visitors, reports, expenses, transfers, tenancy).

## 0. Ground rules
1. **Local/staging only. Never test against production data.** Use a throw-away database (`MONGO_URI` pointing to a disposable DB) and run the API locally (`cd server && npm run dev`) and the client (`cd client && npm run dev`).
2. Synthetic data only: names/emails prefixed `[QA]` / `qa.*@example.test`. No real phone numbers, no real payment credentials, no real WhatsApp sends — open `wa.me` links but do not press Send.
3. Don't print passwords, tokens or secrets in the report. Generate passwords at runtime.
4. Use **Claude in Chrome** for UI testing (load its tools in one ToolSearch call; check existing tabs first; open a new tab for the app). Use a separate Chrome profile/incognito context per role if tokens collide, or log out between roles.
5. Never "fix" a test by weakening a check. A failure is a bug in the product or a wrong expectation — decide which, with evidence.
6. Stop and ask me before any destructive action outside the throw-away DB, or if a step needs real credentials.
7. Keep a running log `docs/QA-Phase2-Log.md`: step, expected, actual, PASS/FAIL, screenshot name, bug id.

## 1. Setup (do first, report result)
1. `cd server && npm install && npm test` — all unit tests must pass. Record the count.
2. `npm run usecases:hostel` (Phase 1) and the Phase 2 use-case script — record pass/fail.
3. `cd client && npm run lint && npm run build` — must pass.
4. Start API + client. Confirm `/api/v1/health` shows `database: mongodb`.
5. Enable time travel for the session: set `CLOCK_OFFSET_DAYS` (or call the admin dev-clock endpoint). Confirm the app's "today" changes. **If there is no clock control, that's Bug #1 — build it before continuing**, otherwise the fine and notice tests are impossible.
6. Seed (through the UI wherever possible, API where faster) — two **separate** hostels to test isolation:
   - **Hostel A** (owner A): Block A (3 rooms × 2 seats), Block B (2 rooms × 3 seats); warden A (Block A), warden B (Block B).
   - **Hostel B** (owner B): Block X (2 rooms × 2 seats), warden X.
   - Students: 2 **online** (booked through the marketplace flow) and 3 **offline** (registered by head office / warden / CSV), parents for two of them.

## 2. Test matrix — run every case, in the browser, as the stated role
Record each as PASS/FAIL with the actual value seen.

### 2.1 Policies (head office)
| # | Steps | Expected |
|---|---|---|
| P1 | Open Policies. Defaults shown | notice 30 days, due 5th, fine PKR 100/day, shown as "platform default" |
| P2 | Set hostel notice to 45 days; set Block B override to 15 days | Preview text updates; Block A resolves to 45 (source: hostel), Block B to 15 (source: block) |
| P3 | Warden A opens policy | Read-only, effective values only; no edit controls; API write → 403 |
| P4 | Owner B tries to edit Hostel A policy (URL/API) | 403 |
| P5 | Invalid values (-1 days, fine 0.5, due day 40) | Rejected with clear messages |
| P6 | Change fine to 150/day after an invoice exists | Existing invoice keeps 100 (snapshot); new invoices use 150 |

### 2.2 Offline students are first-class
| # | Steps | Expected |
|---|---|---|
| O1 | Head office registers an offline student with full profile + CNIC upload + deposit collected | Seat becomes occupied; deposit invoice + receipt exist; commission 0; no escrow |
| O2 | Warden A registers a student into Block A / tries Block B | Block A OK; Block B refused (403) |
| O3 | Same seat twice / same phone twice | Second refused with clear message |
| O4 | CSV import: a file with 10 rows (2 invalid, 1 duplicate phone) | Error table lists exactly the bad rows; nothing imported until corrected; corrected file imports all valid rows; counts match; re-importing the same file reports duplicates, creates none |
| O5 | Offline student receives invoice → pays cash → receipt → WhatsApp link | Identical behaviour to an online student |
| O6 | Invite the offline student to log in (code/link), student claims it | History (invoices, receipts) preserved; login works; before claiming, the student still appears in every list/report |
| O7 | Offline vs online student side by side: fees, fines, complaints, leave, offers, notices, parent link, reports | No feature works for one and not the other (list any difference as a bug) |

### 2.3 Late fines (use time travel; default 5th / PKR 100 per day)
Create a rent invoice of PKR 8,000 due the **5th** of the current month (Student S1). Then:
| # | "Today" | Expected fine | Expected total due |
|---|---|---|---|
| F1 | 4th | 0 | 8,000 |
| F2 | 5th | 0 | 8,000 |
| F3 | 6th | 100 | 8,100 |
| F4 | 10th | 500 | 8,500 |
| F5 | 10th, pay rent in full | fine frozen at 500; it must **not** keep growing on the 11th/12th | fine still owed (unless waived) |
| F6 | Set cap 300 → 10th | 300 | 8,300 |
| F7 | Invoice created on the 20th (late admission) | No back-dated fine; due date rule per design note | as documented |
| F8 | Pay a partial amount on the 7th | Allocation follows policy (rent first by default); balances correct to the rupee | |
| F9 | Run the daily job twice, then skip two days and run once | Same totals; idempotent; self-heals | |
| F10 | Observe at 23:30 and 00:30 Karachi time (use the clock) | Day rolls over at Karachi midnight, not UTC | |
Also check: student's screen, parent's screen, warden's screen, receipt PDF, and head-office report all show the **same** fine.

### 2.4 Fine waiver
| # | Steps | Expected |
|---|---|---|
| W1 | S1 (fine 500) requests waiver with reason | Pending request; shown in head-office queue with age/amount |
| W2 | Second request on same invoice | Refused (one pending) |
| W3 | Warden recommends; tries to approve | Recommend OK; approve → 403 |
| W4 | Head office approves PKR 300 (partial) | fineWaived 300, fine due 200; student + parent notified; audit entry |
| W5 | Approve again / approve 9,999 | 409 / clamped or rejected; never exceeds accrued |
| W6 | Reject another with note | Status rejected; student sees note; may re-request only per rules |
| W7 | Owner B attempts to decide Hostel A's request | 403 |
| W8 | Proactive waiver by head office | Works, reason mandatory, audited |
| W9 | Student cancels a pending request | Cancelled; can't be approved afterwards |

### 2.5 Leave notice (policy: Block A 45 days, Block B 15 days)
| # | Steps | Expected |
|---|---|---|
| L1 | Block A student submits leave exactly 45 days ahead | Compliant, status submitted |
| L2 | Same with 44 days | Behaviour per `shortNoticeAction`: block → refused showing earliest date; flag → accepted + flagged; charge → accepted + charge line of exactly `shortNoticeChargeDays × rent/30` rounded |
| L3 | Block B student, 16 days ahead | Compliant (block override) |
| L4 | Past date / date before join date | Rejected |
| L5 | Second open notice for same stay | Rejected |
| L6 | Withdraw before approval | Status withdrawn; seat unchanged |
| L7 | Head office approves | Seat map shows **leaving on <date>**, still occupied; "available from" visible; parent sees notice read-only |
| L8 | Warden of the *other* block tries to decide | 403 |
| L9 | Change policy after submission | The notice keeps its snapshot days |
| L10 | Move clock to leave date; try checkout with unpaid rent | Blocked with list of dues |
| L11 | Clear dues (pay/waive), add a damage deduction, checkout | Settlement = deposit − dues − damages exact; seat free; bed back on marketplace; checking out twice → 409 |
| L12 | Reminders at 7 days and 1 day before | In-app notification present for student/parent/warden |
| L13 | Offline student does L1–L11 | Identical |

### 2.6 Offers & discounts
| # | Steps | Expected |
|---|---|---|
| D1 | Create "Early pay 2% if paid by the 3rd" (block A, active, valid this month) | Listed active |
| D2 | S1 pays on the 2nd | Invoice shows explicit negative line −160; receipt PDF shows it; total paid correct |
| D3 | Same offer, S1 pays on the 4th | Not applied |
| D4 | Late invoice (after the 5th) | Early-payment offer not applied; fine not discounted |
| D5 | Coupon code with max 2 redemptions, 3 students race | Exactly 2 succeed; third gets a clear message; no double redemption on double-click |
| D6 | Non-stackable vs stackable pair | Best valid combination only |
| D7 | Expiry end date boundary (inclusive) and paused offer | Behaves as documented |
| D8 | Discount larger than the line | Capped at the line; never negative invoice |
| D9 | Void the payment that used a discount | Redemption reversed, counters restored, audit |
| D10 | Offer scoped to Block A used by Block B student / by Hostel B | Not eligible / invisible |
| D11 | Manual scholarship needing approval | Pending until head office approves; then applied once |
| D12 | Student "Offers for you" page and head-office usage counters | Match D2–D11 exactly |

### 2.7 Phase 1 regression (must still pass)
Seat map colours/counts; cash and bank payments (txn-ID-or-screenshot rule, duplicate txn → 409, overpay → 400); receipt PDF + QR verify page; WhatsApp link; staff suspend/terminate (notice reaches that block's students + parents only; terminated warden locked out immediately, even with an old token); parent invite-code flow; complaint flow (only the student can resolve; reopen); head-office overview totals; **cross-tenant 403s** on every endpoint family.

### 2.8 Phase 2 extras
Notification centre (each event produces the expected in-app/email/wa.me output, no duplicates); visitor log (pre-register, approve/deny, in/out, hours policy, parent view); reports (totals reconcile with underlying records to the rupee; CSV opens correctly in Excel; warden sees own block only); expenses & profit; seat transfer (atomic, fee plan carried); onboarding wizard from an empty hostel; branding on receipts; export-all; plan limits (soft message, no data loss).

## 3. Cross-cutting checks (run on every page you touch)
- **Security:** try each action with a different role, a different hostel's owner, an expired/old token, and a banned user; confirm 401/403 and that no data from another tenant appears in lists, counts, search, exports or PDFs. Try ID-guessing in URLs.
- **Money integrity:** after each money test, recompute by hand: invoice amount − discounts + fine − waived − paid = balance; sum of receipts = collections report.
- **Concurrency:** double-click submit, two tabs approving the same request, two payments on the same invoice.
- **UI/UX:** 375 px mobile width, keyboard-only navigation, empty states, loading and error states, long names, Urdu/English toggle where present, browser console errors (read console in Chrome — zero uncaught errors), failed network calls (read network log).
- **Performance sanity:** a hostel with 300 students / 1,000 invoices: lists paginate, pages load in < 2 s locally.

## 4. Bug-fix loop (for every FAIL)
1. Reproduce twice; capture steps, expected vs actual, screenshot, console/network evidence.
2. Find the root cause in code (not the symptom). Check whether the same bug class exists elsewhere (grep) and fix those too.
3. Fix minimally, keeping architecture and the Phase 1/2 rules (tenant checks, integer money, single clock, atomic updates, audit).
4. Add a **regression test** (unit test for rules; use-case script check for endpoints).
5. Re-run the failing case **and** the surrounding suite (`npm test`, use-case scripts, lint, build) — all must be green.
6. Log it in `docs/QA-Phase2-Log.md`: id, severity (Critical = data leak/money wrong/lockout; High; Medium; Low), root cause, fix, files, test added.
Continue until a full pass of §2 has **zero Critical/High failures**. Medium/Low may remain only if listed with justification.

## 5. Final report (deliver in chat and as `docs/QA-Phase2-Report.md`)
1. Verdict: **Ready / Ready with conditions / Not ready**, in one sentence.
2. Table: section → cases run → passed → failed → fixed.
3. Bugs found & fixed (id, severity, one-line cause); bugs open (with why).
4. Evidence list (screenshots, test counts, command outputs) — only things you actually ran.
5. **Not tested** list with reason and what is needed (e.g. real WhatsApp/email delivery, real gateway, multi-device, load test).
6. Assumptions you made on ambiguous rules (fine start day, short-notice action, allocation order) so I can confirm or change them.
7. Remaining risks and recommended pilot steps.

# ====== PROMPT ENDS ======
