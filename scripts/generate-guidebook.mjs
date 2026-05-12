/**
 * 베타 가이드북 PPT 자동 생성 (v1)
 * - 고해상도(1600x900 @ 2x) 스크린샷
 * - 한국어 전용
 * - 이모지 제거 (앱 UI 안의 이모지는 그대로 둠)
 *
 * 사용:
 *   node --env-file=.env.local scripts/generate-guidebook.mjs
 *
 * 출력:
 *   _docs/guides/beta-guidebook-v1.pptx
 *   _docs/guides/screenshots/*.png
 */

import { chromium } from "playwright";
import PptxGenJS from "pptxgenjs";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, existsSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCREENSHOTS_DIR = path.join(ROOT, "_docs/guides/screenshots");
const PPT_PATH = path.join(ROOT, "_docs/guides/beta-guidebook-v1.pptx");

const BASE_URL = process.env.GUIDEBOOK_BASE_URL ?? "https://danang-academy.vercel.app";
const VIEWPORT = { width: 1600, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

if (!existsSync(SCREENSHOTS_DIR)) mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = neon(url);

const TEMP_EMAIL = "beta-demo@temp.local";
const TEMP_PASSWORD = randomBytes(12).toString("hex");

async function seedDemoData() {
  console.log("→ 데모 데이터 시드...");
  const hash = await bcrypt.hash(TEMP_PASSWORD, 10);
  const orgRows = await sql`select id::text from organizations where slug = 'danang' limit 1`;
  const orgId = orgRows[0].id;

  await sql`
    insert into users (email, password_hash, name, role, organization_id, email_verified)
    values (${TEMP_EMAIL}, ${hash}, 'Demo Admin', 'owner', ${orgId}, now())
    on conflict (email) do update set password_hash = excluded.password_hash, role = 'owner'
  `;

  const existing = await sql`
    select count(*)::int as cnt from students where organization_id = ${orgId} and name like 'Demo %'
  `;
  if (existing[0].cnt === 0) {
    const classes = await sql`
      insert into classes (name, level, schedule, capacity, recurring_pattern, organization_id)
      values
        ('Demo 중급반 A', 'intermediate', '월·수·금 19:00–21:00', 12,
         ${JSON.stringify({ days: ["mon","wed","fri"], start_time: "19:00", end_time: "21:00" })}::jsonb,
         ${orgId}),
        ('Demo 초급반 B', 'elementary', '화·목 18:00–20:00', 10,
         ${JSON.stringify({ days: ["tue","thu"], start_time: "18:00", end_time: "20:00" })}::jsonb,
         ${orgId})
      returning id::text, name
    `;
    const class1 = classes[0].id;
    await sql`
      insert into students (name, phone, native_language, korean_level, class_id, status, organization_id)
      values
        ('Demo 학생 응웬', '+84 111 222 333', 'vi', 'intermediate', ${class1}::uuid, 'active', ${orgId}),
        ('Demo 학생 팜', '+84 222 333 444', 'vi', 'elementary', ${classes[1].id}::uuid, 'active', ${orgId}),
        ('Demo 학생 김', '+84 333 444 555', 'other', 'intermediate', ${class1}::uuid, 'active', ${orgId}),
        ('Demo 학생 호아', '+84 444 555 666', 'vi', 'beginner', null, 'paused', ${orgId})
    `;
    await sql`
      insert into consult_leads (name, phone, source, recommended_level, status, note, organization_id)
      values
        ('Demo 리드 르엉', '+84 555 666 777', 'placement_test', 'intermediate', 'new', '발음 좋음', ${orgId}),
        ('Demo 리드 푸엉', '+84 666 777 888', 'pronunciation_test', 'beginner', 'contacted', '주말 수업 희망', ${orgId})
    `;
  }
}

async function cleanupDemoData() {
  console.log("→ 임시 어드민 정리...");
  await sql`delete from users where email = ${TEMP_EMAIL}`;
}

async function takeShot(page, filename, options = {}) {
  const filePath = path.join(SCREENSHOTS_DIR, `v1-${filename}.png`);
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(900);
  await page.screenshot({
    path: filePath,
    fullPage: options.fullPage ?? false,
  });
  console.log(`  ✓ v1-${filename}.png`);
  return filePath;
}

async function captureScreenshots() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const mobileContext = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    deviceScaleFactor: 3,
  });
  const mobile = await mobileContext.newPage();

  console.log("\n공개 페이지 캡처...");
  await page.goto(`${BASE_URL}/ko`);
  await takeShot(page, "01-home");
  await page.goto(`${BASE_URL}/ko/free-pronunciation`);
  await takeShot(page, "02-fpt-intro");
  await page.goto(`${BASE_URL}/ko/placement`);
  await takeShot(page, "03-pt-intro");
  await page.goto(`${BASE_URL}/ko/consult?level=intermediate`);
  await takeShot(page, "04-consult");

  await mobile.goto(`${BASE_URL}/ko/qr/sample-not-found-token`);
  await takeShot(mobile, "05-qr-mobile");

  console.log("\n어드민 로그인...");
  await page.goto(`${BASE_URL}/ko/login`);
  await page.fill("input[name=email]", TEMP_EMAIL);
  await page.fill("input[name=password]", TEMP_PASSWORD);
  await takeShot(page, "06-login");
  await page.click("button[type=submit]");
  await page.waitForURL(/\/admin/, { timeout: 15000 });

  console.log("\n어드민 페이지 캡처...");
  await page.goto(`${BASE_URL}/ko/admin`);
  await takeShot(page, "10-dashboard");

  await page.goto(`${BASE_URL}/ko/admin/students`);
  await takeShot(page, "11-students-list");

  await page.goto(`${BASE_URL}/ko/admin/students/new`);
  await takeShot(page, "12-student-new");

  const studentRows = await sql`select id::text from students where name = 'Demo 학생 응웬' limit 1`;
  if (studentRows[0]) {
    await page.goto(`${BASE_URL}/ko/admin/students/${studentRows[0].id}`);
    await takeShot(page, "13-student-detail");
  }

  await page.goto(`${BASE_URL}/ko/admin/classes`);
  await takeShot(page, "14-classes-list");

  await page.goto(`${BASE_URL}/ko/admin/classes/new`);
  await takeShot(page, "15-class-new");

  const classRows = await sql`select id::text from classes where name = 'Demo 중급반 A' limit 1`;
  if (classRows[0]) {
    await page.goto(`${BASE_URL}/ko/admin/classes/${classRows[0].id}`);
    await takeShot(page, "16-class-detail");
  }

  await page.goto(`${BASE_URL}/ko/admin/teachers`);
  await takeShot(page, "17-teachers");

  await page.goto(`${BASE_URL}/ko/admin/attendance`);
  await takeShot(page, "18-attendance");

  await page.goto(`${BASE_URL}/ko/admin/tests`);
  await takeShot(page, "19-tests");

  await page.goto(`${BASE_URL}/ko/admin/leads`);
  await takeShot(page, "20-leads");

  await page.goto(`${BASE_URL}/ko/admin/mcq`);
  await takeShot(page, "21-mcq");

  await browser.close();
  console.log("스크린샷 완료.\n");
}

