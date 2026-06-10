// 출석 플로우 모의 테스트 — 로컬 dev(3100) + 로컬 Postgres 대상
import { chromium } from "playwright";

const URL = "http://localhost:3100/vi/class/mocktesttoken1234567890abcdef";
const ACADEMY = { latitude: 16.04111, longitude: 108.21778 }; // 학원 좌표
const FARAWAY = { latitude: 16.16, longitude: 108.21778 }; // ~13km 북쪽

let pass = 0;
let fail = 0;
function check(name, cond, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    console.log(`  ❌ ${name} ${extra}`);
  }
}

const browser = await chromium.launch();

async function openPage(geo) {
  const ctx = await browser.newContext(
    geo ? { geolocation: geo, permissions: ["geolocation"], locale: "vi-VN" } : { locale: "vi-VN" }
  );
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  return { ctx, page };
}

async function search(page, q) {
  const input = page.locator("input");
  await input.fill("");
  await input.fill(q);
  await page.waitForTimeout(1300); // 디바운스 + 서버 액션
  return page.locator("ul li button").allInnerTexts();
}

// ── 1. 학원 위치에서: 검색 시나리오 ──────────────────────────
{
  console.log("[1] 학원 위치 (GPS OK) — 검색");
  const { ctx, page } = await openPage(ACADEMY);
  const heading = await page.locator("h1").innerText();
  check("세션 매칭 — 반 이름 표시", heading.includes("TEST"), `got: ${heading}`);

  let r = await search(page, "Bảo Hân");
  check("수강 대기 학생 이름 검색 (Bảo Hân)", r.some((t) => t.includes("Bảo Hân")), JSON.stringify(r));

  r = await search(page, "bao han");
  check("성조 없는 입력 (bao han)", r.some((t) => t.includes("Bảo Hân")));

  r = await search(page, "2026-0001");
  check("학번 검색 (2026-0001)", r.some((t) => t.includes("Bảo Hân")), JSON.stringify(r));

  r = await search(page, "2026-0001");
  check("결과 카드에 학번 표시", r.some((t) => t.includes("2026-0001")), JSON.stringify(r));

  r = await search(page, "Lê Quyên");
  check("수강중 학생 검색 (Lê Quyên)", r.some((t) => t.includes("Lê Quyên")));

  r = await search(page, "Hưu Học");
  check("휴학 학생은 미노출", r.length === 0, JSON.stringify(r));

  // ── 2. 출석 제출: 정상(present/late 판정 포함) ──
  console.log("[2] 출석 제출");
  await search(page, "Bảo Hân");
  await page.locator("ul li button").first().click();
  await page.waitForSelector("text=✓", { timeout: 15000 });
  const okText = await page.locator("main").last().innerText();
  check("출석 성공 화면 (Bảo Hân)", okText.includes("Bảo Hân"));
  // 세션 시작 -20분 → +10분 지각 기준 초과 → late 예상
  check("지각 판정 (시작 +20분)", okText.toLowerCase().includes("muộn") || okText.includes("지각"), okText.slice(0, 200));
  await ctx.close();
}

// ── 3. 같은 디바이스(같은 fp)로 다른 학생 → fp_dup ──
{
  console.log("[3] 같은 디바이스로 두 번째 학생");
  const { ctx, page } = await openPage(ACADEMY);
  await search(page, "Lê Quyên");
  await page.locator("ul li button").first().click();
  await page.waitForTimeout(4000);
  const text = await page.locator("main").last().innerText();
  check("디바이스 중복 차단 (fp_dup)", !text.includes("✓"), text.slice(0, 150));
  await ctx.close();
}

// ── 4. 이미 출석한 학생 재시도 → already ──
{
  console.log("[4] 이미 출석한 학생 재시도");
  const { ctx, page } = await openPage(ACADEMY);
  await search(page, "Bảo Hân");
  await page.locator("ul li button").first().click();
  await page.waitForTimeout(4000);
  const text = await page.locator("main").last().innerText();
  check("중복 출석 차단 (already)", !text.includes("✓") && /\d{2}:\d{2}/.test(text), text.slice(0, 150));
  await ctx.close();
}

// ── 5. 학원에서 먼 곳 → gps_out ──
{
  console.log("[5] 13km 떨어진 위치");
  const { ctx, page } = await openPage(FARAWAY);
  await search(page, "Lê Quyên");
  await page.locator("ul li button").first().click();
  await page.waitForTimeout(4000);
  const text = await page.locator("main").last().innerText();
  check("GPS 반경 밖 거부 (gps_out)", !text.includes("✓"), text.slice(0, 150));
  await ctx.close();
}

// ── 6. GPS 미등록 학원 → 위치 요청 없이 진행 ──
{
  console.log("[6] 학원 좌표 미등록 (GPS 스킵)");
  const { execSync } = await import("node:child_process");
  execSync(
    `docker exec danang-test-pg psql -U postgres -d main -c "update organizations set lat=null, lng=null"`
  );
  // 위치 권한 없는 컨텍스트 — gpsRequired=false면 바로 검색 가능해야 함
  const { ctx, page } = await openPage(null);
  const r = await search(page, "Lê Quyên");
  check("GPS 없이 검색 진행", r.some((t) => t.includes("Lê Quyên")), JSON.stringify(r));
  // 복원
  execSync(
    `docker exec danang-test-pg psql -U postgres -d main -c "update organizations set lat=16.04111, lng=108.21778"`
  );
  await ctx.close();
}

// ── 7. DB 기록 검증 ──
{
  console.log("[7] DB 기록 검증");
  const { execSync } = await import("node:child_process");
  const att = execSync(
    `docker exec danang-test-pg psql -U postgres -d main -tAc "select s.name || '|' || a.status from session_attendance a join students s on s.id=a.student_id order by a.marked_at"`
  ).toString().trim();
  console.log("  session_attendance:", att);
  check("출석 1건만 기록 (Bảo Hân, late)", att === "Bảo Hân|late", att);
  const logs = execSync(
    `docker exec danang-test-pg psql -U postgres -d main -tAc "select result || ':' || count(*) from attendance_attempts group by result order by result"`
  ).toString().trim();
  console.log("  attempts:", logs.replace(/\n/g, " / "));
}

await browser.close();
console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail > 0 ? 1 : 0);
