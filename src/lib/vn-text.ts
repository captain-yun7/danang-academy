// 베트남어 성조부호(diacritics) 제거 — 학생이 부호 없이 입력해도 검색되도록
// 예: "Bảo Hân" → "bao han", "Đặng" → "dang"
export function normalizeVn(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // 결합 성조부호 제거
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}
