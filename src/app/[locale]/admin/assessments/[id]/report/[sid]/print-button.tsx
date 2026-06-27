"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="brand-gradient rounded-full px-4 py-2 text-sm font-bold text-white"
    >
      인쇄 / PDF 저장
    </button>
  );
}
