const { chromium } = require("playwright-core");
const fs = require("fs");

const executableCandidates = [
  process.env.PLAYWRIGHT_CHROMIUM_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"
].filter(Boolean);

const siteUrl = process.env.VALIDATE_SITE_URL || "http://localhost:5173";
const apiUrl = process.env.VALIDATE_API_URL || "http://localhost:5000/api/v1";

const credentials = {
  student: { email: "student@basera.pk", password: "password123" },
  admin: { email: "admin@basera.pk", password: "password123" }
};

const findBrowser = () => executableCandidates.find((candidate) => fs.existsSync(candidate));

async function getDemoAuth(role) {
  const response = await fetch(`${apiUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials[role])
  });
  if (!response.ok) throw new Error(`${role} login failed with status ${response.status}`);
  return response.json();
}

async function authenticatedContext(browser, role) {
  const auth = await getDemoAuth(role);
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem("basera_token", token);
    localStorage.setItem("basera_user", JSON.stringify(user));
  }, auth);
  return context;
}

async function run() {
  const executablePath = findBrowser();
  if (!executablePath) throw new Error("No Chromium-based browser found. Install Edge/Chrome or set PLAYWRIGHT_CHROMIUM_PATH.");

  const browser = await chromium.launch({ executablePath, headless: true });

  const publicPage = await browser.newPage();
  await publicPage.goto(`${siteUrl}/verify/HHV-demo`, { waitUntil: "domcontentloaded" });
  await publicPage.getByText("Receipt Verification").waitFor({ timeout: 10000 });
  await publicPage.close();

  const studentContext = await authenticatedContext(browser, "student");
  const studentPage = await studentContext.newPage();
  await studentPage.goto(`${siteUrl}/dashboard/student/bookings`, { waitUntil: "domcontentloaded" });
  await studentPage.getByRole("button", { name: /report direct pay/i }).first().click();
  await studentPage.getByText(/report recorded|report submitted/i).waitFor({ timeout: 10000 });
  await studentContext.close();

  const adminContext = await authenticatedContext(browser, "admin");
  const adminPage = await adminContext.newPage();
  await adminPage.goto(`${siteUrl}/admin`, { waitUntil: "domcontentloaded" });
  await adminPage.getByText("Risk").click();
  await adminPage.getByText("Host Risk Queue").waitFor({ timeout: 10000 });
  await adminContext.close();

  await browser.close();
  console.log("E2E smoke passed: receipt verify, student safety report, and admin risk queue.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
