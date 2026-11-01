# Basera — Project Understanding

*Written 26 October 2026 from a full read of this repository (`server/`, `client/`, `app/`, `docs/` and the root audit files). This explains what Basera is, who uses it and how each role works. It deliberately skips the improvement backlog.*

---

## 1. Basera in one paragraph

Basera (Urdu for "nest, shelter, abode") is a **trust-first accommodation marketplace and hostel management platform for Pakistan**. Students and young professionals moving to a new city find verified hostels, PGs and rooms near their university or office. They see who they would be living with and book online. Their rent sits in **escrow until they have actually moved in**. Hosts get a full back office: inventory, beds, tenants, rent, maintenance, pricing, finance, wardens and multi-branch brands. Basera staff verify listings, hold the money and resolve disputes. A second vertical, **Stays**, reuses the same trust layer for nightly hotel and guest-house bookings.

**Tagline:** *Find your Basera.*

---

## 2. The core idea: what problem it solves

Housing for newcomers in Pakistan is found informally: WhatsApp and Facebook groups, OLX/Zameen ads, brokers and word of mouth. That creates five failures, and Basera has a mechanism for each:

| Stage | What goes wrong informally | Basera's mechanism |
|---|---|---|
| 1. Search | Listings scattered, no comparison | One marketplace with map search, filters, recommendations |
| 2. Judge | Photos can't be trusted, no real reviews | Verification tiers, field verification visits, listing quality score, verified-stay reviews, roommate visibility, Hostel DNA score |
| 3. Pay, book | Advance money to strangers, fake ads | **Escrow**, contact gating, chat/listing leak filters, duplicate-photo detection, off-platform report flow |
| 4. Live there | Conditions not as advertised | Check-in verification, move-in checklist, maintenance tickets with SLA, mess-menu ratings, safety incidents |
| 5. Resolve | Deposit kept, sudden eviction, no recourse | Deposit case workflow, disputes, admin resolution, AI dispute summary, PDF evidence trail |

The differentiator is **"trust made concrete"**: badges that mean something, money protected until move-in, contact hidden until commitment, and the ability to see the *type* of person already living in a shared room (category only, never name or contact).

---

## 3. Stakeholders

| Stakeholder | Type | What they want from Basera |
|---|---|---|
| Student / young professional (seeker, tenant) | Primary user | A safe, affordable, honest room fast, with protected money |
| Independent host / landlord / PG operator | Primary user (supply) | Fill beds, get paid reliably, run the property with less admin |
| Hostel group owner | Supply (B2B) | One verified brand across many branches |
| Warden | Operational staff of a host | Run one block day to day |
| Hotel / guest-house owner | Supply (Stays vertical) | Nightly bookings with the same trust layer |
| Basera admin (trust, finance, operations) | Internal | Keep the marketplace honest and the money reconciled |
| Finance officer, property manager | Internal or host-side (roles exist in the schema, no dedicated dashboard yet) | Scoped finance or management access |
| Parent / guardian | External, no login | Reassurance about the child's housing |
| Campus ambassador | Community partner | Referral rewards for bringing students and hosts |
| Vendors | Partner | Sell services (food, laundry and so on) to residents via the vendor marketplace |
| API partners | B2B | Pull Basera data through the API marketplace |
| Payment gateways (JazzCash, Easypaisa, Stripe), Cloudinary, Google Vision, Anthropic Claude, OSM/OSRM | Integrations | Money movement, media, OCR, AI, maps |
| Universities, regulators (CDA, ICT administration, HEC) | Ecosystem | Safer off-campus housing; data on the market |

---

## 4. Roles in the code

Roles live in `server/models/User.js` (`role` enum) and are enforced by `server/middleware/auth.js` (`protect`, `authorize`, role aliases).

