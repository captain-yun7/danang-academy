import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "_docs/_tmp/captures");
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const TARGETS = [
  ["home", "/ko"],
  ["home-vi", "/vi"],
  ["about", "/ko/about"],
  ["teachers", "/ko/teachers"],
  ["news", "/ko/news"],
  ["free-pronunciation", "/ko/free-pronunciation"],
  ["placement", "/ko/placement"],
  ["consult", "/ko/consult"],
  ["contact", "/ko/contact"],
  ["login", "/ko/login"],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();

for (const [name, p] of TARGETS) {
  try {
    await page.goto(`${BASE}${p}`, { waitUntil: "networkidle", timeout: 30000 });
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
    console.log(`✓ ${name} ← ${p}`);
  } catch (e) {
    console.log(`✗ ${name} ← ${p}: ${e.message}`);
  }
}

await browser.close();
console.log(`\n저장: ${OUT}`);
