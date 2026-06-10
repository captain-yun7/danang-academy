// 프로덕션 스모크 테스트 공용 헬퍼
import { chromium } from "playwright";

export const BASE = "https://danang-academy.vercel.app";

export async function adminLogin(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/ko/login`, { waitUntil: "networkidle" });
  const tabs = page.locator('[role="tab"]');
  if (!(await page.locator('input[name="email"]').isVisible().catch(() => false))) {
    await tabs.last().click();
    await page.waitForTimeout(400);
  }
  await page.fill('input[name="email"]', "owner-beta@test.com");
  await page.fill('input[name="password"]', "Beta!2026");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/admin**", { timeout: 15000 });
  return { ctx, page };
}

export async function studentLogin(browser, code, password, ctxOpts = {}) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/ko/login`, { waitUntil: "networkidle" });
  // 학생 탭이 기본
  await page.fill('input[name="studentCode"]', code);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/student**", { timeout: 15000 });
  return { ctx, page };
}
