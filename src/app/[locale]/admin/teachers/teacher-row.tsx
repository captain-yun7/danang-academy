"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { resetTeacherPassword, updateTeacherRole, deleteTeacher } from "./actions";

type User = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  joined: string;
  class_count: number;
};

const ROLE_OPTIONS = ["teacher", "manager", "owner"] as const;

function randomPassword(len = 10) {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length];
  return out;
}

export function TeacherRow({
  user,
  sessionUserId,
  canManage,
  canRoleEdit,
  roleLabel,
  roleTone,
}: {
  user: User;
  sessionUserId: string;
  canManage: boolean;
  canRoleEdit: boolean;
  roleLabel: Record<string, string>;
  roleTone: Record<string, string>;
}) {
  const t = useTranslations("admin.teachers.row");
  const tList = useTranslations("admin.teachers");
  const [pending, startTransition] = useTransition();
  const [resetShown, setResetShown] = useState<string | null>(null);
  const [role, setRole] = useState(user.role);
  const [error, setError] = useState<string | null>(null);

  const isSelf = user.id === sessionUserId;
  const isSuper = user.role === "super_admin";

  function doReset() {
    const pw = randomPassword(10);
    startTransition(async () => {
      try {
        await resetTeacherPassword({ id: user.id, password: pw });
        setResetShown(pw);
        setTimeout(() => setResetShown(null), 60_000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "error");
      }
    });
  }

  function doRoleChange(next: string) {
    if (next === role) return;
    if (!ROLE_OPTIONS.includes(next as (typeof ROLE_OPTIONS)[number])) return;
    setRole(next);
    startTransition(async () => {
      try {
        await updateTeacherRole({
          id: user.id,
          role: next as "teacher" | "manager" | "owner",
        });
      } catch (err) {
        setRole(user.role);
        setError(err instanceof Error ? err.message : "error");
      }
    });
  }

  function doDelete() {
    if (!confirm(t("deleteConfirm", { name: user.name }))) return;
    startTransition(async () => {
      try {
        await deleteTeacher(user.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "error");
      }
    });
  }

  return (
    <>
      <tr className="hover:bg-[var(--color-soft)]/40">
        <td className="px-4 py-3 font-semibold">
          {user.name}
          {isSelf && <span className="ml-2 text-[10px] text-[var(--color-muted)]">{t("self")}</span>}
        </td>
        <td className="px-4 py-3">
          {canRoleEdit && !isSelf && !isSuper ? (
            <select
              value={role}
              disabled={pending}
              onChange={(e) => doRoleChange(e.target.value)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${roleTone[role]}`}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {roleLabel[r]}
                </option>
              ))}
            </select>
          ) : (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${roleTone[role]}`}>
              {roleLabel[role] ?? role}
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-xs text-[var(--color-muted)]">{user.email}</td>
        <td className="px-4 py-3 text-xs text-[var(--color-muted)]">{user.phone ?? "—"}</td>
        <td className="px-4 py-3 text-xs">
          {user.class_count}
          {tList("classCountSuffix")}
        </td>
        <td className="px-4 py-3 text-xs text-[var(--color-muted)]">{user.joined}</td>
        <td className="px-4 py-3 text-right">
          {canManage && !isSelf && !isSuper && (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={doReset}
                className="rounded-full border border-[var(--color-line)] px-2.5 py-1 text-[10px] font-bold hover:border-[var(--color-ink)]"
              >
                {t("reset")}
              </button>
              {canRoleEdit && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={doDelete}
                  className="rounded-full border border-red-300 px-2.5 py-1 text-[10px] font-bold text-red-700 hover:bg-red-50"
                >
                  {t("delete")}
                </button>
              )}
            </div>
          )}
        </td>
      </tr>
      {resetShown && (
        <tr>
          <td colSpan={7} className="bg-emerald-50 px-4 py-2 text-xs text-emerald-700">
            {t("resetHeader")}{" "}
            <code className="rounded bg-white px-2 py-0.5 font-mono">{resetShown}</code>
            <span className="ml-3 text-[10px]">{t("resetExpiry")}</span>
          </td>
        </tr>
      )}
      {error && (
        <tr>
          <td colSpan={7} className="bg-red-50 px-4 py-2 text-xs text-red-700">
            ⚠️ {error}
          </td>
        </tr>
      )}
    </>
  );
}
