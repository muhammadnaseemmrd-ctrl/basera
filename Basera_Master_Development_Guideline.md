# Basera — Master Development Guideline & Phased Roadmap

*Prepared August 22, 2026*

## How this document was built

This is meant to be the single reference for what Basera is, how it's structured, and what's left to build. One honest caveat up front: the six original planning documents at the project root (`HostelHub_Pakistan_Planning_Document.docx`, `HostelHub_Pakistan_Planning_Document_v2.docx`, `HostelHub_MasterPlan_v3.docx`, `HostelHub_Feature_Addendum_v5.docx`, `HostelHub_Modern_Feature_Expansion_Roadmap.docx`, `HostelHub_Platform_Addendum_v6.docx`) are Word binaries that the tooling available this session couldn't open directly (no document-conversion service was reachable). `README.md`, however, states plainly that the entire codebase "is implemented from the V1, V2, V3, V5, and V6 planning documents" — and reading through the actual implementation confirms that's true in detail, not just in spirit. So this document treats the current, working codebase as the most reliable record of what those six documents specified, rather than guessing at their prose. If you want the original documents mined for anything not reflected in the live app, that's a quick follow-up once a document-conversion tool is available.

## 1. What Basera Is

Basera is a two-sided marketplace: students and young professionals search for verified, safe, affordably-priced housing near their university, and hosts (independent landlords, hostel operators, and now hostel *groups*) list and manage their properties, get paid through an escrow-protected flow, and grow their business with data-driven tools. A second vertical extends the same trust infrastructure to short-stay hotel/guest-house bookings for travelers.

## 2. System Architecture

| Layer | Technology | Notes |
|---|---|---|
| Web frontend | React 19, Vite, Tailwind CSS, Zustand, React Router 7, Framer Motion, Leaflet | `client/` |
| Mobile app | Expo / React Native (SDK 51), React Navigation, Zustand, Axios | `app/` — source-complete, not yet installed/built |
| Backend API | Node.js, Express 5, MongoDB/Mongoose, JWT auth, Socket.io | `server/`, REST under `/api/v1` |
| AI | Anthropic Claude API, env-gated (`CLAUDE_API_KEY`), template fallback | `server/services/aiService.js` |
| Database | MongoDB Atlas (`basera-cluster`, free tier) | Dual-mode: every route falls back to in-memory demo data when no `MONGO_URI` is configured |
| Hosting | Netlify (frontend), Railway (backend) | See `DEPLOY_RUNBOOK.md` |

The dual-mode demo/live pattern is the single most important architectural convention in this codebase: nearly every route checks `mongoose.connection.readyState === 1` and serves realistic in-memory data otherwise. Any new feature should follow this same pattern.

## 3. Complete Feature Inventory

### 3.1 Core marketplace (original scope)
Public listings and search, map-based discovery, hostel/room detail pages, booking flow, escrow-held payments (JazzCash/EasyPaisa/Stripe shells), student/host/admin dashboards, contact gating, chat with contact-leak filtering, discounts/coupons, referral loyalty points, PDF documents with public QR verification, recurring rent reminders, dispute resolution, deposit handling, review moderation, KYC/verification queue, community suite, neighbourhood intelligence, and the full V6 platform layer (finance command room, trust center, growth ops, academic calendar, group bookings, digital tenancy agreements, mess menu ratings, live room board, student trust score).

### 3.2 Rebrand (Phase 0)
New identity: name **Basera**, coral/navy/yellow palette, new logo, full-repo rename, SEO metadata, bug fixes, homepage converted from static mock data to a live API-backed page. **Follow-up fix this session:** three remaining "HostelHub" instances found and fixed in `client/src/components/Layout.jsx` (the public navbar/footer), which earlier text searches missed because the brand name was split across a `<span>` tag in the JSX.

### 3.3 Advanced features, round one (Phase 0)
Site-wide bilingual English/Urdu toggle, real Claude AI wired into all five `/ai/*` endpoints, referral leaderboard + rewards marketplace, video/voice review testimonials, swipeable roommate-matching UI, perceptual-hash duplicate-photo fraud detection, env-gated real OCR for ID verification, improved dynamic pricing, deposit protection add-on (pilot), WhatsApp click-to-chat, functional listing-alert signup.

### 3.4 Advanced features, round two (Phase 1)

**Hostel Groups.** Hostel chains/brands (e.g. "Royal Group of Hostels") are first-class: `HostelGroup` model, `GET/POST /api/v1/hostel-groups`, group-level branding page (`/hostel-groups/:slug`), search matches group names too.