| Role value | Canonical as | Dashboard | Demo login |
|---|---|---|---|
| `student` | student | `/dashboard/student/*` | `student@basera.pk` |
| `host` (+ legacy `owner`, `landlord`) | host | `/host/dashboard`, `/owner/dashboard`, `/host/stays` | `landlord@basera.pk`, `owner@basera.pk` |
| `warden` | warden (block-scoped, enforced server-side) | `/warden/dashboard` | `warden@basera.pk` |
| `admin` | admin | `/admin` | `admin@basera.pk` |
| `finance` (+ `finance_officer`) | finance | none yet | — |
| `property_manager` | property_manager | none yet | — |
| Parent / guardian | not a user role: token link | `/parent/:token` | share link from a student |

All demo accounts use `password123`. Host trust is graded by `hostProfile.verificationTier`: `unverified → id_verified → property_verified → superhost`.

---

## 5. How each role works

### 5.1 Student / young professional
1. **Discover.** Search hostels (`/hostels`), rooms (`/rooms`, map view with bbox, polygon and radius search), and city comparison. Map layers cover affordability, commute isochrones to campus, safety confidence, demand pulse and points of interest with rickshaw fares.
2. **Decide.** The room detail shows verification, DNA score, the roommate panel ("1 working professional, maths teacher, quiet"), vacancy forecast, match score, a budget planner and a rent negotiation offer. The Decision Lab adds a match quiz, comparison board, cost estimator, roommate score, shortlist sharing, a parent share link and a visit scheduler.
3. **Book and pay.** Booking flow with token payment, an optional deposit-protection add-on and a refund preview. Money goes to escrow (`escrowService.js`). Host contact stays hidden until a paid, confirmed booking (`contactGatingService.js`). Manual challan with proof upload works where no gateway exists.
4. **Move in.** A QR move-in pass, check-in verification, move-in checklist, digital tenancy agreement signing and a packing checklist PDF.
5. **Live.** Rent payments and reminders, a wallet, utility bill split, maintenance tickets, mess-menu ratings, community feed, polls, marketplace, lost and found, study sessions, activities, roommate swipe matching and the AI concierge.
6. **Resolve.** Disputes, deposit accept or dispute, off-platform payment reports (which block escrow release), safety incidents and alert acknowledgements.
7. **Earn.** Referral loyalty points become discount coupons after admin approval. A student trust score is built from payments, disputes, profile and completion.

### 5.2 Independent host / landlord / PG operator
1. **Onboard.** Lister onboarding: CNIC and property proof uploads (OCR-capable), host agreement signature, acceptance of the off-platform payment policy, payout method (JazzCash, Easypaisa or bank).
2. **List.** Hostels, rooms and beds with photos, amenities, rules, gender policy and map pin. An AI listing description is generated in English and Urdu. Listing text is checked for contact leaks, and photos are checked for duplicates (`imageHashService.js`).
3. **Operate.** Booking requests, tenants and a tenant CRM, bed holds and repair blocks, "Booked (Offline)" seat overrides, maintenance SLA board, mess menu, rent offers (accept, counter or decline), reply templates and chat.
4. **Grow.** Growth Center with a growth coach, smart pricing (occupancy, comparable rooms and academic-calendar seasonality, explained in plain language), occupancy heat calendar, bulk editor, reputation score and map stories.
5. **Get paid.** Payout after move-in plus a 48-hour hold if no dispute. Ledger, statements, P&L and cash-flow forecast, report-card certificate.
6. **Subscribe.** SaaS tiers (Starter, Pro, Premium) with a monthly management fee.

### 5.3 Hostel group owner
Everything a host can do, plus creating a `HostelGroup` brand (for example "Royal Group of Hostels"), attaching branches and getting a group page. Searching the brand surfaces every branch.

### 5.4 Warden
Sees and manages **only the assigned block** (`Block` model, enforced in `blockRoutes.js` and bed-block routes). Marks beds "Booked (Offline)" with a reason, and releases them. Hosts and admins can open the warden view for oversight.

### 5.5 Hotel / guest-house owner (Stays)
Uses the host login at `/host/stays`. Lists `Property` records with nightly rates. Guests book date ranges (`StayBooking`). Guest contact is shared at booking, a deliberate difference from the long-stay flow.

