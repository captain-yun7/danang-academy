/**
 * 베트남 전화번호 정규화 — 서버 액션에서 사용
 * 입력은 자유 형식 (사용자 직접 입력, 옛 데이터, 붙여넣기 등) 모두 수용
 * 출력은 E.164 (+84XXXXXXXXX) 또는 빈 문자열
 */
export function normalizeVnPhone(input: string | null | undefined): string {
  if (!input) return "";
  const digits = input.replace(/\D/g, "");
  if (digits.length === 0) return "";

  let local: string;
  if (digits.startsWith("84")) local = digits.slice(2);
  else if (digits.startsWith("0")) local = digits.slice(1);
  else local = digits;

  // 베트남 모바일/유선 9~10자리. 그 외엔 잘못된 입력으로 간주
  if (local.length < 9 || local.length > 10) return "";
  return `+84${local}`;
}

export function isValidVnPhone(input: string | null | undefined): boolean {
  return normalizeVnPhone(input).length > 0;
}
