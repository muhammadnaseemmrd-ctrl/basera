# Basera Pakistan MERN App

Basera is a MERN-stack accommodation marketplace for Pakistani students and young professionals. The app supports verified hostels, private rooms, PG accommodation, shared rooms, studios, booking, escrow-style payments, student/Host/admin dashboards, finance command-room operations, map intelligence, trust/safety workflows, contact gating, discounts, PDF documents, public receipt verification, recommendations, risk scoring, reminders, and demo-mode fallback when MongoDB is not configured.

This repository was originally implemented from six legacy `HostelHub_*.docx` planning documents (V1, V2, V3, V5, V6, and a Modern Feature Expansion Roadmap). Those documents have since been fully consolidated, cross-checked against the live codebase, and superseded by the documentation set in [`docs/`](docs/) — see that folder for the current, authoritative reference:

- [`docs/01-Feature-Requirements-Specification.md`](docs/01-Feature-Requirements-Specification.md) — complete feature inventory, architecture, data model, and requirements (also available as `.docx` / `.pdf`)
- [`docs/02-Development-Master-Plan.md`](docs/02-Development-Master-Plan.md) — phased roadmap and the Railway/Netlify deployment runbook (also `.docx` / `.pdf`)
- [`docs/03-Marketing-Social-Media-Plan.md`](docs/03-Marketing-Social-Media-Plan.md) — content calendar, daily AI prompt system, and paid ads plan (also `.docx` / `.pdf`)
- [`docs/04-Demo-Guide-All-Roles.md`](docs/04-Demo-Guide-All-Roles.md) — a plain-language demo script for every role (also `.docx` / `.pdf`)

## Stack

- Frontend: React, Vite, Tailwind CSS, Zustand, React Router, Lucide icons, Framer Motion, Leaflet maps
- Backend: Node.js, Express, MongoDB/Mongoose, JWT auth, Socket.io chat, PDFKit documents, QR receipt verification
- Payments and finance: Demo payment routes plus JazzCash, EasyPaisa, Stripe webhook shells, double-entry ledger, commissions, deposits, reconciliation, payout approvals, host statements, student wallet credits, refund previews, and forecasts
- Uploads: Local demo upload fallback, Cloudinary support, and metadata contact-leak scanning
- Maps: Leaflet + OpenStreetMap tiles, OSRM route proxy/fallback, affordability layers, isochrone summaries, safety-confidence cells, demand pulse, parent map summaries, offline campus pack metadata, and browser service-worker tile cache

## Major Flows Implemented

- Public home, hostel listings, rooms marketplace, hostel detail, room detail, booking, auth, and static pages
- Public v5 map discovery: map-first room marketplace, price markers, cluster markers, bbox filtering, draw-to-search, availability heatmap, safety overlay, campus overlay, and `/compare-cities`
- Public v6 map intelligence: affordability score cards, isochrone commute rings, safety-confidence summaries, demand pulse, parent-safe map summaries, and offline campus pack metadata on the rooms marketplace
- Student dashboard: overview, bookings, payments/rent, reviews, disputes, documents, safety/support, emergency contact, alert acknowledgements, and maintenance tickets
- Student engagement tools: smart room comparison, roommate compatibility matching, saved search alerts, referral loyalty points, global alert submissions, and outdoor activity planning with contribution tracking
- Student v5 tools: multi-stop route planner, saved/shareable routes, study session creation/join/complete, packing checklist PDF downloads, commute/rickshaw fare cards, and rent split calculator
- Student v6 decision lab: AI room match quiz, room comparison board, cost estimator, roommate score, saved search trigger, parent share link, visit scheduler, move-in checklist, refund preview, campus groups, wallet credits, and student concierge
- Student services center: manual payment challans and proof upload, QR move-in pass, guardian portal share links, vendor marketplace ordering, automated waitlist rules, and campus ambassador applications
- Host dashboard: overview, room inventory, booking requests, tenants, finance, ledger, maintenance, bed holds, chat, rent reminders
- Host v5 tools: portfolio map, occupancy/revenue location cards, and map story publishing for neighbourhood tours
- Host v6 growth center: growth coach, smart pricing, occupancy heat calendar, bulk room editor, tenant CRM snapshot, maintenance SLA board, reply templates, reputation score, and AI listing description generator
- Host subscription center: Starter/Pro/Premium management plans, monthly management-fee invoices, and manual proof upload for hosts without gateway payments
- Hostel Host dashboard: hostel property listing, proof uploads, Host agreement signature, off-platform payment acknowledgement
- Admin dashboard: platform stats, user management, verification queue, finance, loyalty claims, global alert approvals, operations monitoring, KYC/OCR review, listing quality scoring, review moderation, dynamic platform settings, discounts, payout queue, disputes
- Admin v5 tools: city analytics map, city comparison metrics, heatmap review, and map cache invalidation
- Admin v6 finance/trust centers: command-room finance KPIs, ledger explorer, escrow waterfall, payout approval room, deposit liability register, host statements, revenue forecast, trust queue, incident timeline, verification visit planner, policy rules, moderation explainability, city scorecard, finance anomaly detector, dispute summary assistant, and review classifier
- Admin growth operations: manual-payment review, field-verification scheduling, host subscription invoices, vendor order oversight, trust timelines, review sentiment, and campus ambassador approvals
- Admin finance: double-entry ledger reconciliation, escrow/deposit balances, webhook duplicate checks, and Host risk queue
- Host business tools: SaaS plan tiers, commission rate display, payout finance, tenant reminders, and risk score
- Recommendations: room ranking by university proximity, budget, availability, meal plan, instant booking, and verification signals
- PWA notifications: push subscription endpoint and service-worker notification handling for rent, escrow, and dispute updates
- Activities: hostel/campus activity planning for trips, sports, dining, study sessions, and shared contribution collection
- Community suite: moderated student feed, visit scheduling, roommate requests, move-in checklist, digital agreement signing, hostel polls, student marketplace, lost/found, smart nudges, notification center, verification badge levels, and host leaderboard
- Neighbourhood intelligence: nearby POIs, facilities score strip, commute times, rickshaw fare estimates, hostel photo feed, and host-created map stories on room/hostel detail pages
- Referral loyalty: each successful referral awards points; after the configured threshold students can claim a next-booking discount for admin approval
- Global alerts: student/Host submitted alerts require admin approval; admin-created alerts publish immediately, can target city/university/hostel, can require acknowledgement, and expire automatically after the configured display window
- Maintenance and operations: students create repair tickets, Hosts update SLA status, admins monitor all tickets, and room beds can be blocked for repairs/cleaning through the availability calendar
- Manual seat-booked override: Hosts/admins/Wardens can mark a specific bed as "booked_offline" (with a reason/note, marker id, and timestamp) using the same bed-block/availability-calendar mechanism as repair holds, rendered with a distinct color/label, and reversible via a Release action
- Hostel groups/chains: multi-branch hostel brands (`HostelGroup`) can be created by a host, existing hostels attached to a group, and hostel search/detail pages surface a "part of {Group}" badge linking to a group page listing all branches
- Blocks and Wardens: larger hostels can be split into blocks with an assigned Warden (`role: "warden"`), each managing only their own block's rooms via a dedicated Warden Dashboard, enforced server-side (not just hidden in the UI)
- Refund transparency: cancellation previews show refundable rent/deposit, non-refundable amount, policy reason, and ETA before cancellation
- Moderation and quality control: review moderation, audit logs, document checks, operational health checks, and listing quality scoring are exposed to admins
- Contact gating: Host phone/email/WhatsApp are hidden before a paid confirmed booking
- Chat filtering: phone numbers, emails, external links, and off-platform payment instructions are masked/flagged
- Listing text filtering: contact/payment leaks in listing submissions are rejected before publishing/review
- Escrow model: student payment is held, commission is calculated, Host payout is released after move-in plus hold window if no dispute
- Deposit workflow: Host deduction request, student accept/dispute actions, admin resolution, and deposit ledger entries
- Off-platform payment protection: student report flow blocks escrow release and records a high-priority case
- Recurring rent: student rent/payment screen, Host tenant statuses, rent reminder endpoints
- Discounts: automatic, coupon, and Host-funded discount APIs
- PDF documents: receipts, confirmation letters, rent ledgers, rent certificates, payout statements, deposit receipts/refund notices, late fee invoices, Host monthly summaries, Host agreements, approval letters, dispute resolutions, and public QR verification
- V5 media/AI: virtual room tour URLs, panorama images, hostel photo feed API, and protected room description generator with template fallback
- V6 AI safety behavior: student concierge, listing description generator, finance anomaly detector, dispute summarizer, review classifier, source IDs/confidence, audit logging when MongoDB is connected, and template fallback when no AI key is configured
- V6 platform addendum: MongoDB indexes, pooled connection options, NodeCache-backed read caching, compression, scoped rate limits, Socket.io per-user/role targeting, cron job logs, host P&L/cashflow/portfolio finance, utility bill splitting, DNA score, vacancy forecast, rent negotiation, digital tenancy agreement, family portal, academic calendar intelligence, mess menu ratings, check-in verification, group booking, API marketplace, live room board, student trust score, and report-card PDFs

