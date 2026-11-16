"use client";

import { useEffect, useState } from "react";
import { AlertCircle, LoaderCircle, Printer, ShieldCheck } from "lucide-react";
import { PrintableAiReport } from "../../components/printable-ai-report";
import { getSharedAiReport, type AiLanguage } from "../../lib/ai-api";
import type { PrintableAiReportData } from "../../lib/printable-ai-report";
import { useAppLanguage } from "../../hooks/use-app-language";

const COPY = {
  ar: {
    loading: "جارٍ فتح التقرير…",
    title: "تقرير مشترك من دفترُك",
    readOnly: "عرض للقراءة فقط",
    privacy: "هذا الرابط يفتح تقريرًا محددًا فقط. لا يتيح الوصول إلى الحساب أو بيانات العملاء.",
    print: "طباعة أو حفظ PDF",
    unavailable: "هذا الرابط غير صالح أو انتهت صلاحيته أو ألغاه صاحبه.",
    askOwner: "اطلب من صاحب التقرير إرسال رابط جديد.",
    setup: "مشاركة التقارير غير مهيأة بعد. أبلغ صاحب التطبيق بتطبيق تحديث قاعدة البيانات.",
    language: "English",
  },
  en: {
    loading: "Opening the report…",
    title: "A shared Daftaro report",
    readOnly: "Read-only view",
    privacy: "This link opens one report only. It does not provide account or customer-data access.",
    print: "Print or save PDF",
    unavailable: "This link is invalid, expired, or has been revoked.",
    askOwner: "Ask the report owner to send a new link.",
    setup: "Report sharing is not set up yet. Ask the app owner to apply the database update.",
    language: "العربية",
  },
} as const;

function validShareId(value: string | null): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

export default function SharedReportClient() {
  const [language, setLanguage] = useAppLanguage();
  const [report, setReport] = useState<PrintableAiReportData | null>(null);
  const [error, setError] = useState<"unavailable" | "setup" | null>(null);
  const [loading, setLoading] = useState(true);
  const text = COPY[language as AiLanguage];

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.body.classList.toggle("arabic", language === "ar");
  }, [language]);

  useEffect(() => {
    let active = true;
    const shareId = new URLSearchParams(window.location.search).get("id");
    const token = window.location.hash.slice(1);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);

    if (!validShareId(shareId) || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
      setError("unavailable");
      setLoading(false);
      return () => { active = false; };
    }

    void getSharedAiReport(shareId, token)
      .then((sharedReport) => {
        if (active) setReport(sharedReport);
      })
      .catch((cause) => {
        if (!active) return;
        const message = cause instanceof Error ? cause.message : COPY.ar.unavailable;
        setError(/report sharing.*migration|sharing storage.*not ready/i.test(message) ? "setup" : "unavailable");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  const rtl = language === "ar";
  return (
    <main dir={rtl ? "rtl" : "ltr"} className="min-h-[100dvh] bg-[#f4f6f4] px-4 py-6 text-[#172639] sm:px-7 sm:py-10" data-testid="shared-ai-report-page">
      <div className="screen-only mx-auto max-w-[960px]">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-[#e3e8e5] bg-[#fffefa] px-5 py-4">
          <div>
            <p className="text-[10px] font-extrabold tracking-[.16em] text-[#167b70]">DAFTARO</p>
            <h1 className="mt-1 text-xl font-extrabold">{text.title}</h1>
          </div>
          <button
            type="button"
            onClick={() => setLanguage(rtl ? "en" : "ar")}
            className="min-h-10 rounded-xl border border-[#dfe5e7] bg-white px-4 text-xs font-bold"
            data-testid="button-shared-report-language"
          >
            {text.language}
          </button>
        </header>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#e2ebe5] bg-[#f5f8f5] p-3 text-xs leading-6 text-[#40566a]">
          <ShieldCheck size={16} className="mt-1 shrink-0 text-[#167b70]" />
          <p><b>{text.readOnly}.</b> {text.privacy}</p>
        </div>

        {loading && <div className="mt-5 flex items-center gap-2 rounded-xl border border-[#e3e8e5] bg-white p-5 text-sm text-[#788594]" role="status" data-testid="shared-report-loading"><LoaderCircle size={17} className="animate-spin text-[#167b70]" />{text.loading}</div>}
        {error && <div className="mt-5 flex items-start gap-2 rounded-xl border border-[#f0d2cc] bg-[#fff2ef] p-5 text-sm leading-6 text-[#9c4b43]" role="alert" data-testid="shared-report-error"><AlertCircle size={17} className="mt-1 shrink-0" /><div><p>{error === "setup" ? text.setup : text.unavailable}</p>{error === "unavailable" && <p className="mt-1 text-xs">{text.askOwner}</p>}</div></div>}
        {report && <div className="mt-5 flex justify-end">
          <button type="button" onClick={() => window.print()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#101b30] px-4 text-xs font-bold text-white" data-testid="button-print-shared-report"><Printer size={15} />{text.print}</button>
        </div>}
      </div>
      {report && <PrintableAiReport report={report} language={language as AiLanguage} />}
    </main>
  );
}
