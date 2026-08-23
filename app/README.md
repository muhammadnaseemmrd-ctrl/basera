# Basera App (Expo / React Native)

A companion mobile app for [Basera](../README.md) (formerly HostelHub), the Pakistani
student-housing marketplace. This is a separate Expo/React Native project that talks to
the **same backend REST API** as the existing web client (`../client`) — it does not
duplicate any server logic.

- Backend API: `../server` (Node/Express, base path `/api/v1`)
- Web client (for reference/parity): `../client` (React/Vite)
- This app: `../app` (Expo/React Native)

## Important: this was authored without running npm install

This project was hand-authored as plain source files in a session where no shell/build
tool was available — nothing here has been installed or run yet. Treat the dependency
versions in `package.json` as **authored from knowledge, not verified by an actual
install**. Before relying on this app, do a first-run pass:

```bash
cd app
npm install
```

If `npm install` reports peer-dependency or version-resolution errors, run:

```bash
npx expo install --fix
```

`expo install --fix` will align every Expo-managed package (`react`, `react-native`,
`react-native-screens`, `react-native-safe-area-context`, `expo-status-bar`, etc.) to the
versions expected by the installed Expo SDK. This is the fastest way to fix any version
mismatches introduced by hand-authoring `package.json` instead of running `expo install`.

## What's here

```txt
app/
  App.js                        Root component: SafeAreaProvider + NavigationContainer + RootNavigator
  app.json                      Expo config (name, icons, bundle ids, brand colors)
  babel.config.js               babel-preset-expo
  .env.example                  EXPO_PUBLIC_API_URL template
  src/
    api/client.js                axios instance + AsyncStorage token interceptor + safeRequest()
    store/useAuthStore.js        Zustand auth store (login/register/logout/loadStoredAuth)
    theme/colors.js               Brand palette (mirrors client/tailwind.config.js)
    navigation/                  RootNavigator, AuthNavigator, MainTabNavigator
    screens/                     Home, Search, Saved, Bookings, Profile, ListingDetail, Booking, ComingSoon, auth/Login, auth/Register
    components/                  ListingCard, Badge, Button
```

## Install and run

Requires Node.js (LTS, e.g. Node 20) and the Expo CLI (installed automatically via
`npx`). You'll also need Expo Go on a physical phone, or an Android/iOS simulator, to
actually see the app running.

```bash
cd app
npm install
copy .env.example .env        # Windows; use `cp .env.example .env` on macOS/Linux
```

Edit `.env` and set `EXPO_PUBLIC_API_URL`:

- Deployed backend: `EXPO_PUBLIC_API_URL=https://basera-api-production.up.railway.app/api/v1`
  (once the Railway backend described in `../README.md` is actually deployed)
- Local backend, simulator on the same machine: `EXPO_PUBLIC_API_URL=http://localhost:5000/api/v1`
- Local backend, **physical phone**: `localhost` on your phone refers to the phone
  itself, not your dev machine, so it will not reach a locally-running server. Use your
  computer's LAN IP instead, e.g. `EXPO_PUBLIC_API_URL=http://192.168.1.23:5000/api/v1`
  (find your IP with `ipconfig` on Windows). Make sure the phone and dev machine are on
  the same Wi-Fi network and that `server/.env`'s `CLIENT_URL`/CORS setup allows it.

Then start the dev server:

```bash
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS), or press `a`/`i` in the
terminal to launch an Android/iOS emulator, or `w` for the web build.

Expo's environment variable convention requires the `EXPO_PUBLIC_` prefix for any value
that should be readable from client code (this app's equivalent of the web client's
`VITE_` prefix) — that's why `.env.example` uses `EXPO_PUBLIC_API_URL` rather than
`VITE_API_URL`.

## Still needed before this is a polished, shippable app

1. **App icon and splash screen PNGs.** `app.json` references `./assets/icon.png` and
   `./assets/splash.png`, but no `assets/` folder or binary image files were created this
   session (this session could only write plain text files). Export PNGs from the
   existing web assets at `../client/public/logo.svg` and `../client/public/favicon.svg`
   (e.g. via Figma, Inkscape, or an online SVG-to-PNG tool) and save them as:
   - `app/assets/icon.png` — 1024x1024, square, no transparency for iOS
   - `app/assets/splash.png` — e.g. 1284x2778 or any large canvas; `resizeMode: contain`
     with `backgroundColor: #FFF8F5` is already configured in `app.json`
2. **Run `npm install` and fix any dependency-resolution errors** as noted above.
3. **Wire up a real "Saved" flow.** `SavedScreen.js` reads `GET /shortlists`, but no
   screen in this app yet lets a student add an item to their shortlist — only the web
   app currently exposes that action. Add a "save" affordance to `ListingCard`/
   `ListingDetailScreen` if you want saves to work end-to-end from mobile.
4. **Booking flow is a stub.** `BookingScreen.js` intentionally only collects a move-in
   date, duration, and special requests, then calls `POST /bookings`. The web app's full
   flow (payment method, instalment plan, discount codes, deposit protection opt-in) was
   left out by design per the mobile scope for this pass — extend it if/when mobile needs
   payments.
5. **Coming Soon features are intentional stubs.** Rider Booking, Food Ordering, and Job
   Seeker (reachable from the Profile tab) all navigate to the shared
   `ComingSoonScreen.js` placeholder and have no backend integration. They're
   future-roadmap items, not bugs.

## Auth/token conventions (kept consistent with the web client)

- Token storage key: `basera_token` (AsyncStorage here, `localStorage` on web)
- User cache key: `basera_user`
- `src/api/client.js` attaches `Authorization: Bearer <token>` to every request via an
  axios request interceptor, reading the token from AsyncStorage — same shape as
  `client/src/services/api.js`'s interceptor, adapted for RN's async storage API.
- `safeRequest(requestFn, fallback)` mirrors `client/src/services/api.js`'s helper: on
  any request failure it returns `fallback` instead of throwing, so screens degrade
  gracefully (empty lists, cached data) rather than crashing when the API is unreachable.
  Unlike the web client, this app has no client-side demo-login concept, so there's no
  `isDemoToken` check here.

## Demo accounts

Same accounts as the web app (see `../README.md`), once pointed at a backend that has
demo data seeded or `MONGO_URI` configured:

```txt
password123

Student:     student@basera.pk
Host:        landlord@basera.pk
Hostel Host: owner@basera.pk
Admin:       admin@basera.pk
```

This app only builds student-facing screens (Home/Search/Saved/Bookings/Profile), so
only the student account is directly relevant here.
