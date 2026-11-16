"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, RefreshCw, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

type TestRecord = {
  message: string;
  created_at: string;
};

type CheckState = "loading" | "connected" | "missing" | "error";

export default function ConnectionTestClient() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<CheckState>("loading");
  const [record, setRecord] = useState<TestRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkConnection() {
      setState("loading");
      setError("");

      try {
        const { data, error: queryError } = await supabase
          .from("daftaro_connection_test")
          .select("message, created_at")
          .eq("message", "Daftaro Supabase connection test")
          .limit(1)
          .maybeSingle();

        if (!active) return;

        if (queryError) {
          setError(queryError.message);
          setState("error");
          return;
        }

        if (!data) {
          setState("missing");
          return;
        }

        setRecord(data);
        setState("connected");
      } catch (cause) {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Unexpected error while checking the Supabase connection.",
        );
        setState("error");
        return;
      }
    }

    void checkConnection();

    return () => {
      active = false;
    };
  }, [attempt]);

  const statusContent = {
    loading: {
      icon: <LoaderCircle className="animate-spin text-[#927a46]" size={22} />,
      title: "جارٍ فحص الاتصال",
      detail: "نتحقق من قراءة سجل الاختبار من Supabase.",
    },
    connected: {
      icon: <CheckCircle2 className="text-[#16866f]" size={22} />,
      title: "الاتصال يعمل",
      detail: "تمت قراءة سجل الاختبار بنجاح مع صلاحية قراءة محدودة.",
    },
    missing: {
      icon: <XCircle className="text-[#b4534a]" size={22} />,
      title: "لم يظهر سجل الاختبار",
      detail: "الاتصال وصل، لكن سجل الاختبار لم يظهر في الجدول.",
    },
    error: {
      icon: <XCircle className="text-[#b4534a]" size={22} />,
      title: "تعذّر الاتصال",
      detail: error || "تحقق من إعدادات Supabase وسياسة الوصول للجدول.",
    },
  }[state];

  return (
    <main
      className="min-h-screen bg-[#f5f7fa] px-5 py-12 text-[#101b30] sm:py-20"
      dir="rtl"
    >
      <section className="mx-auto max-w-2xl rounded-[28px] border border-[#e5e9ed] bg-white p-6 shadow-[0_20px_70px_rgba(16,27,48,.08)] sm:p-10">
        <p className="text-xs font-bold tracking-wide text-[#927a46]">
          Daftarik · إعداد الاتصال
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
          فحص اتصال Supabase
        </h1>
        <p className="mt-4 leading-8 text-[#59677c]">
          هذه صفحة اختبار مؤقتة للخطوة الثانية. تقرأ سجلًا تجريبيًا واحدًا فقط؛
          لا تحفظ بيانات مالية ولا تتيح الكتابة من المتصفح.
        </p>

        <div className="mt-8 flex items-start gap-4 rounded-2xl bg-[#f5f7fa] p-5">
          <div className="mt-0.5 shrink-0">{statusContent.icon}</div>
          <div>
            <h2 className="font-bold">{statusContent.title}</h2>
            <p className="mt-1 text-sm leading-7 text-[#687589]">
              {statusContent.detail}
            </p>
          </div>
        </div>

        {state === "connected" && record && (
          <dl className="mt-5 grid gap-3 rounded-2xl border border-[#e5e9ed] p-5 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="font-semibold text-[#687589]">السجل</dt>
              <dd dir="ltr">{record.message}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="font-semibold text-[#687589]">وقت الحفظ</dt>
              <dd dir="ltr">
                {new Intl.DateTimeFormat("ar-KW", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Asia/Kuwait",
                }).format(new Date(record.created_at))}
              </dd>
            </div>
          </dl>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setAttempt((current) => current + 1)}
            disabled={state === "loading"}
            className="inline-flex items-center gap-2 rounded-full bg-[#101b30] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1b2c49] disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw size={15} />
            إعادة الفحص
          </button>
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-[#d9dfe6] px-5 py-3 text-sm font-bold text-[#344258] transition hover:bg-[#f5f7fa]"
          >
            العودة إلى الصفحة الرئيسية
          </Link>
        </div>
      </section>
    </main>
  );
}
