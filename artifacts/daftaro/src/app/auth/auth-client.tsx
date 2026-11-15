"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { supabase } from "../../lib/supabase";

type Language = "ar" | "en";
type Mode = "signin" | "signup";

const text = {
  ar: {
    home: "العودة إلى الصفحة الرئيسية",
    language: "EN",
    eyebrow: "دفترُك — حسابك",
    title: "مساحتك تبدأ من هنا.",
    intro: "سجّل الدخول للوصول إلى لوحة نشاطك وسجل معاملاتك، أو أنشئ حسابًا جديدًا للبدء.",
    signin: "تسجيل الدخول",
    signup: "إنشاء حساب",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    passwordHint: "استخدم ٨ أحرف على الأقل.",
    submitSignin: "الدخول إلى حسابي",
    submitSignup: "إنشاء حسابي",
    submitting: "جارٍ الإرسال…",
    showPassword: "إظهار كلمة المرور",
    hidePassword: "إخفاء كلمة المرور",
    confirmationSent: "أرسلنا رابط تأكيد إلى بريدك. افتحه من هذا المتصفح لإكمال التسجيل.",
    invalidLogin: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    emailNotConfirmed: "أكد بريدك من الرابط المرسل إليك، ثم سجّل الدخول.",
    alreadyRegistered: "هذا البريد مسجل بالفعل. جرّب تسجيل الدخول.",
    weakPassword: "كلمة المرور لا تحقق متطلبات الأمان. استخدم ٨ أحرف على الأقل.",
    redirectNotAllowed: "عنوان العودة غير مسموح. أضف صفحة التأكيد إلى إعدادات Auth في Supabase.",
    genericError: "تعذر إكمال العملية. تحقق من البيانات والاتصال ثم أعد المحاولة.",
    trust: "مصادقة آمنة عبر Supabase. بياناتك المالية محفوظة ضمن حسابك.",
    legal: "بعد تسجيل الدخول، أكمل ملف نشاطك للوصول إلى لوحة التحكم والسجلات المالية.",
  },
  en: {
    home: "Back to home",
    language: "عربي",
    eyebrow: "Daftaro account",
    title: "Your space starts here.",
    intro: "Sign in to open your business dashboard and transaction ledger, or create an account to get started.",
    signin: "Sign in",
    signup: "Create account",
    email: "Email address",
    password: "Password",
    passwordHint: "Use at least 8 characters.",
    submitSignin: "Sign in to my account",
    submitSignup: "Create my account",
    submitting: "Sending…",
    showPassword: "Show password",
    hidePassword: "Hide password",
    confirmationSent: "We sent a confirmation link to your email. Open it in this browser to finish signing up.",
    invalidLogin: "The email or password is incorrect.",
    emailNotConfirmed: "Confirm your email from the link we sent, then sign in.",
    alreadyRegistered: "This email is already registered. Try signing in.",
    weakPassword: "The password does not meet the security requirements. Use at least 8 characters.",
    redirectNotAllowed: "The return address is not allowed. Add the confirmation page in Supabase Auth settings.",
    genericError: "We couldn't complete that request. Check your details and connection, then try again.",
    trust: "Secure authentication through Supabase. Your financial records stay within your account.",
    legal: "After signing in, complete your business profile to open the dashboard and financial records.",
  },
} as const;

function getBasePath() {
  const path = window.location.pathname.replace(/\/+$/, "");
  const routeSuffix = path.endsWith("/auth/signup") ? "/auth/signup" : "/auth";
  return path.endsWith(routeSuffix) ? path.slice(0, -routeSuffix.length) : "";
}

function friendlyError(error: unknown, language: Language) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  const copy = text[language];

  if (message.includes("invalid login credentials")) return copy.invalidLogin;
  if (message.includes("email not confirmed")) return copy.emailNotConfirmed;
  if (message.includes("already registered") || message.includes("user already exists")) return copy.alreadyRegistered;
  if (message.includes("password") && (message.includes("least") || message.includes("short"))) return copy.weakPassword;
  if (message.includes("redirect") || message.includes("url not allowed")) return copy.redirectNotAllowed;
  return copy.genericError;
}

