const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const executableCandidates = [
  process.env.PLAYWRIGHT_CHROMIUM_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"
].filter(Boolean);

const siteUrl = process.env.VALIDATE_SITE_URL || "http://localhost:5173";
const apiUrl = process.env.VALIDATE_API_URL || "http://localhost:5000/api/v1";

const demoCredentials = {
  student: { email: "student@basera.pk", password: "password123" },
  host: { email: "landlord@basera.pk", password: "password123" },
  hostelHost: { email: "owner@basera.pk", password: "password123" },
  admin: { email: "admin@basera.pk", password: "password123" }
};

const routes = [
  { name: "home", path: "/" },
  { name: "listings", path: "/hostels" },
  { name: "rooms", path: "/rooms?city=Lahore&roomType=PG&gender=girls" },
  { name: "rooms-budget-mode", path: "/rooms?city=Islamabad&budgetMode=true&maxPrice=45000" },
  { name: "room-detail", path: "/rooms/r7" },
  { name: "detail", path: "/hostels/cozy-boys-hostel-f-10" },
  { name: "live-board", path: "/hostels/cozy-boys-hostel-f-10/live-board" },
  { name: "city-comparison", path: "/compare-cities" },
  { name: "booking", path: "/booking" },
  { name: "room-booking", path: "/booking?room=r7" },
  { name: "verify-receipt", path: "/verify/HHV-demo" },
  { name: "host-onboarding", path: "/landlord/onboarding" },
  { name: "student-dashboard", path: "/dashboard/student", role: "student" },
  { name: "student-bookings", path: "/dashboard/student/bookings", role: "student" },
  { name: "student-payments", path: "/dashboard/student/payments", role: "student" },
  { name: "student-engagement", path: "/dashboard/student/engage", role: "student" },
  { name: "student-services", path: "/dashboard/student/services", role: "student" },
  { name: "student-community", path: "/dashboard/student/community", role: "student" },
  { name: "student-support", path: "/dashboard/student/support", role: "student" },
  { name: "student-profile", path: "/dashboard/student/profile", role: "student" },
  { name: "parent-portal", path: "/parent/HHP-DEMO" },
  { name: "host-dashboard", path: "/host/dashboard", role: "host" },
  { name: "host-subscription", path: "/host/dashboard?tab=Subscription", role: "host" },
  { name: "host-smart-finance", path: "/host/dashboard?tab=Smart%20Finance", role: "host" },
  { name: "host-offers", path: "/host/dashboard?tab=Offers", role: "host" },
  { name: "host-mess-menu", path: "/host/dashboard?tab=Mess%20Menu", role: "host" },
  { name: "hostel-host-dashboard", path: "/owner/dashboard", role: "hostelHost" },
  { name: "admin-dashboard", path: "/admin", role: "admin" },
  { name: "admin-growth-ops", path: "/admin?tab=Growth%20Ops", role: "admin" },
  { name: "admin-community", path: "/admin?tab=Community", role: "admin" },
  { name: "auth", path: "/login" }
];

const viewports = [
  ["desktop", { width: 1440, height: 1100 }],
  ["mobile", { width: 390, height: 844 }]
];

const findBrowser = () => executableCandidates.find((candidate) => fs.existsSync(candidate));

async function getDemoAuth(role) {
  const response = await fetch(`${apiUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(demoCredentials[role])
  });

  if (!response.ok) {
    throw new Error(`Demo ${role} login failed with status ${response.status}.`);
  }

  const data = await response.json();
  return { token: data.token, user: data.user };
}

async function waitForImages(page) {
  await page.evaluate(async () => {
    const images = Array.from(document.images);
    await Promise.all(
      images.map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise((resolve) => {
          const timeout = window.setTimeout(resolve, 2500);
          image.addEventListener("load", () => {
            window.clearTimeout(timeout);
            resolve();
          }, { once: true });
          image.addEventListener("error", () => {
            window.clearTimeout(timeout);
            resolve();
          }, { once: true });
        });
      })
    );
  });
}

async function run() {
  const executablePath = findBrowser();
  if (!executablePath) {
    throw new Error("No Chromium-based browser found. Install Microsoft Edge/Chrome or set PLAYWRIGHT_CHROMIUM_PATH.");
  }

  const outDir = path.join(process.cwd(), "validation-screenshots");
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ executablePath, headless: true });
  const results = [];

  for (const [viewportName, viewport] of viewports) {
    for (const route of routes) {
      const context = await browser.newContext({ viewport });
      if (route.role) {
        const auth = await getDemoAuth(route.role);
        await context.addInitScript(({ token, user }) => {
          localStorage.setItem("basera_token", token);
          localStorage.setItem("basera_user", JSON.stringify(user));
        }, auth);
      }

      const page = await context.newPage();
      const pageErrors = [];
      const consoleErrors = [];

      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });

      const response = await page.goto(`${siteUrl}${route.path}`, {
        waitUntil: "domcontentloaded",
        timeout: 30000
      });
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
      await waitForImages(page);
      await page.waitForTimeout(300);

      const metrics = await page.evaluate(() => ({
        title: document.title,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyHeight: document.body.scrollHeight,
        h1: document.querySelector("h1")?.innerText || "",
        panels: document.querySelectorAll(".panel").length,
        buttons: document.querySelectorAll("button,a").length
      }));

      const screenshot = `${viewportName}-${route.name}.png`;
      await page.screenshot({ path: path.join(outDir, screenshot), fullPage: true });

      results.push({
        viewport: viewportName,
        route: route.path,
        role: route.role || "public",
        status: response?.status(),
        screenshot,
        overflowX: metrics.scrollWidth > metrics.clientWidth + 1,
        ...metrics,
        pageErrors,
        consoleErrors: consoleErrors.slice(0, 5)
      });

      await page.close();
      await context.close();
    }
  }

  await browser.close();
  fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(results, null, 2));

  const failures = results.filter(
    (result) =>
      result.status !== 200 ||
      result.overflowX ||
      result.pageErrors.length ||
      result.consoleErrors.length
  );

  console.table(
    results.map((result) => ({
      viewport: result.viewport,
      route: result.route,
      status: result.status,
      overflowX: result.overflowX,
      title: result.title
    }))
  );

  if (failures.length) {
    console.error(JSON.stringify(failures, null, 2));
    process.exit(1);
  }

  console.log(`UI validation passed. Screenshots saved to ${outDir}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
