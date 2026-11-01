# QA report — Phase 2 hostel-management SaaS

*Run on 2026-11-01 (business dates moved from Nov 2026 to Mar 2027 with the dev clock) on Windows 11 / Node 22. Running log with every case: `QA-Phase2-Log.md`.*

## 1. Verdict
**Ready with conditions.** All §2 cases pass with zero Critical or High defects. Nine Medium/Low defects were found and fixed. Two Low items are open: unpaged lists for lower-volume data (QA-10) and English-only ops screens (QA-11). Real WhatsApp/email delivery, staging and a multi-user load test are still untested.

## 2. Environment and how it was tested
- **Browser:** a real **Google Chrome** (installed), driven by `playwright-core`. Claude in Chrome was **not connected** in this session, so it was not used. Each role ran in its own browser context, with that role's token in `localStorage` the way the app stores it. The login form itself was tested separately (AUTH1, AUTH2, SEC1). The harness collected screenshots (150), console errors, uncaught exceptions, failed requests and 5xx responses.
- **Data:** a throwaway in-memory MongoDB 7, with the API (development mode, `RATE_LIMIT_DISABLED`, `CRON_SECRET`) and the Vite dev client running locally. Only synthetic `[QA]` / `qa.*@example.test` data was used. `wa.me` links were opened and nothing was sent.
- **Seed (§1.6):**
  - Hostel A (owner A): Block A with 3 rooms × 2 seats and Block B with 2 rooms × 3 seats, plus 2 more Block B rooms created through the Setup tab; warden A on Block A, warden B on Block B.
  - Hostel B (owner B): Block X with 2 rooms × 2 seats; warden X.
  - Students: two **online** students went through the real marketplace flow (student booking → owner confirms). Offline students were registered through the head-office form (O1), the warden form (W1) and a 10-row CSV (9 imported).
  - Parents: three, two of them linked through the UI or invite codes.
- **Cases marked "via api" or "via db"** cover what a browser cannot reach directly: simultaneous requests, cross-tenant probes, notification and audit rows, and booking commission fields.

## 3. Setup results (§1)
| Step | Result |
|---|---|
| `cd server && npm install && npm test` | 91 / 91 unit tests pass |
| `npm run usecases:hostel` (Phase 1) | 90 / 90 |
| `npm run usecases:phase2` | 120 / 120 (includes the new O6i check) |
| `cd client && npm run lint && npm run build` | lint 0 problems · build OK |
| API + client up, `/api/v1/health` | `database: mongodb` |
| Time travel | admin `POST /api/v1/dev/clock` moved "today" (Nov 2026 → Mar 2027); 404 in production by design |

## 4. Results by section
| Section | Cases run | Passed | Failed | Fixed during QA |
|---|---|---|---|---|
| 2.0 Login, navigation, console errors | 7 | 7 | 0 | — |
| 2.1 Policies | 6 | 6 | 0 | QA-02, QA-03, QA-04, QA-05 |
| 2.2 Offline students | 15 | 15 | 0 | QA-06, QA-08 |
| 2.3 Late fines | 14 | 14 | 0 | — |
| 2.4 Fine waiver | 9 | 9 | 0 | — |
| 2.5 Leave notice | 19 | 19 | 0 | QA-07 |
| 2.6 Offers & discounts | 14 | 14 | 0 | — |
| 2.7 Phase 1 regression | 6 + 90 script checks | all | 0 | — |
| 2.8 Phase 2 extras | 7 | 7 | 0 | — |
| 3 Cross-cutting (375 px, keyboard, Urdu, performance) | 4 + 67 page views at two widths | 3 + 67 | 1 (I18N1, open) | QA-01, QA-09 |
| **Total** | **101 cases + 210 script checks + 67 page views** | **100 + 210 + 67** | **1 open (Low)** | **9 fixed** |

Key numbers seen in the browser:
- **Fines on S1's screen:** 0 on the 4th and 5th → 100 on the 6th (8,100; tomorrow 8,200) → 500 on the 10th. After rent was paid it stayed at 500 on the 12th.
- **Same 500 fine everywhere:** the student, parent and warden screens, the receipt PDF and the outstanding report all showed 500.
- **Karachi midnight:** 1,000 at 23:30 PKT → 1,100 at 00:30 PKT.
- **Early-pay discount:** shown as an explicit −PKR 160 line on the invoice and on the receipt PDF.
- **Checkout settlements matched to the rupee:** deposit − 1,500 damage for S1, and deposit 10,000 − fine − 1,000 for O1.

