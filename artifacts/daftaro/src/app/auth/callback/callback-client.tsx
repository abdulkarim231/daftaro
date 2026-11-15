"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

export default function CallbackClient() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (!error && data.session) {
        router.replace("/auth/complete");
      } else {
        setFailed(true);
      }
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main dir="rtl" className="grid min-h-[100dvh] place-items-center bg-[#f5f7fa] px-5 py-10 text-[#101b30]">
      <section className="w-full max-w-lg rounded-[26px] border border-[#e4e9ee] bg-white p-8 text-center shadow-[0_24px_80px_rgba(16,27,48,.09)] sm:p-10">
        <span className={`mx-auto grid size-14 place-items-center rounded-2xl ${failed ? "bg-[#fff0ef] text-[#a43d35]" : "bg-[#eaf6f3] text-[#16a085]"}`}>
          {failed ? "!" : <span className="size-5 animate-spin rounded-full border-2 border-[#16a085]/25 border-t-[#16a085]" />}
        </span>
        <h1 className="mt-6 text-2xl font-extrabold">
          {failed ? "تعذر تأكيد البريد" : "جارٍ تأكيد حسابك"}
        </h1>
        <p className="mt-3 text-sm leading-7 text-[#68758a]">
          {failed
            ? "قد يكون الرابط منتهيًا أو غير مسموح. تحقق من إعدادات Auth في Supabase أو اطلب رابط تأكيد جديدًا."
            : "نستكمل تسجيل الدخول بأمان. اترك هذه الصفحة مفتوحة للحظات."}
        </p>
        {failed && (
          <Link href="/auth" className="mt-7 inline-flex rounded-xl bg-[#101b30] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1b2c49]">
            العودة لتسجيل الدخول
          </Link>
        )}
      </section>
    </main>
  );
}
