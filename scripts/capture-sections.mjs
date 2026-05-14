import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "_docs/_tmp/captures");
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const BASE = process.env.BASE_URL ?? "http://localhost:3001";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

await page.goto(`${BASE}/ko`, { waitUntil: "networkidle", timeout: 30000 });

// 1) Hero (above fold)
await page.screenshot({ path: path.join(OUT, "ko-hero.png"), fullPage: false });

// 2) Stats + courses
await page.evaluate(() => window.scrollTo(0, 900));
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, "ko-courses.png"), fullPage: false });

// 3) Intro + teachers
await page.evaluate(() => window.scrollTo(0, 1800));
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, "ko-intro.png"), fullPage: false });

// 4) Testimonials + news
await page.evaluate(() => window.scrollTo(0, 2800));
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, "ko-reviews.png"), fullPage: false });

// 5) Footer
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, "ko-footer.png"), fullPage: false });

await browser.close();
console.log("done");