## Project Structure

```txt
Hostel_Hub/
  client/              React + Tailwind frontend
  server/              Express API
  scripts/             UI validation scripts
  vercel.json          Vercel frontend deployment from monorepo root
  railway.json         Railway backend deployment config
  package.json         Root scripts for full app
```

## Install

```bash
cd D:\MernStack\Hostel_Hub
npm install
npm install --prefix client
npm install --prefix server
```

Recommended Node version: Node 20 LTS or Node 22 LTS. Newer versions may work, but LTS is safer for production-like testing.

## Run In Demo Mode

Demo mode works without MongoDB. The API uses in-memory demo data.

```bash
cd D:\MernStack\Hostel_Hub
npm run dev
```

Open the frontend URL printed by Vite. It is usually:

```txt
http://localhost:5173
```

If Vite says port `5173` is busy, it may use `5174` or the next available port.

The backend defaults to:

```txt
http://localhost:5000/api/v1
```

If port `5000` is busy, stop the existing process or run the server with another port:

```powershell
$env:PORT=5001
$env:VITE_API_URL="http://localhost:5001/api/v1"
npm run dev
```

On Windows, to find and stop a process using port `5000`:

```powershell
Get-NetTCPConnection -LocalPort 5000 | Select-Object -Property OwningProcess
Stop-Process -Id <PID> -Force
```

## Demo Accounts

All demo accounts use:

```txt
password123
```

```txt
Student:     student@basera.pk
Host:        landlord@basera.pk
Hostel Host: owner@basera.pk
Admin:       admin@basera.pk
Warden:      warden@basera.pk
```

## New Engagement Screens

```txt
Student community: /dashboard/student/community
Student routes:    /dashboard/student/engage > Route Planner
Student v6 lab:    /dashboard/student/engage > Decision Lab
Student services:  /dashboard/student/services
Study sessions:    /dashboard/student/engage > Study Sessions
Host community:    /host/dashboard > Community
Host growth:       /host/dashboard > Growth
Host subscription: /host/dashboard > Subscription
Host smart finance: /host/dashboard > Smart Finance
Host rent offers:  /host/dashboard > Offers
Host mess menu:    /host/dashboard > Mess Menu
Owner community:   /owner/dashboard > Community
Admin moderation:  /admin > Community
Admin finance v6:  /admin > Finance Room
Admin trust v6:    /admin > Trust Center
Admin growth ops:  /admin > Growth Ops
Parent portal:     /parent/:token
Live room board:   /hostels/:slug/live-board
City comparison:   /compare-cities
Room map search:   /rooms?view=map
Hostel group page: /hostel-groups/:slug
Warden dashboard:  /warden/dashboard
```

These screens are API-bound. In demo mode they read and write in-memory data; with `MONGO_URI` configured they use MongoDB collections.

The V3 canonical Host role is `host`. Old `owner` and `landlord` roles remain supported as aliases for backward compatibility. `warden` is a separate, narrowly-scoped role: a warden can only view/manage the block(s) they are assigned to (enforced server-side in `blockRoutes.js` and the `/rooms/:id/bed-blocks*` routes), and `/warden/dashboard` is also reachable by `host`/`admin` for oversight.

## Routes

Public:

```txt
/
/hostels
/hostels/:slug
/rooms
/rooms/:id
/compare-cities
/booking
/login
/landlord/onboarding     legacy path, now Host onboarding
/verify/:receiptId       public receipt/document verification
```

