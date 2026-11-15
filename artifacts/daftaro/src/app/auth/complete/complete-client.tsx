"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, LogOut } from "lucide-react";
import { supabase } from "../../../lib/supabase";

export default function CompleteClient() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        setError(true);
        setLoading(false);
        return;
      }
      if (!data.session) {
        router.replace("/auth");
        return;
      }
      setEmail(data.session.user.email ?? null);
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setError(true);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [router]);

  async function signOut() {
    setSigningOut(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(true);
      setSigningOut(false);
      return;
    }
    router.replace("/");
  }

  return (
    <main dir="rtl" className="grid min-h-[100dvh] place-items-center bg-[#f5f7fa] px-5 py-10 text-[#101b30]">
      <section className="w-full max-w-xl rounded-[28px] border border-[#e4e9ee] bg-white p-8 text-center shadow-[0_24px_80px_rgba(16,27,48,.09)] sm:p-12">
        {loading ? (
          <>
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#eaf6f3]">
              <span className="size-5 animate-spin rounded-full border-2 border-[#16a085]/25 border-t-[#16a085]" />
            </span>
            <p className="mt-5 text-sm text-[#68758a]">جارٍ التحقق من جلستك…</p>
          </>
        ) : error ? (
          <>
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fff0ef] text-xl font-bold text-[#a43d35]">!</span>
            <h1 className="mt-6 text-2xl font-extrabold">تعذر التحقق من الجلسة</h1>
            <p className="mt-3 text-sm leading-7 text-[#68758a]">تحقق من اتصالك وحاول تسجيل الدخول مرة أخرى.</p>
            <Link href="/auth" className="mt-7 inline-flex rounded-xl bg-[#101b30] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1b2c49]">
              تسجيل الدخول
            </Link>
          </>
        ) : (
          <>
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#eaf6f3] text-[#16a085]">
              <Check size={26} />
            </span>
            <p className="mt-6 text-xs font-bold tracking-[.12em] text-[#9a804a]">Daftaro</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em]">تم تسجيل الدخول</h1>
            {email && <p className="mt-3 break-all text-sm text-[#68758a]" dir="ltr">{email}</p>}
            <p className="mx-auto mt-5 max-w-md text-sm leading-7 text-[#68758a]">
              حسابك جاهز. هذه المرحلة تجهز المصادقة فقط؛ ستُضاف بيانات المشروع واللوحة المالية في مراحل لاحقة.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/" className="rounded-xl border border-[#d9dfe6] px-5 py-3 text-sm font-bold text-[#344258] transition hover:border-[#d6b878]">
                العودة إلى الرئيسية
              </Link>
              <button
                type="button"
                onClick={signOut}
                disabled={signingOut}
                className="inline-flex items-center gap-2 rounded-xl bg-[#101b30] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1b2c49] disabled:opacity-60"
              >
                <LogOut size={16} />
                {signingOut ? "جارٍ تسجيل الخروج…" : "تسجيل الخروج"}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
