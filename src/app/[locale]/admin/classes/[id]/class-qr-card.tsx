"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function ClassQrCard({
  qrPng,
  qrUrl,
  className,
}: {
  qrPng: string;
  qrUrl: string;
  className: string;
}) {
  const t = useTranslations("admin.classes.detail");
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 권한 거부 등 — 무시
    }
  }

  const fileName = `qr-${className.replace(/[^\w\-]+/g, "_")}.png`;

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
        {t("qrTitle")}
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-muted)]">
        {t("qrDesc")}
      </p>
      <div className="mt-3 flex justify-center rounded-lg border border-[var(--color-line)] bg-white p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrPng} alt={`QR ${className}`} width={200} height={200} />
      </div>
      <div className="mt-3 grid gap-2">
        <a
          href={qrPng}
          download={fileName}
          className="block rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-center text-xs font-bold hover:bg-[var(--color-line)]"
        >
          {t("qrDownload")}
        </a>
        <button
          type="button"
          onClick={copyUrl}
          className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-xs font-bold hover:bg-[var(--color-line)]"
        >
          {copied ? t("qrCopied") : t("qrUrl")}
        </button>
      </div>
      <p className="mt-2 truncate text-[10px] text-[var(--color-muted)]" title={qrUrl}>
        {qrUrl}
      </p>
    </div>
  );
}
