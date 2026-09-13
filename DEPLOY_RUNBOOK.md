# Basera — Deploy Runbook

*Prepared August 22, 2026*

This documents exactly what's already provisioned under your accounts, and the remaining manual steps. Everything below was created via your connected Railway, MongoDB Atlas, and Netlify accounts. Nothing was deployed live yet — the code with all of today's changes lives only in this local project folder, and pushing it to a Git host + triggering the actual build both require a working shell, which was unavailable this session (see the summary at the end).

## 1. What's already provisioned

**MongoDB Atlas**
- Organization: `Own` (`6a7c188236e3f8cc27efe7be`)
- Project: `Basera` (`6a89db849df2d023a16e7a63`)
- Cluster: `basera-cluster` — free tier (M0), AWS, `us-east-1`
- Database user: `basera_app` / password `RU_5uPdLmKFZgzFr_WSMKw` (readWrite on the `basera` database only — treat this as a secret, rotate it in Atlas → Database Access if it's ever pasted somewhere insecure)
- Connection string (already placed in Railway, see below):
  `mongodb+srv://basera_app:RU_5uPdLmKFZgzFr_WSMKw@basera-cluster.ynpgh7e.mongodb.net/basera?retryWrites=true&w=majority`
- Network Access is open to `0.0.0.0/0`, approved in chat on August 22, 2026 — connections still require the username/password above. Tighten later from Atlas → Network Access if desired.

**Railway (backend API)**
- Project: `Basera` (`725ed215-9c97-43ae-8387-f6bf56e802f7`)
- Service: `basera-api` (`d284ac4c-7eeb-4284-9fdb-aba6f7254176`)
- Public domain (already generated): `https://basera-api-production.up.railway.app`
- Environment variables already set: `NODE_ENV`, `PORT`, `MONGO_URI`, `MONGO_MAX_POOL_SIZE`, `MONGO_MIN_POOL_SIZE`, `CLIENT_URL`, `PUBLIC_APP_URL`, `ALLOW_DEMO_MODE=false`, `RATE_LIMIT_DISABLED=false`, `JWT_EXPIRES_IN`, `EMAIL_FROM`, `SUPPORT_EMAIL`, `SUPPORT_WHATSAPP`, `ESCROW_HOLD_HOURS`, `COMMISSION_RATE_DEFAULT`, `STUDENT_SERVICE_FEE_PKR`, `LATE_FEE_PKR`, `DEPOSIT_PROTECTION_FEE_RATE`, `DEPOSIT_PROTECTION_FEE_CAP_PKR`, `OFF_PLATFORM_REPORT_CREDIT_PKR`, `BASERA_MANAGEMENT_FEE_PKR`, `RICKSHAW_FARE_PER_KM`, `REFUND_POLICY_VERSION`, `MAP_CACHE_TTL_HOURS`, `OSRM_BASE_URL`, `OVERPASS_BASE_URL`, `AI_PROVIDER`
- **Not yet done — no source code attached.** The service exists but is empty; it has nothing to run yet. See step 2 below.
- **Secrets you still need to add** in Railway → basera-api → Variables (never share these with me in chat — add them directly in the dashboard): `JWT_SECRET`, `CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET`, `CLAUDE_API_KEY` (activates real AI features), `OCR_API_KEY` + `OCR_PROVIDER=google-vision`, payment gateway keys when ready (`JAZZCASH_*`, `EASYPAISA_*`, `STRIPE_*`), `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`, `CRON_SECRET`.

**Netlify (frontend)**
- Site: `basera-pk` (`187cf2e5-2838-41c8-9687-6f3be6fa0f63`)
- URL (once deployed): `https://basera-pk.netlify.app`
- Environment variables already set: `VITE_API_URL=https://basera-api-production.up.railway.app/api/v1`, `VITE_SITE_URL=https://basera-pk.netlify.app`, `VITE_ALLOW_DEMO_FALLBACK=false`, `VITE_SUPPORT_WHATSAPP`
- **Two vars need manual entry** — connector hiccups stopped `VITE_ENABLE_CLIENT_DEMO_LOGIN=false` from saving originally, and the new `VITE_SHOW_DEMO_BUTTONS` (added this session, gates the Quick Demo Login buttons on the login page — leave it `false`/unset in production). Add both in Netlify → Site configuration → Environment variables.
- `netlify.toml` at the repo root (base=`client`, build=`npm install && npm run build`, publish=`client/dist`, SPA redirect, security headers) is in this project folder already.
- **Not yet done — no deploy triggered.**

## 2. Push today's code changes somewhere Railway/Netlify can build from

All of today's rebrand, bug fixes, and new features exist only in this local project folder (now `basera/`) — I don't have a working shell this session, so I can't run `git add/commit/push` myself. From your own machine (with Git and Node installed):

```bash
cd path\to\basera
git init   # only if this folder isn't already a git repo
git add -A
git commit -m "Rebrand to Basera, bug fixes, new features"
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

If this folder already has a `.git` history pointed at a repo you don't control, run `git remote set-url origin https://github.com/<your-username>/<your-repo>.git` first instead of `git remote add`.

## 3. Connect Railway and Netlify to the pushed repo

**Railway:** In the Railway dashboard, open the `Basera` project → `basera-api` service → Settings → Source, and connect it to your GitHub repo (root/working directory relying on `railway.json`'s `startCommand: npm run start --prefix server`, already configured for this monorepo layout). Once connected, Railway auto-deploys. Alternatively, tell me the exact `owner/repo` once it's pushed and I can trigger the first deploy for you via the Railway tools connected here.

**Netlify:** In the Netlify dashboard, open `basera-pk` → Site configuration → Build & deploy → Link repository, connect the same GitHub repo. `netlify.toml` already tells it to build from `/client` with the right publish directory.

## 4. Seed demo data (optional but recommended)

Once `MONGO_URI` is reachable and the backend is deployed, run the seed script once:

```bash
npm run seed --prefix server
```

This populates the demo accounts documented in `README.md` (`student@basera.pk`, `landlord@basera.pk`, `owner@basera.pk`, `admin@basera.pk`, `warden@basera.pk`, all `password123`) into the real database.

## 5. Verify

- Backend health check: `https://basera-api-production.up.railway.app/api/v1/health`
- Frontend: `https://basera-pk.netlify.app`
- Confirm the homepage loads real listings, the AI concierge responds (once `CLAUDE_API_KEY` is set), and a demo login/booking flow works end to end.
- Confirm the login page does NOT show demo credentials text or Quick Demo Login buttons unless `VITE_SHOW_DEMO_BUTTONS=true` is explicitly set — check this especially carefully in production.

## 6. What's still blocked on my end

My sandbox's shell has been down for multiple sessions (host disk-space issue), which means I could not: run `npm run build`/`npm run lint` to verify the code compiles cleanly, run `git` to push these changes anywhere, take live screenshots of the running app, or generate a native `.pptx`/verify documents with LibreOffice. Everything above was done through direct file edits (verified by careful re-reading, not an actual build) and through your connected Railway/Atlas/Netlify accounts' own APIs, which don't depend on my shell. Once the shell is back, I can finish steps 2–5 myself end-to-end rather than handing them to you.