**Blocks and Wardens.** Larger properties can be split into physical blocks (`Block` model, each with an assigned warden). A `warden` role logs in and sees only assigned blocks (enforced server-side) via `/warden/dashboard`.

**Manual seat-booked override.** Wardens (and hosts/admins) can mark a bed as booked through an off-platform channel with a reason note, using the existing bed-block mechanism extended with a `booked_offline` state — reversible via "Release."

**Roommate visibility.** A student's profile can optionally include an `occupantProfile` (occupant type, field/subject, study level, short bio, opt-out toggle). Anyone browsing a shared room sees a category-level summary of who's already living there — never a name, email, or phone number.

**Hotels & Guest Houses.** A parallel short-stay vertical, built as separate models (`Property`, `StayBooking`) rather than overloading the student-hostel models. Public search/detail (`/stays`, `/stays/:id`), guest bookings (`/dashboard/stays`), owner manager (`/host/stays`).

**Mobile app source.** A complete Expo/React Native project at `app/` — navigation, auth, home/search/listing-detail/booking/bookings/profile screens, calling the same `/api/v1` backend — plus three "Coming Soon" screens for Rider Booking, Food Ordering, and Job Seeker.

### 3.5 UI bug-fix pass (this session)
Fixed the public navbar/footer brand text (see 3.2), footer copyright year, removed the publicly-visible demo-credentials text from the login page and gated the Quick Demo Login buttons behind `VITE_SHOW_DEMO_BUTTONS`, replaced the student dashboard's hardcoded demo bookings with a real empty state ("You have no bookings yet." + "Find a Hostel"), wired the dashboard's student-type label to real profile data (`occupantProfile.fieldOrSubject`) instead of a hardcoded "Architecture Student," added a shared `formatDate()` utility so dates render as "15 Dec 2026" instead of raw ISO strings, defensively hardened the Recent Bookings table header cells against truncation, and added trust-indicator badges plus a more brand-aligned heading to the login page.

## 4. Phased Roadmap

### Phase 0 — Rebrand & Foundation (complete)
Rebrand, bug fixes, first round of advanced features, cloud infrastructure provisioning, deploy runbook, demo deck and mockups.

### Phase 1 — SaaS Expansion (complete)
Hostel Groups, Blocks/Wardens, manual seat override, roommate visibility, Hotels & Guest Houses vertical, mobile app source tree.

### Phase 1.5 — UI Bug Fix Pass (complete this session)
The nine fixes listed in section 3.5, applied directly in this project folder.

### Phase 2 — Get to a real, installed build (next, requires a working shell)
1. Push all code to a GitHub repository the owner controls.
2. `npm install` across `client/`, `server/`, and `app/`; run `npm run build --prefix client` and `npm run lint --prefix client`.
3. `npx expo install --fix` inside `app/` to reconcile hand-authored dependency versions.
4. Export real PNG icon/splash assets from `client/public/logo.svg` for the mobile app.
5. Connect Railway and Netlify to the pushed repo and trigger first deploys; run `npm run seed --prefix server`.
6. Take real screenshots of the running app; convert planning documents to native `.docx`/`.pptx` if desired.
7. Add a host-facing UI for creating blocks and assigning wardens.
8. Add a "My Properties" link to the host dashboard for the Stays manager.

### Phase 3 — Trust & Intelligence Hardening
True perceptual hashing (`npm install sharp`); real OCR partner activation; real deposit-insurance underwriting partner; server-side rendering/static prerendering for public pages.

### Phase 4 — Mobile App Feature Parity
Saved searches, chat, documents/receipts, push notifications on mobile; then a lightweight host app.

### Phase 5 — New Verticals: Rides, Food, Jobs
Each staged last because each is close to its own product: rider booking (thin integration with an existing ride-hailing partner), food ordering (start with the existing mess-menu partners), job seeker (part-time/internship listings, reusing the existing verification infrastructure to vet employers). Each needs its own focused planning pass before implementation.

## 5. Working Conventions for Whoever Builds the Next Phase

- **Always support both demo and live mode.**
- **Contact gating is a deliberate trust mechanism**, not an oversight — default to withholding direct contact until there's a real commitment, unless there's a documented reason not to.
- **New "AI" features should be genuinely gated and genuinely optional** — env-key-gated, timeout-bounded, silent fallback, never overclaim.
- **Every new page needs a route in `client/src/App.jsx` and, where relevant, a nav entry.**
- **When searching for old brand-name references, don't rely solely on a contiguous-string search** — JSX can split text across tags (`Hostel<span>Hub</span>`), which a plain grep for "HostelHub" won't catch. Search for both the plain string and the tag-split pattern.
