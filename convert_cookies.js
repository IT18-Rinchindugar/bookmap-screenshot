// One-off local helper: converts a Cookie-Editor JSON export into the
// Playwright storageState format capture.js expects (youtube_auth.json).
// Run after logging into the throwaway account in a normal (non-automated)
// browser and exporting cookies for youtube.com via the Cookie-Editor
// extension — Google blocks Playwright-driven browsers from completing
// login directly, so the login step has to happen outside of automation.
const fs = require("fs");
const path = require("path");

const IN_FILE = path.join(__dirname, "cookies_export.json");
const OUT_FILE = path.join(__dirname, "youtube_auth.json");

const raw = JSON.parse(fs.readFileSync(IN_FILE, "utf8"));

const cookies = raw.map((c) => ({
  name: c.name,
  value: c.value,
  domain: c.domain,
  path: c.path || "/",
  expires: c.expirationDate ? Math.floor(c.expirationDate) : -1,
  httpOnly: !!c.httpOnly,
  secure: !!c.secure,
  sameSite: c.sameSite === "no_restriction" ? "None" : c.sameSite === "lax" ? "Lax" : c.sameSite === "strict" ? "Strict" : "Lax",
}));

fs.writeFileSync(OUT_FILE, JSON.stringify({ cookies, origins: [] }, null, 2));
console.log(`Wrote ${cookies.length} cookies to ${OUT_FILE}`);
