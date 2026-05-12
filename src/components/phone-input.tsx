"use client";

import { useState, useEffect } from "react";

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function stripVnPrefix(digits: string): string {
  if (digits.startsWith("84")) return digits.slice(2);
  if (digits.startsWith("0")) return digits.slice(1);
  return digits;
}

function formatVn(d: string): string {
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 10)}`;
}

function toLocal(value: string): string {
  return stripVnPrefix(digitsOnly(value)).slice(0, 10);
}

function toE164(localDigits: string): string {
  return localDigits.length > 0 ? `+84${localDigits}` : "";
}

export function PhoneInput({
  name,
  defaultValue = "",
  required = false,
  placeholder = "912 345 678",
  disabled = false,
  className = "",
  onChange,
}: {
  name?: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onChange?: (e164: string) => void;
}) {
  const [digits, setDigits] = useState(() => toLocal(defaultValue));

  useEffect(() => {
    onChange?.(toE164(digits));
  }, [digits, onChange]);

  return (
    <div
      className={`flex items-stretch rounded-xl border-2 border-[var(--color-line)] bg-white focus-within:border-[var(--color-primary)] ${
        disabled ? "opacity-60" : ""
      } ${className}`}
    >
      <span className="flex select-none items-center gap-1 border-r border-[var(--color-line)] bg-gray-50 px-3 text-sm font-semibold text-gray-600">
        <span aria-hidden>🇻🇳</span>
        <span>+84</span>
      </span>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={formatVn(digits)}
        onChange={(e) => setDigits(toLocal(e.target.value))}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none"
      />
      <input type="hidden" name={name} value={toE164(digits)} />
    </div>
  );
}
