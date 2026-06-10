// 출석 버그 진단 — 프로덕션 어드민에서 학생/반/출석 데이터 읽기 (read-only)
import { chromium } from "playwright";

const BASE = "https://danang-academy.vercel.app";
const EMAIL = "owner-beta@test.com";
const PASSWORD = "Beta!2026";

const browser = await chromium.launch();
const page = await browser.newPage();

try {
  await page.goto(`${BASE}/ko/login`, { waitUntil: "networkidle" });
  // 교사/관리자 탭 선택 (학생 탭이 기본일 수 있음)
  const tabs = page.locator('[role="tab"]');
  const tabCount = await tabs.count();
  console.log("== login tabs:", tabCount);
  for (let i = 0; i < tabCount; i++) {
    console.log("  tab", i, ":", (await tabs.nth(i).innerText()).trim());
  }
  // 이메일 입력란이 있는 탭으로
  if (!(await page.locator('input[name="email"]').isVisible().catch(() => false))) {
    await tabs.last().click();
    await page.waitForTimeout(500);
  }
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/admin**", { timeout: 15000 });
  console.log("== logged in, url:", page.url());

  // 학생 명단
  await page.goto(`${BASE}/ko/admin/students`, { waitUntil: "networkidle" });
  const studentRows = await page.locator("table tbody tr").allInnerTexts();
  console.log("== STUDENTS (" + studentRows.length + ") ==");
  for (const r of studentRows) console.log(r.replace(/\t/g, " | ").replace(/\n/g, " | "));

  // 반 목록
  await page.goto(`${BASE}/ko/admin/classes`, { waitUntil: "networkidle" });
  const classRows = await page.locator("table tbody tr").allInnerTexts();
  console.log("== CLASSES (" + classRows.length + ") ==");
  for (const r of classRows) console.log(r.replace(/\t/g, " | ").replace(/\n/g, " | "));

  // 출석 기록/시도
  await page.goto(`${BASE}/ko/admin/attendance`, { waitUntil: "networkidle" });
  await page.screenshot({ path: "/tmp/attendance-admin.png", fullPage: true });
  const attBody = await page.locator("main").innerText();
  console.log("== ATTENDANCE PAGE ==");
  console.log(attBody.slice(0, 3000));
} catch (e) {
  console.error("FAILED:", e.message);
  await page.screenshot({ path: "/tmp/diagnose-fail.png", fullPage: true });
} finally {
  await browser.close();
}