Student:

```txt
/dashboard/student
/dashboard/student/bookings
/dashboard/student/payments
/dashboard/student/saved
/dashboard/student/engage
/dashboard/student/services
/dashboard/student/support
/dashboard/student/chat
/dashboard/student/profile
```

Host:

```txt
/host/dashboard
/landlord/dashboard      legacy alias
/owner/dashboard         legacy hostel Host dashboard
```

Admin:

```txt
/admin
```

## Environment Configuration

Copy the templates:

```bash
copy server\.env.example server\.env
copy client\.env.example client\.env
```

Client:

```env
VITE_API_URL=http://localhost:5000/api/v1
VITE_SITE_URL=http://localhost:5173
VITE_ALLOW_DEMO_FALLBACK=true
VITE_ENABLE_CLIENT_DEMO_LOGIN=true
```

Server:

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
PUBLIC_APP_URL=http://localhost:5173
ALLOW_DEMO_MODE=false
RATE_LIMIT_DISABLED=false
MONGO_URI=
MONGO_MAX_POOL_SIZE=50
MONGO_MIN_POOL_SIZE=10
MONGO_SOCKET_TIMEOUT_MS=45000
MONGO_SERVER_SELECTION_TIMEOUT_MS=5000
MONGO_HEARTBEAT_FREQUENCY_MS=10000
JWT_SECRET=change-this-super-secret
JWT_EXPIRES_IN=7d

JAZZCASH_MERCHANT_ID=
JAZZCASH_PASSWORD=
JAZZCASH_INTEGRITY_SALT=
EASYPAISA_STORE_ID=
EASYPAISA_HASH_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
OCR_PROVIDER=

EMAIL_FROM=Basera <no-reply@basera.pk>
SUPPORT_EMAIL=support@basera.pk
SUPPORT_WHATSAPP=0300-BASERA
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SENDGRID_API_KEY=
GMAIL_USER=
GMAIL_APP_PASSWORD=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

DISPUTE_EMAIL=
DISPUTE_ADMIN_EMAIL=
RECEIPT_LOGO_URL=
CRON_SECRET=
MAX_INSTALMENT_LATE_DAYS=7
MAX_LATE_FEE_DAYS=10
ESCROW_HOLD_HOURS=48
COMMISSION_RATE_DEFAULT=0.07
STUDENT_SERVICE_FEE_PKR=400
LATE_FEE_PKR=500
OFF_PLATFORM_REPORT_CREDIT_PKR=500
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
BASERA_BANK_ACCOUNT=
BASERA_ESCROW_ACCOUNT=
BASERA_MANAGEMENT_FEE_PKR=1000
FBR_WITHHOLDING_TAX_RATE=0.05
RICKSHAW_FARE_PER_KM=28
FINANCE_EXPORT_SECRET=
PAYOUT_APPROVAL_MIN_AMOUNT=100000
REFUND_POLICY_VERSION=v6-demo
MAP_CACHE_TTL_HOURS=24
OSRM_BASE_URL=https://router.project-osrm.org
OVERPASS_BASE_URL=https://overpass-api.de/api/interpreter
AI_PROVIDER=template-fallback
AI_API_KEY=
SENTRY_DSN=
REDIS_URL=
CLAUDE_API_KEY=
```

Required for real database mode:

- `MONGO_URI`
- `JWT_SECRET`
- In production, `MONGO_URI` is required unless you explicitly set `ALLOW_DEMO_MODE=true`. Keep `ALLOW_DEMO_MODE=false` for real deployments.
- Frontend production should set `VITE_ALLOW_DEMO_FALLBACK=false` and `VITE_ENABLE_CLIENT_DEMO_LOGIN=false` unless you intentionally want demo fallback.
- `RATE_LIMIT_DISABLED=true` is only for automated validation/load-free local testing. Keep it `false` in production.
- `MONGO_MAX_POOL_SIZE`, `MONGO_MIN_POOL_SIZE`, `MONGO_SOCKET_TIMEOUT_MS`, `MONGO_SERVER_SELECTION_TIMEOUT_MS`, and `MONGO_HEARTBEAT_FREQUENCY_MS` tune the V6 pooled MongoDB connection. The defaults are suitable for local/Railway MVP testing; lower `MONGO_MIN_POOL_SIZE` if your host has tight connection limits.

Optional for production-style integrations:

- Cloudinary credentials for uploads
- Payment gateway credentials for JazzCash/EasyPaisa/Stripe
- `STRIPE_WEBHOOK_SECRET` for signed Stripe webhooks
- Gmail, SMTP, or SendGrid credentials for live email sending. Without credentials, emails render and queue in demo mode only.
- `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` for real browser push notifications; add the public key to `client/.env` as `VITE_VAPID_PUBLIC_KEY`
- `OCR_PROVIDER` if you add an OCR service for scanning text inside uploaded images/PDFs
- `CRON_SECRET` for secured reminder/payout jobs
- `RICKSHAW_FARE_PER_KM` for commute fare estimates; default is `28`
- `AI_PROVIDER` and `AI_API_KEY` if replacing the template AI fallback with a real AI provider
- `SENTRY_DSN` for production error monitoring
- `REDIS_URL` for future queue/cache-backed production jobs; demo/local mode does not require Redis
- `FINANCE_EXPORT_SECRET` and `PAYOUT_APPROVAL_MIN_AMOUNT` for finance exports and high-value payout review policy
- `BASERA_BANK_ACCOUNT`, `BASERA_ESCROW_ACCOUNT`, and `BASERA_MANAGEMENT_FEE_PKR` for manual payment instructions and host subscription billing
- `FBR_WITHHOLDING_TAX_RATE` for host P&L tax estimates. This is an estimate helper only, not tax advice.
- `REFUND_POLICY_VERSION` for refund previews and audit output
- `MAP_CACHE_TTL_HOURS`, `OSRM_BASE_URL`, and `OVERPASS_BASE_URL` for production map/cache behavior
- `CLAUDE_API_KEY` is optional and only needed if you wire Claude-specific calls into the AI service

OpenStreetMap and OSRM:

- No paid account is required for local/demo maps.
- Leaflet uses public OpenStreetMap tiles.
- Route estimates call the public OSRM demo service and fall back to straight-line estimates if it is unavailable.
- The service worker caches OpenStreetMap tiles for recently viewed areas in production builds.
- For production scale, use a proper tile provider or self-hosted tile/OSRM service and update the tile/route URLs in the map components and API route.

Admin-configurable platform controls are stored in MongoDB under the `platformControls` setting, or in demo memory when MongoDB is off. Admins can change these from `/admin` > `Loyalty & Alerts`:

- Host management monthly fee, default `PKR 1,000`
- Referral points per successful referral, default `1,000`
- Loyalty claim threshold, default `5,000`
- Loyalty discount approval range, default `5%` to `10%`
- Global/targeted alert display window, default `48` hours

Finance/ledger note: platform rent, commission, deposit, payout, late-fee, activity contribution, and Host management-fee events should be reconciled from `/api/v1/finance/ledger` and `/api/v1/finance/reconciliation`. The new maintenance/alert/review operations are audit-log events, not revenue ledger events.

V6 finance operations are available from `/admin` > `Finance Room`. The screen calls finance APIs for the command-room KPIs, ledger search, escrow waterfall, payout approvals/retries, deposit liability register, host statements, refund previews, student wallet credits, and revenue forecast.

Email behavior:

- `server/services/emailService.js` includes V3 templates `E-01` through `E-16` plus aliases such as `BOOKING_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYOUT_SENT`, `RENT_REMINDER_7D`, `LATE_FEE_INVOICE`, `DEPOSIT_UPDATE`, `DISPUTE_OPENED`, and `DISPUTE_RESOLVED`.
- If no email credentials are configured, `sendEmail()` returns demo queued output without contacting an SMTP server.
- For Gmail, create a Google App Password and set `GMAIL_USER` plus `GMAIL_APP_PASSWORD`.
- For custom SMTP, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, and `SMTP_PASS`.
- For SendGrid, set `SENDGRID_API_KEY`; Nodemailer will use SendGrid SMTP.

## MongoDB Atlas Setup

1. Create a free MongoDB Atlas account at `https://www.mongodb.com/atlas`.
2. Create a project and an M0 cluster.
3. Create a database user from Database Access.
4. Add your IP from Network Access. For local testing you can temporarily allow your current IP.
5. Open Connect > Drivers and copy the connection string.
6. Replace `<username>`, `<password>`, and database name:

```env
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/basera?retryWrites=true&w=majority
```

7. Put that value in `server/.env`.
8. Seed demo data:

```bash
npm run seed
```

Never commit real secrets. Keep real credentials only in `.env`.

## External Account Setup

Use these locations for credentials:

- Local backend secrets: `server/.env`
- Local frontend public variables: `client/.env`
- Railway backend deployment variables: Railway project > Variables
- Vercel frontend deployment variables: Vercel project > Settings > Environment Variables

### MongoDB Atlas

1. Create an Atlas account and an M0 cluster.
2. Create a database user from Database Access.
3. Add network access. For quick testing use your current IP; for Railway you may temporarily allow `0.0.0.0/0` until you configure stricter networking.
4. Copy the Drivers connection string.
5. Add it to `server/.env` locally and Railway Variables in production:

```env
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/basera?retryWrites=true&w=majority
```

6. Run `npm run seed` after setting `MONGO_URI`.

### Cloudinary

1. Create a Cloudinary account at `https://cloudinary.com`.
2. Open Dashboard > API Keys.
3. Copy Cloud Name, API Key, and API Secret.
4. Add these to `server/.env` and Railway Variables:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

These are used by `/api/v1/uploads/document` for verification documents and listing proof uploads.

### Email: Gmail, SMTP, or SendGrid

Gmail:

1. Enable 2-Step Verification on the Google account.
2. Create an App Password from Google Account > Security > App passwords.
3. Add this to `server/.env` and Railway Variables:

```env
EMAIL_FROM=Basera <no-reply@basera.pk>
GMAIL_USER=your_gmail_address@gmail.com
GMAIL_APP_PASSWORD=your_16_character_app_password
SUPPORT_EMAIL=support@basera.pk
SUPPORT_WHATSAPP=0300-BASERA
```

Custom SMTP:

```env
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
```

SendGrid:

1. Create a SendGrid account.
2. Verify a sender identity or domain.
3. Create an API key with Mail Send access.
4. Add this to `server/.env` and Railway Variables:

```env
SENDGRID_API_KEY=your_sendgrid_api_key
EMAIL_FROM=Basera <verified-sender@yourdomain.com>
```

If none of these are configured, the email service stays in demo mode and returns queued email payloads without sending.

### Stripe

1. Create a Stripe account at `https://dashboard.stripe.com`.
2. Use test mode first.
3. Copy Developers > API keys > Secret key.
4. Add it to `server/.env` and Railway Variables:

```env
STRIPE_SECRET_KEY=sk_test_or_live_key
```

5. Add a webhook endpoint in Stripe:

```txt
https://<your-api-domain>/api/v1/payments/stripe/webhook
```

6. Select `payment_intent.succeeded`.
7. Copy the webhook signing secret and add:

