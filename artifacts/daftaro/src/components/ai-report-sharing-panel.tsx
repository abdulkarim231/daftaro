"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Clipboard, Link2, LoaderCircle, ShieldCheck, X } from "lucide-react";
import {
  createAiReportShare,
  listAiReportShares,
  localizeAiError,
  revokeAiReportShare,
  type AiAnalysis,
  type AiLanguage,
  type AiReportShare,
} from "../lib/ai-api";

const COPY = {
  ar: {
    title: "مشاركة التقرير مع شريك",
    description: "أنشئي رابط قراءة فقط لتقرير الفترة الحالية. لا تظهر بيانات العملاء أو معلومات الحساب.",
    privacy: "أي شخص يحصل على الرابط يمكنه مشاهدة التقرير دون تسجيل دخول حتى انتهاء الصلاحية أو إلغاء الرابط.",
    oneTime: "احتفظي بالرابط الآن؛ لن يُعرض الرمز السري مرة أخرى بعد إغلاق هذه الصفحة.",
    expiration: "تنتهي الصلاحية بعد",
    day: "يوم",
    days: "أيام",
    create: "إنشاء رابط",
    creating: "جارٍ الإنشاء…",
    activeLinks: "الروابط الحالية والسابقة",
    loading: "جارٍ تحميل الروابط…",
    noLinks: "لم يتم إنشاء روابط مشاركة بعد.",
    active: "نشط",
    expired: "منتهي",
    revoked: "ملغى",
    revoke: "إلغاء الرابط",
    revoking: "جارٍ الإلغاء…",
    copy: "نسخ الرابط",
    copied: "تم النسخ",
    created: "تم إنشاء الرابط. أرسليه إلى الشريك المقصود فقط.",
    loadError: "تعذر تحميل روابط التقارير.",
    createError: "تعذر إنشاء رابط التقرير.",
    revokeError: "تعذر إلغاء الرابط.",
    manualCopy: "تم تحديد الرابط. انسخيه يدويًا من الحقل.",
    period: "الفترة",
    currency: "العملة",
    expires: "ينتهي",
  },
  en: {
    title: "Share this report with a partner",
    description: "Create a read-only link for the selected period. Customer and account details are excluded.",
    privacy: "Anyone with the link can view the report without signing in until it expires or is revoked.",
    oneTime: "Keep the link now; its secret token will not be shown again after you leave this page.",
    expiration: "Link expires in",
    day: "day",
    days: "days",
    create: "Create link",
    creating: "Creating…",
    activeLinks: "Current and past links",
    loading: "Loading links…",
    noLinks: "No report links have been created.",
    active: "Active",
    expired: "Expired",
    revoked: "Revoked",
    revoke: "Revoke link",
    revoking: "Revoking…",
    copy: "Copy link",
    copied: "Copied",
    created: "Link created. Send it only to the intended partner.",
    loadError: "Report links could not be loaded.",
    createError: "The report link could not be created.",
    revokeError: "The link could not be revoked.",
    manualCopy: "The link is selected. Copy it from the field.",
    period: "Period",
    currency: "Currency",
    expires: "Expires",
  },
} as const;

