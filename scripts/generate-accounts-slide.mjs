/**
 * 베타 가계정 안내 슬라이드 — 단일 1장 PPT
 *
 * 사용:
 *   node scripts/generate-accounts-slide.mjs
 *
 * 출력:
 *   _docs/guides/beta-accounts.pptx
 *
 * PowerPoint 에서 본인 가이드북 파일을 연 뒤
 *   삽입 → 슬라이드 재사용 → beta-accounts.pptx 선택
 * 으로 원하는 위치에 삽입.
 */

import PptxGenJS from "pptxgenjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "_docs/guides/beta-accounts.pptx");

const FONT = "Malgun Gothic";
const COLORS = {
  primary: "6366F1",
  accent: "22D3EE",
  dark: "0B1020",
  muted: "6B7280",
  light: "F5F3FF",
  border: "E5E7EB",
  white: "FFFFFF",
};

const PASSWORD = process.env.BETA_PASSWORD ?? "Beta!2026";
const URL = process.env.BETA_URL ?? "https://danang-academy.vercel.app/ko/login";

const ACCOUNTS = [
  {
    role: "원장",
    roleKey: "owner",
    email: "owner-beta@test.com",
    can: "전체 권한 — 학생·반·강사·매니저 등록, 모든 페이지 접근",
  },
  {
    role: "매니저",
    roleKey: "manager",
    email: "manager-beta@test.com",
    can: "학생·반·출석·상담·테스트·강사 등록 (강사 페이는 못 봄)",
  },
  {
    role: "강사",
    roleKey: "teacher",
    email: "teacher-beta@test.com",
    can: "본인 담당 반의 학생만 보임 · 본인 수업 출석 체크 · 학생 메모 작성",
  },
];

const pres = new PptxGenJS();
pres.layout = "LAYOUT_WIDE"; // 13.333" x 7.5"

const slide = pres.addSlide();

// 제목
slide.addText("베타 테스트 가계정", {
  x: 0.5, y: 0.35, w: 12.3, h: 0.55,
  fontSize: 26, bold: true, color: COLORS.dark, fontFace: FONT,
});
slide.addText(`${URL} 에서 아래 계정으로 로그인하세요`, {
  x: 0.5, y: 0.95, w: 12.3, h: 0.4,
  fontSize: 13, color: COLORS.muted, fontFace: FONT,
});

// 표 (헤더 + 3행)
const headerFill = { color: COLORS.dark };
const headerText = { color: COLORS.white, bold: true, fontSize: 13, fontFace: FONT };
const cellOpts = { color: COLORS.dark, fontSize: 13, fontFace: FONT, valign: "middle" };

const rows = [
  [
    { text: "역할",    options: { ...headerText, fill: headerFill, align: "center" } },
    { text: "이메일",  options: { ...headerText, fill: headerFill, align: "left" } },
    { text: "비밀번호", options: { ...headerText, fill: headerFill, align: "center" } },
    { text: "권한 범위", options: { ...headerText, fill: headerFill, align: "left" } },
  ],
  ...ACCOUNTS.map((a) => [
    { text: a.role,     options: { ...cellOpts, bold: true, color: COLORS.primary, align: "center" } },
    { text: a.email,    options: { ...cellOpts, align: "left" } },
    { text: PASSWORD,   options: { ...cellOpts, align: "center", bold: true } },
    { text: a.can,      options: { ...cellOpts, align: "left", fontSize: 12 } },
  ]),
];

slide.addTable(rows, {
  x: 0.5, y: 1.6, w: 12.3,
  colW: [1.3, 3.0, 1.8, 6.2],
  rowH: [0.5, 0.9, 0.9, 0.9],
  border: { type: "solid", color: COLORS.border, pt: 1 },
  fontFace: FONT,
});

// 하단 안내문
slide.addShape("rect", {
  x: 0.5, y: 5.5, w: 12.3, h: 1.6,
  fill: { color: COLORS.light },
  line: { color: COLORS.border, width: 1 },
});

slide.addText(
  [
    { text: "주의사항",
      options: { fontSize: 14, bold: true, color: COLORS.primary, fontFace: FONT, breakLine: true } },
    { text: "비밀번호는 베타 테스트 종료 후 즉시 폐기 · 운영 계정과 분리 사용",
      options: { fontSize: 12, color: COLORS.dark, fontFace: FONT, bullet: { type: "bullet" }, breakLine: true, paraSpaceAfter: 3 } },
    { text: "데모 데이터(반 2 · 학생 4 · 상담 리드 2)가 함께 시드되어 있음 — 자유롭게 추가·수정 가능",
      options: { fontSize: 12, color: COLORS.dark, fontFace: FONT, bullet: { type: "bullet" }, breakLine: true, paraSpaceAfter: 3 } },
    { text: "강사 계정은 본인 담당 반만 보이므로, '베타 강사'를 'Beta 중급반'·'Beta 초급반' 담당으로 미리 배정해둠",
      options: { fontSize: 12, color: COLORS.dark, fontFace: FONT, bullet: { type: "bullet" } } },
  ],
  { x: 0.8, y: 5.65, w: 11.7, h: 1.4, valign: "top", lineSpacingMultiple: 1.35 }
);

await pres.writeFile({ fileName: OUT });
console.log(`생성: ${OUT}`);