### 5.6 Admin: trust, finance and operations
- **Trust.** Verification queue (KYC with OCR), field-verification visit planner and checklist, listing quality scores, review moderation with the AI review classifier and explanations, safety incident timeline, policy rules, host risk queue, city scorecard.
- **Money.** Finance command room, double-entry ledger and reconciliation, escrow waterfall, payout approval room (high-value payouts need review), deposit liability register, refunds, host statements, revenue forecast, AI finance-anomaly detector, webhook duplicate checks.
- **Disputes.** Dispute queue with the AI dispute summary, then a human decision and a resolution PDF.
- **Growth and platform.** Manual payment review, host subscription invoices, vendor orders, ambassador approvals, global alerts (student and host submissions need approval), loyalty claims, discounts, academic calendar, API marketplace partners, job logs, platform settings.

### 5.7 Parent / guardian
Opens a share link created by the student. It shows a read-only safety and status summary in English or Urdu, plus check-in requests and visit information. The parent can't message the host or change anything.

---

## 6. The money flow (escrow)

```
Student pays: rent + security deposit + service fee (PKR 400) [+ deposit protection 3%, capped PKR 2,000] − discounts
        │
        ▼
 EscrowTransaction (HELD) ──► dispute or off-platform report? ──► BLOCKED until admin resolves
        │ no
        ▼ move-in + ESCROW_HOLD_HOURS (48h)
 RELEASED: commission (5–10% of rent by duration and amount) to Basera, payout to host
 Security deposit tracked separately, no commission; refunded or deducted through DepositCase
```

Every event lands in the double-entry `LedgerEntry`. The daily cron (`POST /reminders/daily`) runs reminders, late fees and escrow release.

---

## 7. Architecture and stack

| Layer | Technology | Where |
|---|---|---|
| Web app | React 19, Vite, Tailwind, Zustand, React Router 7, Framer Motion, Leaflet, Recharts, i18next (EN/Urdu, RTL) | `client/` (PWA) |
| Mobile app | Expo / React Native, written but not yet built or published | `app/` |
| API | Node.js 20+, Express 5, Mongoose 9, JWT, Socket.io, PDFKit and QR codes, Zod and express-validator, Helmet, rate limits, NodeCache | `server/` (60+ route modules under `/api/v1`) |
| Database | MongoDB Atlas, about 90 models | `server/models/` |
| AI | Anthropic Claude via `services/aiService.js`, env-gated (`CLAUDE_API_KEY`), template fallback | concierge, listing text, finance anomaly, dispute summary, review classifier |
| Payments | JazzCash, Easypaisa, Stripe (shells ready for live credentials), manual challans | `paymentRoutes.js`, `manualPaymentRoutes.js` |
| Media and OCR | Cloudinary; Google Vision OCR, env-gated | `uploadRoutes.js`, `ocrService.js` |
| Maps | OpenStreetMap, OSRM routing, Overpass points of interest | `mapRoutes.js`, `geoService.js` |
| Hosting | Netlify or Vercel (front end), Railway (API) | `netlify.toml`, `vercel.json`, `railway.json` |

**Key convention: dual mode.** Almost every route checks `mongoose.connection.readyState === 1`. With no database it serves realistic in-memory demo data (`server/data/mockData.js`), so the whole product can be demoed with zero setup.

---

## 8. Data model at a glance