## 5. Bugs
### Found and fixed
| ID | Severity | Cause (one line) |
|---|---|---|
| QA-01 | Medium | At 375 px the head-office Overview was 565 px wide: grid items kept `min-width:auto`, so the scroll wrapper around wide tables never engaged (every ops panel). |
| QA-04 | Medium | Saving hostel defaults sent every field, which quietly pinned all of them to "hostel" and stopped platform defaults from flowing through. |
| QA-08 | Medium | Importing 300 residents took 224 s in one request: each login-less resident's throwaway password was hashed with bcrypt cost 12 (about 1 s each). Now about 20 s. |
| QA-09 | Medium | Invoice and receipt lists were hard-capped (500 / 200) with no paging: 400 of 900 invoices could not be reached on the Fees tab. |
| QA-02 | Low | Validation errors showed only the first message (1 of 3 on P5). |
| QA-03 | Low | The policy "Saved" confirmation disappeared because the form remounts after a save. |
| QA-05 | Low | Success messages used the coral brand accent and looked like errors. |
| QA-06 | Low | After a CSV import, re-selecting the same file did nothing; "Check file" stayed disabled. |
| QA-07 | Low | Wardens saw a Leave "Decide" button that always 403'd when the policy keeps decisions with head office. |

Each fix has a regression check: browser cases P2, P5, O4c, L8-UI and PERF2, live-script check O6i, and the 375 px smoke run. Root causes, files and checks are in `QA-Phase2-Log.md`.

### Open
| ID | Severity | Why it is open |
|---|---|---|
| QA-10 | Low | Complaints, waivers, leave, visitors, redemptions and parent-link lists still stop at 300 rows. Open items normally stay well below that, and the same paging pattern applies when needed. |
| QA-11 | Low | Hostel-ops screens are English-only and have no Urdu toggle. Translating about 20 screens is feature work, and which roles need Urdu is a product decision. |

### Harness mistakes (not product bugs) found and corrected during the run
- A login selector clicked the header button instead of the form's submit.
- `localhost` matched a "host" URL check.
- A fixed wait raced a 9-row CSV commit.
- `wa.me` redirects to `api.whatsapp.com`, which a check didn't accept.
- Text splitting picked the warden's dropdown instead of the invoice card.
- A mixed-case email didn't match the stored lowercase one in the perf setup.
- L10 first used a resident whose approved leave date was still in the future.

Each case was re-run (or re-read on screen) after the correction.

## 6. Evidence (only what was run)
- Command output: unit tests 91/91; live suites 90/90 and 120/120; lint exit 0; build OK.
- 101 logged cases with expected / actual / verdict / screenshot name (`QA-Phase2-Log.md`).
- 150 screenshots (desktop and 375 px) in the QA scratchpad folder, not committed (they contain synthetic data only).
- Browser smoke after all fixes: 67 page/tab views across head office, warden, student, parent and `/claim` at 1280 and 375 px, with horizontal overflow 0 and **zero** console errors, uncaught exceptions or 5xx.
- Performance at 300 residents / 900 invoices:
  - CSV import: 19.7 s (was 224 s)
  - Fees tab: 1.53 s, showing the first page of 100 (was 2.58 s with a 500-row cap)
  - Residents: 1.45 s
  - Seats: 0.91 s
  - Outstanding report: 0.34 s

## 7. Not tested
| Area | Why / what's needed |
|---|---|
| Real WhatsApp and email delivery | No WhatsApp Business API by design (`wa.me` links only); no SMTP configured. Needs a staging SMTP account and a manual send. |
| CNIC / photo / screenshot uploads | No Cloudinary in this environment; the UI correctly says the file was not saved (O1u). Needs `CLOUDINARY_*` on staging. |
| Real payment gateways | Out of scope (hostel fees record money received; they don't move it). |
| Multi-user load and multiple API instances | One local instance only. Needs a staging load test; note the runtime clock offset is per process. |
| Staging / Atlas | Run both live scripts against staging before pilot. |
| Dark mode and assistive-technology screen readers | Not covered in this pass. Keyboard-only use of the console was checked (KBD1). |

## 8. Assumptions on ambiguous rules (please confirm)
- **Late admission:** fines on an invoice issued after its due date start the day after issue (no back-dating) — F7.
- **Grace days** are free days after the due date.
- **Rent paid in full** freezes the fine; that day still counts (rent paid on the 10th → 500).
- **Default short-notice action** is flag only. "Block" and "charge" were both verified (charge = days × rent / 30, rounded).
- **Payments** clear rent first.
- **Early-payment discounts** apply only when the payment clears the whole remaining rent, never on a late invoice; fines are never discounted.
- **Approving more than the fine** that can still be waived is **rejected** (400), not reduced to fit.
- **With an approved leave notice**, checkout before the leave date asks for confirmation (early); unpaid rent always blocks checkout.
- **Plan limits** block adding seats (402 with an upgrade message), never admissions into existing seats.

## 9. Remaining risks and pilot steps
1. **Before the pilot:**
   - Run `npm run usecases:hostel` and `npm run usecases:phase2` against staging.
   - Configure Cloudinary and SMTP, then send one real receipt email and test one CNIC upload.
2. **Pilot with one hostel:**
   - Import its residents by CSV in batches of 100 or fewer.
   - Bill one month and collect cash and bank payments.
   - Let one fine accrue and waive part of it.
   - Process one leave notice through to checkout.
   - Invite 2–3 parents.
3. **Watch:** list sizes (QA-10) and import duration; schedule the Railway cron for `/jobs/daily` (see `06b`).
4. **Decide** on Urdu for the student/parent screens (QA-11) and confirm the assumptions in §8.