```env
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

### JazzCash

1. Apply for a JazzCash Business/Merchant account.
2. Request sandbox credentials first, then production credentials after approval.
3. Ask JazzCash to configure this callback URL:

```txt
https://<your-api-domain>/api/v1/payments/jazzcash/callback
```

4. Add the issued values to `server/.env` and Railway Variables:

```env
JAZZCASH_MERCHANT_ID=your_merchant_id
JAZZCASH_PASSWORD=your_password
JAZZCASH_INTEGRITY_SALT=your_integrity_salt
```

### Easypaisa

1. Apply for an Easypaisa merchant account.
2. Request sandbox credentials and confirm the hash/signature rules with Easypaisa.
3. Ask Easypaisa to configure this callback URL:

```txt
https://<your-api-domain>/api/v1/payments/easypaisa/callback
```

4. Add the issued values to `server/.env` and Railway Variables:

```env
EASYPAISA_STORE_ID=your_store_id
EASYPAISA_HASH_KEY=your_hash_key
```

### Browser Push Notifications

1. Generate VAPID keys:

```bash
npx web-push generate-vapid-keys
```

2. Add private and public keys to `server/.env` and Railway Variables:

```env
VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
```

3. Add only the public key to `client/.env` and Vercel Variables:

```env
VITE_VAPID_PUBLIC_KEY=your_public_key
```

### Twilio SMS

1. Create a Twilio account.
2. Verify your phone number in trial mode or buy a production sender number.
3. Copy Account SID, Auth Token, and sender phone number.
4. Add these to `server/.env` and Railway Variables:

```env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_sender_number
```

SMS credentials are reserved for production notification expansion. Email and push are the currently wired notification paths.

### OCR Provider

The current upload scanner checks metadata/contact leakage. To add full image/PDF OCR, pick a provider such as Google Vision, AWS Textract, or OCR.Space, then extend `server/services/uploadScanService.js`.

Set the provider marker in `server/.env` and Railway Variables:

```env
OCR_PROVIDER=google-vision
```

Add any provider-specific API keys as new env variables when the OCR integration is implemented.

### Cron Jobs

1. Create a strong secret:

```powershell
[guid]::NewGuid().ToString("N")
```

2. Add it to `server/.env` and Railway Variables:

```env
CRON_SECRET=your_generated_secret
```

3. Use Railway cron, cron-job.org, or any scheduler to call:

```txt
POST https://<your-api-domain>/api/v1/reminders/daily
Header: x-cron-secret: your_generated_secret
Schedule: daily at 09:00 Asia/Karachi
```

This runs 7-day reminders, 1-day reminders, overdue processing, and escrow payout release checks.

## Deployment

Recommended production split:

- Backend API: Railway, using `railway.json`
- Frontend SPA: Vercel, using root `vercel.json` or `client/vercel.json`

### Backend On Railway

1. Push the project to GitHub.
2. Create a Railway project and connect the GitHub repo.
3. Railway will use `railway.json`.
4. Add all backend variables from `server/.env.example` in Railway project > Variables.
5. Set these production URLs:

```env
CLIENT_URL=https://<your-vercel-domain>
PUBLIC_APP_URL=https://<your-vercel-domain>
```

6. Deploy and confirm:

```txt
https://<your-railway-domain>/api/v1/health
```

### Frontend On Vercel

The repository now includes:

```txt
vercel.json
client/vercel.json
```

Use the root `vercel.json` if importing the full monorepo into Vercel. It runs:

```txt
installCommand: npm install && npm install --prefix client
buildCommand: npm run build --prefix client
outputDirectory: client/dist
```

Vercel environment variables:

```env
VITE_API_URL=https://<your-railway-domain>/api/v1
VITE_SITE_URL=https://<your-vercel-domain>
VITE_VAPID_PUBLIC_KEY=your_public_vapid_key
```

After deploying Vercel, copy the Vercel URL back into Railway as `CLIENT_URL` and `PUBLIC_APP_URL` so CORS and PDF QR verification links point to the live frontend.

## Revenue Model

Basera revenue is generated through:

- Commission on rent: deducted from student rent before Host payout.
- Student service fee: added at checkout using `STUDENT_SERVICE_FEE_PKR`.
- Premium Host upgrades: dashboard includes upgrade/priority listing surfaces.
- Host SaaS tiers and management-system fees: Starter, Pro, and Premium can lower commission and add priority/listing tools; admins can dynamically manage the monthly management-system fee.
- Off-platform report protection: credible direct-payment reports can block Host payouts and create a review case.
- Future optional revenue: verification services, featured listings, insurance/service bundles.

Escrow behavior:

- Student pays rent, service fee, and deposit into Basera-controlled ledger.
- Security deposit is tracked separately and has no commission.
- Commission is calculated on rent only.
- Host payout is released after move-in plus `ESCROW_HOLD_HOURS` if there is no dispute.
- Disputed bookings keep escrow blocked until admin resolution.

## API Summary

Auth:

```txt
POST /api/v1/auth/login
POST /api/v1/auth/register
POST /api/v1/auth/register-landlord    legacy endpoint, creates Host
GET  /api/v1/auth/me
```

Listings:

```txt
GET    /api/v1/hostels
POST   /api/v1/hostels
GET    /api/v1/hostels/:slug
GET    /api/v1/hostels/:id/photos
POST   /api/v1/hostels/:id/verify
GET    /api/v1/hostel-groups
GET    /api/v1/hostel-groups/:slug
POST   /api/v1/hostel-groups
POST   /api/v1/hostel-groups/:id/hostels/:hostelId
PUT    /api/v1/hostel-groups/:id
GET    /api/v1/blocks?hostelId=
POST   /api/v1/blocks
PUT    /api/v1/blocks/:id
GET    /api/v1/blocks/:id/rooms
GET    /api/v1/rooms
POST   /api/v1/rooms
POST   /api/v1/rooms/generate-description
GET    /api/v1/rooms/recommendations
GET    /api/v1/rooms/:id
GET    /api/v1/rooms/:id/availability
GET    /api/v1/rooms/:id/availability-calendar
GET    /api/v1/rooms/:id/bed-blocks
POST   /api/v1/rooms/:id/bed-blocks
PUT    /api/v1/rooms/:id/bed-blocks/:blockId
POST   /api/v1/rooms/:id/waitlist
POST   /api/v1/rooms/:id/trial
```

V5 map and neighbourhood APIs:

```txt
GET  /api/v1/rooms?bbox=swLat,swLng,neLat,neLng
GET  /api/v1/rooms?polygon=[[lat,lng],[lat,lng],[lat,lng]]
GET  /api/v1/rooms?lat=33.69&lng=73.01&radius=5
GET  /api/v1/rooms?view=map
GET  /api/v1/map/nearby?lat=33.69&lng=73.01
GET  /api/v1/map/commute?fromLat=33.69&fromLng=73.01&university=NUST
GET  /api/v1/map/heatmap?city=Islamabad&type=availability
GET  /api/v1/map/safety?city=Islamabad
GET  /api/v1/map/campus?university=NUST&city=Islamabad
GET  /api/v1/map/city-comparison?cities=Islamabad,Lahore,Karachi
GET  /api/v1/map/stories
POST /api/v1/map/stories
GET  /api/v1/map/host-portfolio
POST /api/v1/map/route
GET  /api/v1/map/routes
POST /api/v1/map/cache/invalidate
```

V6 map intelligence APIs:

```txt
GET /api/v1/map/affordability?city=Islamabad
GET /api/v1/map/isochrones?university=NUST&city=Islamabad
GET /api/v1/map/safety-confidence?city=Islamabad
GET /api/v1/map/demand-pulse?city=Islamabad
GET /api/v1/map/parent-summary?city=Islamabad&lat=33.69&lng=73.01
GET /api/v1/map/offline-pack/:universityId
GET /api/v1/map-stories
POST /api/v1/map-stories
```

V6 platform addendum APIs:

```txt
GET  /api/v1/dashboard/host/cashflow-forecast
GET  /api/v1/dashboard/host/pl-statement?month=&year=
GET  /api/v1/dashboard/host/portfolio-finance
GET  /api/v1/documents/hosts/:id/pl-statement
GET  /api/v1/documents/hosts/:id/report-card-certificate
POST /api/v1/utility-bills
GET  /api/v1/utility-bills/split/:bookingId
GET  /api/v1/hostels/:id/dna-score
GET  /api/v1/hostels/:id/pulse
GET  /api/v1/hostels/:id/alumni
POST /api/v1/hostels/:id/alumni/link
POST /api/v1/hostels/:id/alumni/referral
GET  /api/v1/hostels/:id/mess-menu
POST /api/v1/hostels/:id/mess-menu
POST /api/v1/mess-menu/meals/:mealId/rate
GET  /api/v1/hostels/:id/live-board
GET  /api/v1/hostels/:id/live-board/stream
GET  /api/v1/rooms/:id/vacancy-forecast
GET  /api/v1/rooms/:id/match-score
POST /api/v1/rooms/:id/offers
GET  /api/v1/offers/my
PUT  /api/v1/offers/:id/accept
PUT  /api/v1/offers/:id/counter
PUT  /api/v1/offers/:id/decline
GET  /api/v1/bookings/:id/agreement
GET  /api/v1/bookings/:id/agreement?format=pdf
POST /api/v1/bookings/:id/agreement/sign
POST /api/v1/bookings/:id/checkin-verify
POST /api/v1/family/invite
GET  /api/v1/family/student-status?token=
POST /api/v1/family/check-in-request
GET  /api/v1/academic-calendar
PUT  /api/v1/admin/academic-calendar
POST /api/v1/group-bookings
GET  /api/v1/group-bookings/:id
POST /api/v1/group-bookings/:id/join
PUT  /api/v1/group-bookings/:id/confirm
GET  /api/v1/students/:id/trust-score
GET  /api/v1/api-marketplace/plans
GET  /api/v1/api-marketplace/admin/partners
POST /api/v1/api-marketplace/admin/partners
GET  /api/v1/operations/job-logs
GET  /api/v1/map/heatmap?city=Islamabad&type=complaints
```

V6 frontend bindings:

```txt
/hostels/:slug                    DNA score, Pulse, mess menu ratings, live-board link
/hostels/:slug/live-board         SSE-backed live availability board
/rooms/:id                        match score, vacancy forecast, rent negotiation, budget planner
/rooms?budgetMode=true            budget-mode search with monthly cost chips
/dashboard/student/services       family invite, group booking, agreement signing, check-in verification, utility split
/dashboard/student/services       alumni stay linking and alumni referral points
/dashboard/student/profile        trust score and budget planner
/host/dashboard?tab=Smart Finance host P&L, cashflow, portfolio finance, utility bill splitter
/host/dashboard?tab=Offers        rent offer accept/counter/decline
/host/dashboard?tab=Mess Menu     mess menu publishing and rating monitor
/admin?tab=Growth Ops             academic calendar, API marketplace, job logs
/admin?tab=Community              complaints heatmap and improvement-mode layer
/parent/:token                    family status with Urdu/English toggle and check-in request
```

Study sessions:

```txt
GET  /api/v1/study-sessions
POST /api/v1/study-sessions
GET  /api/v1/study-sessions/hostel/:hostelId
POST /api/v1/study-sessions/:id/join
PUT  /api/v1/study-sessions/:id/complete
```

Bookings and payments:

```txt
POST /api/v1/bookings
GET  /api/v1/bookings/my
GET  /api/v1/bookings/refund-preview
GET  /api/v1/bookings/:id
GET  /api/v1/bookings/:id/cancellation-preview
GET  /api/v1/bookings/:id/checklist
GET  /api/v1/bookings/:id/checklist/pdf
PUT  /api/v1/bookings/:id/cancel
POST /api/v1/bookings/:id/token-pay
POST /api/v1/bookings/:id/rent-pay
POST /api/v1/bookings/:id/dispute
POST /api/v1/bookings/:id/report-off-platform
GET  /api/v1/bookings/:id/deposit
POST /api/v1/bookings/:id/deposit/accept
POST /api/v1/bookings/:id/deposit/dispute
POST /api/v1/bookings/:id/deposit/deduction
POST /api/v1/bookings/:id/deposit/refund
PUT  /api/v1/bookings/:id/deposit/resolve
POST /api/v1/payments/jazzcash/initiate
POST /api/v1/payments/jazzcash/callback
POST /api/v1/payments/easypaisa/callback
POST /api/v1/payments/stripe/create-intent
POST /api/v1/payments/stripe/webhook
POST /api/v1/payments/late-fee/:bookingId
POST /api/v1/payments/refund/:paymentId
GET  /api/v1/finance/ledger
GET  /api/v1/finance/reconciliation
```

Manual payments without a gateway:

```txt
POST /api/v1/manual-payments/challan
GET  /api/v1/manual-payments/my
POST /api/v1/manual-payments/:id/proof
GET  /api/v1/manual-payments/admin
POST /api/v1/manual-payments/:id/review
```

Student services and parent operations:

```txt
POST /api/v1/parent/share
GET  /api/v1/parent/portal/:token
POST /api/v1/parent/portal/:token/consent
GET  /api/v1/move-in-pass/:bookingId
POST /api/v1/move-in-pass/:bookingId/verify
GET  /api/v1/vendors
POST /api/v1/vendors/orders
GET  /api/v1/vendors/orders/my
GET  /api/v1/waitlist/rules
POST /api/v1/waitlist/rules
POST /api/v1/waitlist/rules/:id/run
PATCH /api/v1/waitlist/rules/:id
GET  /api/v1/ambassadors
POST /api/v1/ambassadors/apply
```

Host subscriptions and admin growth operations:

```txt
GET  /api/v1/subscriptions/plans
GET  /api/v1/subscriptions/host
POST /api/v1/subscriptions/host/invoices
POST /api/v1/subscriptions/host/invoices/:id/pay-manual
GET  /api/v1/subscriptions/admin
GET  /api/v1/field-verification/visits
POST /api/v1/field-verification/visits
PATCH /api/v1/field-verification/visits/:id/checklist
POST /api/v1/field-verification/visits/:id/submit
GET  /api/v1/vendors/admin/orders
GET  /api/v1/trust-ops/disputes/:id/timeline
GET  /api/v1/trust-ops/reviews/sentiment
GET  /api/v1/ambassadors/admin
PATCH /api/v1/ambassadors/admin/:id
```

V6 finance command-room APIs:

```txt
GET  /api/v1/finance/command-room
GET  /api/v1/finance/ledger/search
GET  /api/v1/finance/bookings/:id/waterfall
GET  /api/v1/finance/payouts
POST /api/v1/finance/payouts/:id/approve
POST /api/v1/finance/payouts/:id/retry
GET  /api/v1/finance/deposits/liability-register
GET  /api/v1/finance/statements/host/:hostId
POST /api/v1/finance/refunds/preview
POST /api/v1/refunds/preview
GET  /api/v1/finance/forecast
GET  /api/v1/wallet/credits
POST /api/v1/wallet/credits/apply
```

Discounts:

```txt
GET    /api/v1/discounts
POST   /api/v1/discounts
PUT    /api/v1/discounts/:id
DELETE /api/v1/discounts/:id
POST   /api/v1/discounts/validate
GET    /api/v1/discounts/applicable
POST   /api/v1/discounts/host-funded
```

Community suite:

```txt
GET  /api/v1/community/feed
POST /api/v1/community/feed
GET  /api/v1/community/admin/moderation
PUT  /api/v1/community/feed/:id/moderate
GET  /api/v1/community/roommate-requests
POST /api/v1/community/roommate-requests
PUT  /api/v1/community/roommate-requests/:id
GET  /api/v1/community/visits
POST /api/v1/community/visits
PUT  /api/v1/community/visits/:id/status
GET  /api/v1/community/move-in-checklist/:bookingId
PUT  /api/v1/community/move-in-checklist/:bookingId
GET  /api/v1/community/polls
POST /api/v1/community/polls
POST /api/v1/community/polls/:id/vote
GET  /api/v1/community/marketplace
POST /api/v1/community/marketplace
PUT  /api/v1/community/marketplace/:id/status
GET  /api/v1/community/lost-found
POST /api/v1/community/lost-found
PUT  /api/v1/community/lost-found/:id/claim
GET  /api/v1/community/agreements/:bookingId
POST /api/v1/community/agreements/:bookingId/sign
GET  /api/v1/community/nudges
GET  /api/v1/community/verification-badge
GET  /api/v1/community/leaderboard
POST /api/v1/maintenance/:id/rating
```

Dashboards:

```txt
GET /api/v1/dashboard/student
GET /api/v1/dashboard/student/bookings
GET /api/v1/dashboard/student/profile
PUT /api/v1/dashboard/student/profile
GET /api/v1/dashboard/host
GET /api/v1/dashboard/host/plan
PUT /api/v1/dashboard/host/plan
GET /api/v1/dashboard/host/risk
GET /api/v1/dashboard/host/tenants
GET /api/v1/dashboard/host/finance
GET /api/v1/dashboard/admin
GET /api/v1/dashboard/admin/finance
GET /api/v1/dashboard/admin/risk
GET /api/v1/dashboard/admin/discounts
GET /api/v1/dashboard/admin/loyalty-claims
PUT /api/v1/dashboard/admin/loyalty-claims/:id/approve
PUT /api/v1/dashboard/admin/loyalty-claims/:id/reject
GET /api/v1/dashboard/admin/platform-settings
PUT /api/v1/dashboard/admin/platform-settings
POST /api/v1/dashboard/admin/management-fees/invoice
```

V6 Host growth APIs:

```txt
GET   /api/v1/host/growth-coach
GET   /api/v1/host/pricing/suggestions
GET   /api/v1/host/availability-calendar
PATCH /api/v1/host/rooms/bulk
GET   /api/v1/host/tenants/:id/profile
GET   /api/v1/host/reply-templates
GET   /api/v1/host/reputation
```

V6 admin trust and AI APIs:

```txt
GET   /api/v1/admin/trust-queue
GET   /api/v1/admin/safety/incidents
POST  /api/v1/admin/safety/incidents
POST  /api/v1/admin/verification-visits
GET   /api/v1/admin/policy-rules
PATCH /api/v1/admin/policy-rules/:ruleKey
GET   /api/v1/admin/moderation/:id/explain
GET   /api/v1/admin/city-scorecard