export default function AuthClient({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [language, setLanguage] = useState<Language>("ar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const rtl = language === "ar";
  const copy = text[language];

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = rtl ? "rtl" : "ltr";
    document.body.classList.toggle("arabic", rtl);
  }, [language, rtl]);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) router.replace("/auth/complete");
    }).catch(() => {
      // The form remains available if a stored session cannot be read.
    });
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);

    try {
      if (mode === "signup") {
        const callbackUrl = `${window.location.origin}${getBasePath()}/auth/callback`;
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: callbackUrl },
        });
        if (error) throw error;

        if (data.session) {
          router.replace("/auth/complete");
          return;
        }

        setNotice({ kind: "success", message: copy.confirmationSent });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        router.replace("/auth/complete");
        return;
      }
    } catch (error) {
      setNotice({ kind: "error", message: friendlyError(error, language) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main dir={rtl ? "rtl" : "ltr"} className="min-h-[100dvh] bg-[#f5f7fa] px-4 py-6 text-[#101b30] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <Link href="/" className="rounded-lg text-sm font-semibold text-[#59677c] transition hover:text-[#16a085]">
            <span className="inline-flex items-center gap-2">
              {rtl && <ArrowLeft size={16} />}
              {copy.home}
              {!rtl && <ArrowLeft size={16} className="rotate-180" />}
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setLanguage(rtl ? "en" : "ar")}
            className="rounded-full border border-[#d9dfe6] bg-white px-3.5 py-2 text-xs font-bold text-[#59677c] transition hover:border-[#d6b878]"
            aria-label={rtl ? "Switch to English" : "التبديل إلى العربية"}
          >
            {copy.language}
          </button>
        </header>

        <div className="mt-8 grid overflow-hidden rounded-[28px] border border-[#e4e9ee] bg-white shadow-[0_24px_80px_rgba(16,27,48,.09)] lg:mt-12 lg:grid-cols-[.88fr_1.12fr]">
          <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#101b30] p-9 text-white lg:flex xl:p-12">
            <div className="absolute -end-20 -top-20 size-72 rounded-full border border-[#d6b878]/20" />
            <div className="absolute -end-10 -top-10 size-52 rounded-full border border-[#d6b878]/20" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <span className="relative grid size-10 place-items-center rounded-xl bg-white/10">
                  <span className="absolute inset-[5px] rounded-[8px] border border-[#d6b878]/70" />
                  <span className="relative text-xl font-semibold text-[#d6b878]">د</span>
                </span>
                <span className="text-xl font-extrabold tracking-[-.04em]">Daftaro</span>
              </div>
              <p className="mt-16 text-xs font-bold tracking-[.16em] text-[#d6b878]">{copy.eyebrow}</p>
              <h1 className="mt-4 max-w-sm text-4xl font-extrabold leading-[1.3] tracking-[-.04em]">
                {rtl ? "خطوة واضحة نحو فهم عملك." : "A clearer step toward understanding your business."}
              </h1>
              <p className="mt-5 max-w-sm text-sm leading-8 text-[#c4ccda]">
                {rtl ? "دفترُك يبدأ بتجربة بسيطة وآمنة، ثم ينمو مع احتياجات مشروعك." : "Daftaro starts with a simple, secure experience and grows with your business."}
              </p>
            </div>
            <div className="relative mt-12 flex items-center gap-2 text-xs text-[#c4ccda]">
              <ShieldCheck size={16} className="text-[#d6b878]" />
              {copy.trust}
            </div>
          </aside>

          <section className="p-6 sm:p-10 lg:p-12">
            <div className="mb-7 lg:hidden">
              <div className="flex items-center gap-3">
                <span className="relative grid size-10 place-items-center rounded-xl bg-[#101b30]">
                  <span className="absolute inset-[5px] rounded-[8px] border border-[#d6b878]/70" />
                  <span className="relative text-xl font-semibold text-[#d6b878]">د</span>
                </span>
                <span className="text-xl font-extrabold tracking-[-.04em]">Daftaro</span>
              </div>
            </div>
            <p className="text-xs font-bold tracking-[.12em] text-[#9a804a]">{copy.eyebrow}</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">
              {mode === "signin" ? copy.signin : copy.signup}
            </h2>
            <p className="mt-3 max-w-md text-sm leading-7 text-[#68758a]">{copy.intro}</p>

            <div className="mt-7 grid grid-cols-2 rounded-xl bg-[#f3f5f7] p-1" role="tablist" aria-label={rtl ? "نوع العملية" : "Authentication method"}>
              {(["signin", "signup"] as const).map((option) => (
                <Link
                  key={option}
                  href={option === "signup" ? "/auth/signup" : "/auth"}
                  role="tab"
                  aria-selected={mode === option}
                  aria-current={mode === option ? "page" : undefined}
                  className={`cursor-pointer rounded-lg px-3 py-3 text-center text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16a085] ${mode === option ? "bg-white text-[#101b30] shadow-sm" : "text-[#4c5a6f] hover:bg-white/75 hover:text-[#101b30]"}`}
                >
                  {copy[option]}
                </Link>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <div>
                <label htmlFor="auth-email" className="mb-2 block text-sm font-semibold">{copy.email}</label>
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  inputMode="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-[#dfe5ea] bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-[#9ba5b2] focus:border-[#16a085] focus:ring-4 focus:ring-[#16a085]/10"
                  placeholder={rtl ? "name@example.com" : "name@example.com"}
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor="auth-password" className="text-sm font-semibold">{copy.password}</label>
                  {mode === "signup" && <span className="text-[11px] text-[#8994a3]">{copy.passwordHint}</span>}
                </div>
                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    minLength={8}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-xl border border-[#dfe5ea] bg-white px-4 py-3.5 text-sm outline-none transition focus:border-[#16a085] focus:ring-4 focus:ring-[#16a085]/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className={`absolute top-1/2 -translate-y-1/2 rounded-md p-2 text-[#7c8898] hover:text-[#101b30] ${rtl ? "left-2" : "right-2"}`}
                    aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {notice && (
                <p
                  role={notice.kind === "error" ? "alert" : "status"}
                  aria-live="polite"
                  className={`rounded-xl px-4 py-3 text-sm leading-6 ${notice.kind === "error" ? "bg-[#fff0ef] text-[#a43d35]" : "bg-[#eaf6f3] text-[#16715f]"}`}
                >
                  {notice.message}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#101b30] px-5 py-4 text-sm font-bold text-white transition hover:bg-[#1b2c49] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? copy.submitting : mode === "signin" ? copy.submitSignin : copy.submitSignup}
              </button>
            </form>

            <p className="mt-6 text-center text-[11px] leading-6 text-[#8a95a4]">{copy.legal}</p>
          </section>
        </div>
      </div>
    </main>
  );
}
