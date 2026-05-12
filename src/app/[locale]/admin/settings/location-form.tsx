"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { updateOrgLocation } from "./actions";

type Initial = {
  lat: number | null;
  lng: number | null;
  radiusM: number;
};

export function LocationForm({ initial }: { initial: Initial }) {
  const t = useTranslations("admin.settings");
  const tCommon = useTranslations("admin.common");
  const [lat, setLat] = useState<string>(initial.lat?.toString() ?? "");
  const [lng, setLng] = useState<string>(initial.lng?.toString() ?? "");
  const [radius, setRadius] = useState<string>(initial.radiusM.toString());
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const latNum = Number(lat);
  const lngNum = Number(lng);
  const radiusNum = Number(radius);
  const coordsValid =
    Number.isFinite(latNum) && Number.isFinite(lngNum) &&
    latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180;
  const radiusValid = Number.isFinite(radiusNum) && radiusNum >= 10 && radiusNum <= 5000;

  function fetchCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setMsg({ kind: "err", text: t("err.geoUnavailable") });
      return;
    }
    setLocating(true);
    setMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => {
        setLocating(false);
        setMsg({ kind: "err", text: t("err.geoFailed") });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function handleSubmit() {
    setMsg(null);
    if (!coordsValid) {
      setMsg({ kind: "err", text: t("err.invalidCoords") });
      return;
    }
    if (!radiusValid) {
      setMsg({ kind: "err", text: t("err.invalidRadius") });
      return;
    }
    startTransition(async () => {
      try {
        await updateOrgLocation({ lat: latNum, lng: lngNum, radiusM: radiusNum });
        setMsg({ kind: "ok", text: tCommon("saved") });
      } catch (err) {
        const message = err instanceof Error ? err.message : "error";
        setMsg({ kind: "err", text: message === "forbidden" ? t("err.forbidden") : message });
      }
    });
  }

  const previewSrc = coordsValid
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${lngNum - 0.005},${latNum - 0.005},${lngNum + 0.005},${latNum + 0.005}&marker=${latNum},${lngNum}&layer=mapnik`
    : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">{t("lat")}</span>
            <input
              type="number"
              step="0.000001"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="16.041505"
              className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm focus:border-[var(--color-primary)]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">{t("lng")}</span>
            <input
              type="number"
              step="0.000001"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="108.218022"
              className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm focus:border-[var(--color-primary)]"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={fetchCurrentLocation}
          disabled={locating}
          className="self-start rounded-full border-2 border-[var(--color-line)] px-4 py-2 text-xs font-bold hover:border-[var(--color-primary)] disabled:opacity-50"
        >
          {locating ? t("locating") : t("useCurrentLocation")}
        </button>
        <p className="-mt-1 text-[11px] text-[var(--color-muted)]">
          {t("useCurrentLocationHint")}
        </p>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold">
            {t("radius")} <span className="text-[var(--color-muted)]">({t("radiusUnit")})</span>
          </span>
          <input
            type="number"
            step="10"
            min={10}
            max={5000}
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            className="w-32 rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm focus:border-[var(--color-primary)]"
          />
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">{t("radiusHint")}</p>
        </label>

        <div className="rounded-lg bg-[var(--color-soft)] p-4 text-xs leading-relaxed">
          <p className="font-bold">{t("helpTitle")}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-[var(--color-muted)]">
            <li>{t("helpStep1")}</li>
            <li>{t("helpStep2")}</li>
            <li>{t("helpStep3")}</li>
          </ol>
        </div>

        {msg && (
          <p
            className={`rounded-md px-3 py-2 text-xs font-semibold ${
              msg.kind === "ok"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {msg.text}
          </p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="brand-gradient self-start rounded-full px-6 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
        >
          {pending ? tCommon("saving") : tCommon("save")}
        </button>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
          {t("previewTitle")}
        </p>
        {previewSrc ? (
          <iframe
            key={previewSrc}
            src={previewSrc}
            className="h-72 w-full rounded-lg border border-[var(--color-line)]"
            title="map preview"
          />
        ) : (
          <div className="flex h-72 w-full items-center justify-center rounded-lg border border-dashed border-[var(--color-line)] text-xs text-[var(--color-muted)]">
            {t("previewEmpty")}
          </div>
        )}
        <p className="mt-2 text-[11px] text-[var(--color-muted)]">{t("previewHint")}</p>
      </div>
    </div>
  );
}