POST  /api/v1/ai/student-concierge
POST  /api/v1/ai/listing-description
POST  /api/v1/ai/finance/anomaly
POST  /api/v1/ai/disputes/:id/summary
POST  /api/v1/ai/reviews/classify
```

Student engagement:

```txt
GET    /api/v1/engagement/compare
GET    /api/v1/engagement/roommate-profile
POST   /api/v1/engagement/roommate-profile
GET    /api/v1/engagement/saved-searches
POST   /api/v1/engagement/saved-searches
GET    /api/v1/engagement/saved-searches/alerts
DELETE /api/v1/engagement/saved-searches/:id
GET    /api/v1/engagement/activities
POST   /api/v1/engagement/activities
POST   /api/v1/engagement/activities/:id/join
POST   /api/v1/engagement/activities/:id/contribute
GET    /api/v1/engagement/loyalty
POST   /api/v1/engagement/loyalty/referrals
POST   /api/v1/engagement/loyalty/claims
```

V6 student decision APIs:

```txt
POST /api/v1/recommendations/match-quiz
GET  /api/v1/recommendations/similar/:roomId
GET  /api/v1/recommendations/explain/:roomId
POST /api/v1/rooms/compare
POST /api/v1/tools/cost-estimator
POST /api/v1/tools/rent-split
POST /api/v1/roommates/score
POST /api/v1/search-alerts
GET  /api/v1/shortlists
POST /api/v1/shortlists/share
GET  /api/v1/shortlists/:token
DELETE /api/v1/shortlists/:id
GET  /api/v1/campus-groups
POST /api/v1/visits
GET  /api/v1/move-in/checklist
POST /api/v1/routes/move-in
GET  /api/v1/routes/saved
```

Activity contributions are tracked separately from booking rent/deposit escrow. They are for group plans such as trips, sports, dining, or study outings and should not be treated as rental payments.

Referral loyalty behavior:

- Default award: `1,000` loyalty points per successful referral.
- Default claim threshold: `5,000` loyalty points.
- Admin approval range: `5%` to `10%` discount on the next room booking.
- Approved claims create a one-use `LOYALTY` coupon that can be entered on the booking screen.
- These values are admin-manageable from the platform settings API.

Global alerts:

```txt
GET  /api/v1/alerts/active?audience=students&city=Islamabad&university=NUST
POST /api/v1/alerts
POST /api/v1/alerts/:id/ack
GET  /api/v1/alerts/admin
POST /api/v1/alerts/admin
PUT  /api/v1/alerts/admin/:id/approve
PUT  /api/v1/alerts/admin/:id/reject
```

Student/Host submitted alerts are saved as `pending` and require admin approval. Admin-created alerts publish immediately. Alerts can be global or targeted by `audience`, `city`, `university`, and `hostelId`; alerts with `ackRequired=true` can be acknowledged from the dashboard/support screens. Published alerts display on matching screens, then expire automatically after the configured display window, default `48` hours.

Maintenance, safety, and operations:

```txt
GET  /api/v1/maintenance/my
POST /api/v1/maintenance
PUT  /api/v1/maintenance/:id/status
GET  /api/v1/maintenance/admin