function buildPpt() {
  console.log("PPT 조립...");
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE"; // 13.333" x 7.5"
  pres.author = "Da Nang K-Talk Lab";
  pres.title = "베타 가이드북 v1";

  const COLORS = {
    primary: "6366F1",
    accent: "22D3EE",
    dark: "0B1020",
    muted: "6B7280",
    light: "F5F3FF",
    border: "E5E7EB",
  };

  function shotPath(name) {
    return path.join(SCREENSHOTS_DIR, `v1-${name}.png`);
  }

  // 표지
  const cover = pres.addSlide();
  cover.background = { color: COLORS.dark };
  cover.addText("Da Nang K-Talk Lab", {
    x: 0.5, y: 1.7, w: 12.3, h: 0.6,
    fontSize: 18, color: COLORS.accent, bold: true, align: "center",
    fontFace: "Noto Sans KR",
  });
  cover.addText("베타 가이드북", {
    x: 0.5, y: 2.5, w: 12.3, h: 1.1,
    fontSize: 56, color: "FFFFFF", bold: true, align: "center",
    fontFace: "Noto Sans KR",
  });
  cover.addText("학생·강사·운영자가 처음 사용할 때 한 번 훑어보면 좋은 가이드", {
    x: 0.5, y: 3.9, w: 12.3, h: 0.4,
    fontSize: 16, color: "FFFFFF", align: "center",
    fontFace: "Noto Sans KR",
  });
  cover.addText("danang-academy.vercel.app  ·  2026-05-12", {
    x: 0.5, y: 6.8, w: 12.3, h: 0.3,
    fontSize: 12, color: COLORS.muted, align: "center",
    fontFace: "Noto Sans KR",
  });

  // 목차
  const toc = pres.addSlide();
  toc.addText("목차", {
    x: 0.5, y: 0.4, w: 12.3, h: 0.7,
    fontSize: 32, bold: true, color: COLORS.dark,
    fontFace: "Noto Sans KR",
  });
  toc.addText(
    [
      { text: "Part 1. 학생·방문자 흐름", options: { fontSize: 22, bold: true, color: COLORS.primary, fontFace: "Noto Sans KR" } },
      { text: "홈 · 무료 발음 테스트 · 무료 레벨 테스트 · 상담 신청 · QR 출석", options: { fontSize: 14, color: COLORS.muted, fontFace: "Noto Sans KR" } },
      { text: " ", options: {} },
      { text: "Part 2. 학원 운영진", options: { fontSize: 22, bold: true, color: COLORS.primary, fontFace: "Noto Sans KR" } },
      { text: "로그인 · 대시보드 · 학생 · 반 · 강사 · 출석 · 테스트 · 상담 · MCQ", options: { fontSize: 14, color: COLORS.muted, fontFace: "Noto Sans KR" } },
      { text: " ", options: {} },
      { text: "Part 3. 정책과 부탁", options: { fontSize: 22, bold: true, color: COLORS.primary, fontFace: "Noto Sans KR" } },
      { text: "권한 매트릭스 · 베타 주의사항 · 피드백 요청", options: { fontSize: 14, color: COLORS.muted, fontFace: "Noto Sans KR" } },
    ],
    { x: 0.8, y: 1.5, w: 12, h: 5.5 }
  );

  // 섹션 헤더 슬라이드
  function addSectionHeader(label, title, desc) {
    const slide = pres.addSlide();
    slide.background = { color: COLORS.light };
    slide.addText(label, {
      x: 0.7, y: 2.5, w: 12, h: 0.5,
      fontSize: 16, bold: true, color: COLORS.primary,
      fontFace: "Noto Sans KR",
    });
    slide.addText(title, {
      x: 0.7, y: 3.1, w: 12, h: 1,
      fontSize: 44, bold: true, color: COLORS.dark,
      fontFace: "Noto Sans KR",
    });
    slide.addText(desc, {
      x: 0.7, y: 4.3, w: 12, h: 0.5,
      fontSize: 16, color: COLORS.muted,
      fontFace: "Noto Sans KR",
    });
  }

  // 콘텐츠 슬라이드 — 큰 단일 스크린샷 + 우측 설명
  function addContentSlide({ title, subtitle, shot, bullets }) {
    const slide = pres.addSlide();
    slide.addText(title, {
      x: 0.5, y: 0.35, w: 12.3, h: 0.55,
      fontSize: 26, bold: true, color: COLORS.dark,
      fontFace: "Noto Sans KR",
    });
    if (subtitle) {
      slide.addText(subtitle, {
        x: 0.5, y: 0.95, w: 12.3, h: 0.35,
        fontSize: 13, color: COLORS.muted,
        fontFace: "Noto Sans KR",
      });
    }
    // 좌측: 스크린샷 (8.9" 너비)
    slide.addImage({
      path: shotPath(shot),
      x: 0.5, y: 1.5, w: 8.9, h: 5.7,
      sizing: { type: "contain", w: 8.9, h: 5.7 },
    });
    // 우측: 설명 박스
    slide.addShape("rect", {
      x: 9.6, y: 1.5, w: 3.5, h: 5.7,
      fill: { color: COLORS.light },
      line: { color: COLORS.border, width: 1 },
    });
    if (bullets && bullets.length > 0) {
      slide.addText(
        bullets.map((b) => ({
          text: b,
          options: { bullet: { type: "bullet" }, fontSize: 12, color: COLORS.dark, fontFace: "Noto Sans KR", paraSpaceAfter: 6 },
        })),
        { x: 9.8, y: 1.7, w: 3.2, h: 5.4, valign: "top" }
      );
    }
  }

  // 큰 스크린샷 + 캡션만 (모바일/세로형)
  function addPortraitSlide({ title, subtitle, shot, bullets }) {
    const slide = pres.addSlide();
    slide.addText(title, {
      x: 0.5, y: 0.35, w: 12.3, h: 0.55,
      fontSize: 26, bold: true, color: COLORS.dark,
      fontFace: "Noto Sans KR",
    });
    if (subtitle) {
      slide.addText(subtitle, {
        x: 0.5, y: 0.95, w: 12.3, h: 0.35,
        fontSize: 13, color: COLORS.muted,
        fontFace: "Noto Sans KR",
      });
    }
    // 모바일 이미지: 가운데 작게
    slide.addImage({
      path: shotPath(shot),
      x: 1.5, y: 1.5, w: 4.5, h: 5.7,
      sizing: { type: "contain", w: 4.5, h: 5.7 },
    });
    slide.addShape("rect", {
      x: 7, y: 1.5, w: 5.8, h: 5.7,
      fill: { color: COLORS.light },
      line: { color: COLORS.border, width: 1 },
    });
    slide.addText(
      bullets.map((b) => ({
        text: b,
        options: { bullet: { type: "bullet" }, fontSize: 14, color: COLORS.dark, fontFace: "Noto Sans KR", paraSpaceAfter: 8 },
      })),
      { x: 7.3, y: 1.7, w: 5.2, h: 5.4, valign: "top" }
    );
  }

  // 텍스트 전용 슬라이드
  function addTextSlide(title, blocks) {
    const slide = pres.addSlide();
    slide.addText(title, {
      x: 0.5, y: 0.4, w: 12.3, h: 0.7,
      fontSize: 30, bold: true, color: COLORS.dark,
      fontFace: "Noto Sans KR",
    });
    slide.addText(
      blocks.map((b) => {
        if (typeof b === "string") {
          return { text: b, options: { fontSize: 14, color: COLORS.dark, bullet: { type: "bullet" }, fontFace: "Noto Sans KR", paraSpaceAfter: 8 } };
        }
        return {
          text: b.text,
          options: {
            fontSize: b.fontSize ?? 14,
            color: b.color ?? COLORS.dark,
            bold: b.bold ?? false,
            bullet: b.bullet === false ? false : { type: "bullet" },
            fontFace: "Noto Sans KR",
            paraSpaceAfter: 8,
            indentLevel: b.indent ?? 0,
          },
        };
      }),
      { x: 0.9, y: 1.3, w: 11.5, h: 5.8, valign: "top" }
    );
  }

  // -----------------------------------------------------------------
  // Part 1
  // -----------------------------------------------------------------
  addSectionHeader("Part 1", "학생·방문자 흐름", "로그인 없이 누구나 사용할 수 있는 페이지");

  addContentSlide({
    title: "홈 페이지",
    subtitle: "공식 URL: danang-academy.vercel.app  ·  우상단 KO/VI 토글",
    shot: "01-home",
    bullets: [
      "랜딩에서 메인 배너 클릭 시 발음 테스트로 이동",
      "헤더 메뉴에서 모든 코스 진입",
      "푸터에 무료 테스트 직링크 2종",
      "한국어와 베트남어 자동 분기",
    ],
  });

  addContentSlide({
    title: "무료 발음 테스트",
    subtitle: "/free-pronunciation",
    shot: "02-fpt-intro",
    bullets: [
      "이름·모국어·한국어 수준 3가지 입력",
      "수준별 랜덤 문장 1개 받음",
      "최대 30초 녹음 → AI가 점수/피드백/추천 반 산출",
      "하루 5회 제한 (IP+UA 기반)",
      "결과 페이지에서 상담 신청 직행 가능",
    ],
  });

  addContentSlide({
    title: "무료 레벨 테스트",
    subtitle: "/placement",
    shot: "03-pt-intro",
    bullets: [
      "객관식 5문항 + 발음 1문장",
      "총 5분 안에 끝나는 흐름",
      "추천 반: 입문 · 초급 · 중급 · 고급",
      "MCQ 점수 + 발음 점수 가중 평균",
      "두 결과가 차이 크면 보수적으로 낮은 반 추천",
    ],
  });

  addContentSlide({
    title: "상담 신청",
    subtitle: "/consult  ·  테스트 결과의 상담 버튼이면 추천 반 자동 prefill",
    shot: "04-consult",
    bullets: [
      "이름·전화번호 필수, 이메일·메모 선택",
      "희망 반 드롭다운 (입문/초급/중급/고급)",
      "테스트에서 넘어오면 추천 반 자동 선택",
      "제출 후 어드민 상담 리드 파이프라인에 표시",
      "24시간 내 학원 연락",
    ],
  });

  addPortraitSlide({
    title: "QR 출석 (학생용 모바일)",
    subtitle: "/qr/{token}  ·  학생 폰 카메라로 자기 QR 스캔",
    shot: "05-qr-mobile",
    bullets: [
      "학생 폰의 사진/카드 QR을 카메라로 스캔",
      "URL 자동 열림 → 입실 자동 기록",
      "수업 끝나고 다시 스캔하면 퇴실",
      "둘 다 기록되면 '오늘은 이미 끝' 안내",
      "30초 안에 같은 QR 다시 스캔하면 잠시 대기 안내",
      "QR 토큰이 잘못된 경우 좌측 화면처럼 안내",
    ],
  });

  // -----------------------------------------------------------------
  // Part 2
  // -----------------------------------------------------------------
  addSectionHeader("Part 2", "학원 운영진", "로그인 후 9개 메뉴로 학원 전반을 운영합니다");

  addContentSlide({
    title: "어드민 로그인",
    subtitle: "/login  ·  원장이 발급한 이메일·비밀번호",
    shot: "06-login",
    bullets: [
      "운영진 전용 페이지",
      "학생과 방문자는 로그인 없이 무료 테스트 사용",
      "비밀번호 분실 시 원장에게 재설정 요청",
      "성공 시 /admin 자동 이동",
    ],
  });

  addContentSlide({
    title: "대시보드",
    subtitle: "오늘 KPI 6개 + 최근 상담 + 오늘 수업 카드",
    shot: "10-dashboard",
    bullets: [
      "총 학생 수, 오늘 출석률, 이번 주 테스트",
      "상담 전환률, 평균 발음 점수, 운영 중 반",
      "최근 상담 5건 (이름·전화·추천 반·일시)",
      "최근 반 5개 (강사·시간표·정원/현재)",
      "Asia/Ho_Chi_Minh 시간대 기준",
    ],
  });

  addContentSlide({
    title: "학생 목록",
    subtitle: "/admin/students  ·  검색·필터·상태별 카운트",
    shot: "11-students-list",
    bullets: [
      "이름/연락처 실시간 검색 (300ms 디바운스)",
      "필터: 상태 · 레벨 · 반",
      "상태 4종: 수강중 / 휴학 / 수료 / 이탈",
      "비활성 학생은 행이 흐리게 표시",
      "총 학생 수와 상태별 분포를 상단 한 줄로",
    ],
  });

  addContentSlide({
    title: "학생 등록 폼",
    subtitle: "이름·전화·모국어·레벨·반·등록일·상태",
    shot: "12-student-new",
    bullets: [
      "필수: 이름",
      "선택: 전화·모국어·레벨·반·부모 연락처",
      "저장 시 QR 토큰 자동 발급",
      "상태 기본값: 수강중",
      "베트남어 가족 연락처는 +84 형식 권장",
    ],
  });

  addContentSlide({
    title: "학생 상세 — QR과 강사 메모",
    subtitle: "기본 정보 수정 · QR 다운로드 · 출석 이력 · 카테고리별 메모",
    shot: "13-student-detail",
    bullets: [
      "QR 코드 PNG 다운로드 가능",
      "QR URL은 학생 폰 카메라 스캔용",
      "최근 출석 20건 시각 별로 표시",
      "강사 메모 카테고리: 일반·발음·출결·진도·태도",
      "본인 또는 매니저 이상만 메모 삭제 가능",
    ],
  });

  addContentSlide({
    title: "반 목록",
    subtitle: "/admin/classes  ·  레벨·시간표·강사·정원/현재",
    shot: "14-classes-list",
    bullets: [
      "레벨별로 정렬 (입문 → 고급)",
      "각 카드에 시간표 메모와 담당 강사",
      "정원 대비 현재 학생 수를 큼지막하게",
      "카드 클릭 시 반 상세로 이동",
    ],
  });

  addContentSlide({
    title: "반 개설",
    subtitle: "정기 시간표 설정 시 향후 4주 회차 자동 생성 가능",
    shot: "15-class-new",
    bullets: [
      "반 이름·레벨·담당 강사 입력",
      "요일 토글 + 시작·종료 시간 = 정기 시간표",
      "자유 텍스트 메모로 보강 일정 등 별도 표기",
      "정원은 1~100명",
      "저장 후 상세 화면에서 회차 생성",
    ],
  });

  addContentSlide({
    title: "반 상세 — 회차 자동 생성",
    subtitle: "이번 주부터 향후 일정까지 (최대 30개)",
    shot: "16-class-detail",
    bullets: [
      "정기 시간표를 채우면 4주 회차 생성 버튼 활성화",
      "한 번 누르면 28~30개 회차 자동 INSERT",
      "매주 일요일 자정 cron이 다음 주치 자동 보충",
      "각 회차에서 출석 체크 진입",
      "출석률은 present/total 형태로 표기",
    ],
  });

  addContentSlide({
    title: "강사·직원 관리",
    subtitle: "/admin/teachers  ·  계정 등록 · 역할 부여 · 비번 재설정",
    shot: "17-teachers",
    bullets: [
      "원장과 매니저가 강사 계정 생성 가능",
      "역할별 등록 가능 범위 차등 적용",
      "랜덤 비밀번호 1회 표시 후 사라짐 (1분)",
      "비밀번호 재설정은 즉시 새 값 적용",
      "본인 계정의 역할 변경·삭제는 차단",
    ],
  });

  addContentSlide({
    title: "출석",
    subtitle: "오늘 입실/퇴실/현재 학원 안 + 반별 + 최근 QR 스캔",
    shot: "18-attendance",
    bullets: [
      "오늘 자정부터 지금까지 통계 (VN 시간)",
      "현재 학원 안 = 입실 − 퇴실",
      "반별 출석 카드로 어느 반이 활발한지 확인",
      "최근 30건 QR 스캔 로그",
      "학생 이름 클릭 시 학생 상세로 이동",
    ],
  });

  addContentSlide({
    title: "테스트 이력",
    subtitle: "발음·레벨 통합  ·  녹음 듣기 버튼으로 5분 한정 재생",
    shot: "19-tests",
    bullets: [
      "최근 200건까지 표시",
      "유형 필터: 전체 / 발음 / 레벨",
      "각 행에 점수·추천 반·STT 결과 일부",
      "듣기 버튼이 R2 음성을 인라인 재생",
      "5분 후 URL 만료 (개인정보 보호)",
    ],
  });

  addContentSlide({
    title: "상담 리드 파이프라인",
    subtitle: "신규 · 연락 · 등록 · 이탈 상태로 전환 추적",
    shot: "20-leads",
    bullets: [
      "탭마다 상태별 카운트 표시",
      "출처 배지: 랜딩 / 발음 테스트 / 레벨 테스트",
      "추천 반과 함께 표시",
      "각 행에서 인라인 상태 변경",
      "메모는 인라인으로 1000자까지",
    ],
  });

  addContentSlide({
    title: "레벨테스트 문항",
    subtitle: "/admin/mcq  ·  임계값 조정 + 5문항 활성/비활성",
    shot: "21-mcq",
    bullets: [
      "점수 임계값을 슬라이더로 조정",
      "임계값 저장 시 다음 응시자부터 적용",
      "각 문항 한국어 본문 + 베트남어 번역",
      "정답이 강조 표시",
      "필요 없는 문항은 비활성화하여 5개만 노출",
    ],
  });

  // -----------------------------------------------------------------
  // Part 3
  // -----------------------------------------------------------------
  addSectionHeader("Part 3", "정책과 부탁", "권한 매트릭스, 베타 주의사항, 피드백 요청");

  addTextSlide("권한 매트릭스", [
    { text: "원장 (owner)", bold: true, fontSize: 18, color: COLORS.primary, bullet: false },
    { text: "모든 것. 매니저까지 임명 가능. 강사 페이도 조회 가능.", fontSize: 14, indent: 1 },
    { text: " ", bullet: false },
    { text: "매니저 (manager)", bold: true, fontSize: 18, color: COLORS.primary, bullet: false },
    { text: "학생·반·출석·상담·테스트. 강사 등록 가능. 강사 페이는 못 봄.", fontSize: 14, indent: 1 },
    { text: " ", bullet: false },
    { text: "강사 (teacher)", bold: true, fontSize: 18, color: COLORS.primary, bullet: false },
    { text: "본인 담당 반의 학생만 보임. 본인 수업 출석 체크. 학생 메모 작성.", fontSize: 14, indent: 1 },
  ]);

  addTextSlide("베타 단계 알아둘 점", [
    "AI 평가: OpenAI Whisper STT + Gemini 2.5 Flash. 트래픽 폭주 시 폴백 모델로 자동 전환",
    "음성 저장: Cloudflare R2 비공개 버킷. 어드민 재생은 5분 한정 URL",
    "익명 사용자: 발음·레벨 각각 하루 5회 제한 (IP+UA 기반)",
    "모든 날짜 계산은 Asia/Ho_Chi_Minh 기준",
    " ",
    { text: "Phase 2 (오픈 후) 예정", bold: true, fontSize: 16, color: COLORS.primary, bullet: false },
    { text: "학부모 Zalo/SMS 알림", indent: 1 },
    { text: "학생 마이페이지 (출석·점수 조회)", indent: 1 },
    { text: "결제·등록비 처리", indent: 1 },
    { text: "학생 CSV 일괄 가져오기", indent: 1 },
  ]);

  addTextSlide("베타 테스터에게 부탁드리는 것", [
    "발음·레벨 테스트 전체 흐름 — 추천 반이 합리적으로 느껴지는지",
    "상담 신청이 어드민 리드에 정상 표시되는지",
    "QR 발급 → 학생 폰 저장 → 학원에서 스캔 → 자동 입실 전체 사이클",
    "회차 생성 후 강사가 본인 폰에서 출석 체크하는 흐름",
    "한국어와 베트남어 전환 시 깨지거나 어색한 텍스트",
    "모바일 화면에서의 가독성과 동선 (다낭 학생 핸드폰 위주)",
    " ",
    { text: "발견한 이슈는 화면 캡처와 함께 운영진에게 전달 부탁드립니다.", fontSize: 14, color: COLORS.muted, bullet: false },
  ]);

  // 마지막
  const last = pres.addSlide();
  last.background = { color: COLORS.dark };
  last.addText("감사합니다", {
    x: 0.5, y: 2.7, w: 12.3, h: 1.4,
    fontSize: 64, color: "FFFFFF", bold: true, align: "center",
    fontFace: "Noto Sans KR",
  });
  last.addText("Cảm ơn bạn", {
    x: 0.5, y: 4.2, w: 12.3, h: 0.5,
    fontSize: 22, color: COLORS.accent, align: "center",
    fontFace: "Noto Sans KR",
  });
  last.addText("danang-academy.vercel.app", {
    x: 0.5, y: 5.5, w: 12.3, h: 0.4,
    fontSize: 14, color: "FFFFFF", align: "center",
    fontFace: "Noto Sans KR",
  });

  return pres.writeFile({ fileName: PPT_PATH });
}

try {
  await seedDemoData();
  await captureScreenshots();
  const file = await buildPpt();
  console.log(`\n가이드북 생성 완료: ${file}\n`);
} catch (err) {
  console.error("실패:", err);
  process.exit(1);
} finally {
  await cleanupDemoData();
}