| Group | Main models |
|---|---|
| Identity | `User`, `RoommateProfile`, `ParentAccess`, `FamilyAccess`, `CampusAmbassador` |
| Property structure | `HostelGroup` → `Hostel` → `Block` → `Room` → `BedBlock`; `Property` for Stays |
| Transactions | `Booking`, `StayBooking`, `GroupBooking`, `EscrowTransaction`, `LedgerEntry`, `ManualPayment`, `RentOffer`, `Discount`, `StudentWallet`, `UtilityBill`, `HostSubscriptionInvoice` |
| Trust and safety | `Review`, `Dispute`, `DepositCase`, `SafetyIncident`, `TrustScore`, `HostReputationScore`, `HostelDNAScore`, `FieldVerificationVisit`, `CheckInVerification`, `DigitalAgreement`, `TenancyAgreement` |
| Living | `MaintenanceTicket`, `MessMenu`, `MoveInChecklist`, `HostelPulse`, `HostelPoll` |
| Community | `CommunityPost`, `RoommateRequest`, `MarketplaceItem`, `LostFoundItem`, `StudySession`, `StudentActivity`, `ChatMessage` |
| Intelligence and caches | `VacancyForecast`, `HeatmapCache`, `NeighbourhoodCache`, `CommuteCache`, `MapAnalytics`, `AcademicEvent` |
| Platform | `AuditLog`, `AIAuditLog`, `PolicyRule`, `PlatformSetting`, `WebhookEvent`, `JobLog`, `ApiPartner`, `GlobalAlert` |

---

## 9. Intelligence today: what is AI and what is a formula

| Feature | How it works now | File |
|---|---|---|
| Student concierge, listing description (EN and Urdu), finance anomaly, dispute summary, review classifier | **Real LLM** (Claude) when a key is set; strict JSON output; human keeps every decision; template fallback | `aiService.js`, `aiRoutes.js` |
| Contact and off-platform leak detection (chat, listings) | Regex on Pakistani phone numbers, emails, URLs, payment words | `contactGatingService.js`, `chatFilter.js` |
| Duplicate-photo fraud | Perceptual-hash style fingerprint | `imageHashService.js` |
| ID OCR | Google Vision, env-gated | `ocrService.js` |
| Hostel DNA score (8 dimensions) | Deterministic formula from verification, rating, price and amenities | `dnaScoreService.js` |
| Student trust score, host risk, host reputation, listing quality | Weighted formulas and checklists | `trustScoreService.js`, `riskService.js`, `hostScoreService.js`, `listingQualityService.js` |
| Recommendations, smart pricing, vacancy forecast | Rules and heuristics (distance, budget, occupancy, seasonality) | `recommendationService.js`, `pricingService.js`, `vacancyForecastService.js` |

Reviews already capture aspect ratings (`cleanliness`, `food`, `internet`), free text, voice or video media and an `isVerifiedStay` flag. That is the raw material for the NLP work described in `BASERA_AI_ADDONS_AND_MARKET_COMPARISON.md`.

---

## 10. How Basera makes money

- Commission on rent, 5–10% depending on duration and amount; none on deposits
- Student service fee (PKR 400 per booking)
- Deposit-protection add-on (3%, capped; not yet underwritten)
- Host SaaS tiers and a monthly management fee (default PKR 1,000)
- Featured listings and priority placement
- Later: vendor marketplace take rate, API marketplace data access, verification services

---

## 11. Where to find things

| You want | Look in |
|---|---|
| Every endpoint | `README.md` → API Summary; `server/routes/` |
| Business rules (escrow, gating, refunds, pricing) | `server/services/` |
| Role and permission checks | `server/middleware/auth.js`, `blockRoutes.js` |
| Demo data | `server/data/mockData.js`, `seed.js` |
| Screens per role | `client/src/pages/` (`student/`, `host/`, `AdminDashboard.jsx`, `WardenDashboard.jsx`, `ParentPortalPage.jsx`) |
| Full requirements and demo scripts | `docs/01-Feature-Requirements-Specification.md`, `docs/04-Demo-Guide-All-Roles.md` |
| Deployment | `DEPLOY_RUNBOOK.md`, `docs/02-Development-Master-Plan.md` |

---

## 12. Maturity in one line

Feature breadth is very high and the trust, escrow and finance core is real code. Payment gateways, OCR, push and AI are wired but switched on by environment keys. Scores labelled "AI" are mostly formulas. The mobile app is written but not built. Improvement work is tracked in the audit files at the repository root.