GET  /api/v1/operations/health
GET  /api/v1/operations/audit-logs
GET  /api/v1/operations/document-checks
POST /api/v1/operations/document-checks/:id/review
GET  /api/v1/operations/listing-quality

GET  /api/v1/reviews/admin/moderation
PUT  /api/v1/reviews/:id/moderate
```

Students use `/dashboard/student/support` for emergency contact, targeted alert acknowledgement, maintenance tickets, and refund previews. Hosts/owners use the Maintenance tab to update tickets, block beds for repairs, and mark a seat "Booked (Offline)" for cash/walk-in bookings (reversible via Release). Wardens use `/warden/dashboard` for the same booked/release toggle, scoped to their assigned block(s) only. Admins use the Operations tab for health checks, audit logs, KYC/OCR checks, listing quality scores, review moderation, and all maintenance tickets.

Documents:

```txt
GET /api/v1/documents/bookings/:id/receipt
GET /api/v1/documents/bookings/:id/confirmation
GET /api/v1/documents/bookings/:id/rent-ledger
GET /api/v1/documents/confirmation/:bookingId
GET /api/v1/documents/receipt/:paymentId/download
GET /api/v1/documents/ledger/:studentId
GET /api/v1/documents/certificate/:studentId
GET /api/v1/documents/payout/:payoutId/download
GET /api/v1/documents/earnings/:hostId
GET /api/v1/documents/late-fee/:feeId
GET /api/v1/documents/deposit/:bookingId/receipt
GET /api/v1/documents/deposit/:bookingId/refund-notice
GET /api/v1/documents/hosts/monthly-summary
GET /api/v1/documents/hosts/agreement
GET /api/v1/documents/hosts/:hostId/approval-letter
GET /api/v1/documents/disputes/:id/resolution
GET /api/v1/documents/dispute/:disputeId
GET /api/v1/documents/verify/:receiptId
GET /api/v1/verify/:receiptId
```

Admin reports:

```txt
GET /api/v1/admin/reports/commission?format=json|csv|pdf
GET /api/v1/admin/reports/overdue?format=json|csv|pdf
GET /api/v1/admin/reports/city-performance
```

Chat, notifications, reminders:

```txt
GET  /api/v1/chat/threads
GET  /api/v1/chat/threads/:id/messages
POST /api/v1/chat/messages
GET  /api/v1/notifications
PUT  /api/v1/notifications/:id/read
POST /api/v1/notifications/mark-all-read
POST /api/v1/notifications/push/subscribe
DELETE /api/v1/notifications/push/:id
POST /api/v1/reminders/rent
POST /api/v1/reminders/overdue
POST /api/v1/reminders/payout
POST /api/v1/reminders/daily
POST /api/v1/reminders/host/:bookingId
```

For production cron, set `CRON_SECRET` and call reminder endpoints with the header:

```txt
x-cron-secret: your-cron-secret
```

Recommended daily schedule: run `POST /api/v1/reminders/daily` at `09:00 Asia/Karachi`. It runs 7-day reminders, 1-day reminders, overdue late-fee processing, and escrow payout release checks.

## Validation Commands

Backend syntax check:

```bash
npm run test --prefix server
```

Frontend lint:

```bash
npm run lint --prefix client
```

Frontend production build:

```bash
npm run build --prefix client
```

Responsive UI validation:

```bash
npm run dev
npm run validate:ui
```

E2E smoke validation for receipt verification, student off-platform report, and admin risk queue:

```bash
npm run test:e2e
```

The UI validator needs Microsoft Edge or Chrome installed, or set:

```powershell
$env:PLAYWRIGHT_CHROMIUM_PATH="C:\Path\To\chrome.exe"
```

For alternate ports:

```powershell
$env:VALIDATE_SITE_URL="http://localhost:5174"
$env:VALIDATE_API_URL="http://localhost:5001/api/v1"
npm run validate:ui
```

## Contact Gating Rules

- Public listing pages show masked Host identity and no direct phone/email/WhatsApp before booking.
- Paid confirmed bookings reveal Host contact details.
- Chat messages containing phone numbers, emails, URLs, WhatsApp references, bank transfer instructions, or external payment wording are masked and flagged.
- Listing submissions with contact leaks are rejected before review/publishing.

## Production Notes

- Replace demo gateway handlers with real JazzCash/EasyPaisa/Stripe webhook verification before accepting real payments.
- Use a real escrow/accounting provider before handling real customer funds.
- Use strong `JWT_SECRET` and rotate credentials.
- Restrict CORS through `CLIENT_URL`.
- Configure secure upload storage and malware scanning for documents.
- Keep admin/finance routes behind real RBAC and audit logs.