function formatDate(value: string, language: AiLanguage) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "ar" ? "ar-KW" : "en-KW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function AiReportSharingPanel({
  analysis,
  language,
}: {
  analysis: AiAnalysis;
  language: AiLanguage;
}) {
  const copy = COPY[language];
  const [expiresInDays, setExpiresInDays] = useState<1 | 7 | 30>(7);
  const [shares, setShares] = useState<AiReportShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [latestLink, setLatestLink] = useState("");
  const [copied, setCopied] = useState(false);
  const linkInputRef = useRef<HTMLInputElement>(null);

  async function refreshShares() {
    setLoading(true);
    setError("");
    try {
      const result = await listAiReportShares();
      setShares(result.shares);
    } catch (cause) {
      setError(cause instanceof Error ? localizeAiError(cause.message, language) : copy.loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshShares();
    // This panel is mounted only after the signed-in report is available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createLink() {
    setCreating(true);
    setError("");
    setNotice("");
    setLatestLink("");
    setCopied(false);
    try {
      const share = await createAiReportShare(analysis, expiresInDays, language);
      const link = new URL("/shared-report", window.location.origin);
      link.searchParams.set("id", share.shareId);
      link.hash = share.token;
      setLatestLink(link.toString());
      setShares((current) => [{
        shareId: share.shareId,
        period: share.period,
        currencyCode: share.currencyCode,
        createdAt: share.createdAt,
        expiresAt: share.expiresAt,
        revokedAt: null,
      }, ...current.filter((item) => item.shareId !== share.shareId)].slice(0, 50));
      setNotice(copy.created);
    } catch (cause) {
      setError(cause instanceof Error ? localizeAiError(cause.message, language) : copy.createError);
    } finally {
      setCreating(false);
    }
  }

  async function copyLink() {
    setError("");
    try {
      await navigator.clipboard.writeText(latestLink);
      setCopied(true);
      return;
    } catch {
      const input = linkInputRef.current;
      input?.focus();
      input?.select();
      input?.setSelectionRange(0, input.value.length);

      try {
        if (document.execCommand("copy")) {
          setCopied(true);
          return;
        }
      } catch {
        // Keep the link selected so the user can copy it manually.
      }

      setCopied(false);
      setError(copy.manualCopy);
    }
  }

  async function revokeLink(shareId: string) {
    setRevoking(shareId);
    setError("");
    try {
      await revokeAiReportShare(shareId);
      setShares((current) => current.map((item) => item.shareId === shareId
        ? { ...item, revokedAt: new Date().toISOString() }
        : item));
    } catch (cause) {
      setError(cause instanceof Error ? localizeAiError(cause.message, language) : copy.revokeError);
    } finally {
      setRevoking(null);
    }
  }

  function linkStatus(share: AiReportShare) {
    if (share.revokedAt) return copy.revoked;
    if (new Date(share.expiresAt).getTime() <= Date.now()) return copy.expired;
    return copy.active;
  }

  return (
    <section className="rounded-[22px] border border-[#e3e8e5] bg-[#fffefa] p-5 shadow-[0_12px_42px_rgba(28,48,56,.035)] sm:p-6" data-testid="ai-report-sharing">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-[#e9f4f0] text-[#167b70]"><Link2 size={18} /></span>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-[#172639]">{copy.title}</h2>
          <p className="mt-1 text-xs leading-6 text-[#788594]">{copy.description}</p>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#e2ebe5] bg-[#f5f8f5] p-3 text-xs leading-6 text-[#40566a]">
        <ShieldCheck size={16} className="mt-1 shrink-0 text-[#167b70]" />
        <p>{copy.privacy}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="grid gap-1.5 text-xs font-bold text-[#536273]">
          <span>{copy.expiration}</span>
          <select
            value={expiresInDays}
            onChange={(event) => setExpiresInDays(Number(event.target.value) as 1 | 7 | 30)}
            className="min-h-11 rounded-xl border border-[#dfe5e7] bg-white px-3 text-sm text-[#172639]"
            data-testid="select-report-share-expiration"
          >
            {[1, 7, 30].map((days) => <option key={days} value={days}>{days} {days === 1 ? copy.day : copy.days}</option>)}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void createLink()}
          disabled={creating}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#101b30] px-4 text-xs font-bold text-white disabled:opacity-60"
          data-testid="button-create-report-share"
        >
          {creating ? <LoaderCircle size={15} className="animate-spin" /> : <Link2 size={15} />}
          {creating ? copy.creating : copy.create}
        </button>
      </div>

      {latestLink && <div className="mt-4 rounded-xl border border-[#cfe5db] bg-[#f1f8f4] p-3" data-testid="report-share-created">
        <p className="text-xs font-bold text-[#12665e]">{notice}</p>
        <p className="mt-1 text-[11px] leading-5 text-[#536273]">{copy.oneTime}</p>
        <div className="mt-2 flex gap-2">
          <input
            ref={linkInputRef}
            aria-label={copy.copy}
            readOnly
            value={latestLink}
            onFocus={(event) => event.currentTarget.select()}
            className="min-w-0 flex-1 rounded-lg border border-[#d8e3dc] bg-white px-3 py-2 text-xs text-[#344258]"
            dir="ltr"
            data-testid="input-report-share-link"
          />
          <button type="button" onClick={() => void copyLink()} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#167b70] px-3 text-xs font-bold text-white" data-testid="button-copy-report-share">
            {copied ? <Check size={14} /> : <Clipboard size={14} />}
            {copied ? copy.copied : copy.copy}
          </button>
        </div>
      </div>}

      {notice && !latestLink && <p role="status" className="mt-3 text-xs text-[#12665e]">{notice}</p>}
      {error && <p role="alert" className="mt-3 rounded-lg bg-[#fff1ed] px-3 py-2 text-xs leading-5 text-[#a34d43]" data-testid="report-share-error">{error}</p>}

      <div className="mt-6 border-t border-[#e8ece8] pt-4">
        <h3 className="text-sm font-extrabold text-[#172639]">{copy.activeLinks}</h3>
        {loading ? <p className="mt-3 flex items-center gap-2 text-xs text-[#788594]" role="status"><LoaderCircle size={14} className="animate-spin" />{copy.loading}</p>
          : shares.length === 0 ? <p className="mt-3 text-xs text-[#788594]">{copy.noLinks}</p>
            : <ul className="mt-3 space-y-2">
              {shares.map((share) => {
                const status = linkStatus(share);
                const isActive = status === copy.active;
                return <li key={share.shareId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e8ece8] bg-white p-3" data-testid={`report-share-${share.shareId}`}>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#344258]">
                      <span>{copy.period}: {share.period}</span>
                      <span aria-hidden="true">·</span>
                      <span>{copy.currency}: {share.currencyCode}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${isActive ? "bg-[#e5f3eb] text-[#236e4e]" : "bg-[#f1f3f3] text-[#687682]"}`}>{status}</span>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-[#788594]"><span>{copy.expires}: {formatDate(share.expiresAt, language)}</span></p>
                  </div>
                  {isActive && <button
                    type="button"
                    onClick={() => void revokeLink(share.shareId)}
                    disabled={revoking === share.shareId}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#eed3cf] px-3 text-[11px] font-bold text-[#9c4b43] disabled:opacity-60"
                    data-testid={`button-revoke-report-share-${share.shareId}`}
                  >
                    {revoking === share.shareId ? <LoaderCircle size={13} className="animate-spin" /> : <X size={13} />}
                    {revoking === share.shareId ? copy.revoking : copy.revoke}
                  </button>}
                </li>;
              })}
            </ul>}
      </div>
    </section>
  );
}
