# Basera — Live Demo Guide

*Prepared August 22, 2026*

Use this alongside `demo-assets/Basera_Demo_Deck.html` (open in any browser, arrow keys or Next/Prev to navigate, prints cleanly to PDF). The deck carries the narrative and visuals; this document is the walkthrough script for presenting the actual running app — every feature below works in demo mode without a database connection.

## Demo accounts

All demo accounts use password `password123`.

| Role | Email | What to show with it |
|---|---|---|
| Student | `student@basera.pk` | Search, booking, roommate visibility, cost estimator, engagement tools |
| Host | `landlord@basera.pk` | Room inventory, growth center, smart pricing, subscription |
| Hostel Host (group owner) | `owner@basera.pk` | Hostel Groups, property listing flow |
| Warden | `warden@basera.pk` | Warden Dashboard, manual seat-booked override |
| Admin | `admin@basera.pk` | Verification queue, finance, trust center, moderation |

Note: the Quick Demo Login buttons on the login page only render when `VITE_SHOW_DEMO_BUTTONS=true` is set in `client/.env` — enable it for local/demo presentations, and make sure it's off (or unset) for anything a real user might see.

## Suggested demo flow (~15–20 minutes)

### 1. Open with the problem (2 min)
Land on the homepage (`/`). Point out real listings (pulled from the live API), verified/escrow trust badges in the hero, and the "Get notified" signup.

### 2. Search and discovery (2 min)
Go to `/rooms` or use the homepage search. Show city/university filtering, the map view (`/rooms?view=map`), and search **"Royal"** to demonstrate Hostel Groups: results surface all Royal Group branches, and `/hostel-groups/royal-group` shows the branded group page with every branch listed.

### 3. Roommate visibility — the differentiator (3 min)
Open a shared room's detail page. Point out the **Roommates panel**: "Currently living here: 1 Working Professional — Mathematics Teacher — quiet, early sleeper, can help with calculus." No name, no contact info. Log in as `student@basera.pk`, open Dashboard → Profile to show how a student sets their own visibility, including the opt-out toggle.

### 4. Booking and escrow (2 min)
Walk through starting a booking — contact gating, the optional **Deposit Protection** add-on (pilot, honestly labeled), and the escrow explanation.

### 5. Warden Dashboard — operational trust (2 min)
Log in as `warden@basera.pk`, open `/warden/dashboard`. Demonstrate **Mark Seat Booked (Offline)**: click it on a vacant bed, enter a reason, show the amber "Booked Offline" state, then Release to show it's reversible.

### 6. Host side: Growth Center (2 min)
Log in as `landlord@basera.pk`, open the Growth Center. Show the enhanced **Smart Pricing** card reasoning from real occupancy, comparable prices, and seasonality.

### 7. Hotels & Guest Houses — the new vertical (2 min)
Navigate to `/stays`, search "Murree." Show nightly-rate cards, open a property, show the date-range booking form.

### 8. AI concierge (1 min)
Ask the concierge something like "What documents do I need to book a room?" — if `CLAUDE_API_KEY` is configured, this is a real Claude response.

### 9. Close on the mobile app and roadmap (2 min)
Switch to the deck for the mobile app/roadmap/go-to-market slides, since the mobile app isn't installable in a browser demo.

## Things to be upfront about if asked

- **Deposit Protection** is a real fee/opt-in/claims flow, but not yet backed by a licensed insurance underwriter.
- **AI-labeled scoring features** (DNA score, trust score, vacancy forecast) are deterministic calculations, not machine learning — only the five `/ai/*` endpoints call a real LLM, and only when a key is configured.
- **The mobile app** is a complete, real source tree, not yet installed/built/published.
- **Hotel/guest-house guest contact** is shared at booking time (not gated like the long-term student flow) — deliberate, given the lower risk of a 1–3 night stay.
- **Quick Demo Login buttons and the demo-credentials text are gone from the public login page** as of this session's UI fixes — don't reference them as if they're still visible to real users.

## If presenting live against a real deployment

Confirm beforehand: the Railway health check returns OK, and demo data has been seeded (`npm run seed --prefix server`) so the accounts above actually exist in the live database.
