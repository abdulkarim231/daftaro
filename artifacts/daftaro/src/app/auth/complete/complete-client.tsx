"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Building2, Check, LogOut, Save, ShieldCheck } from "lucide-react";
import { supabase } from "../../../lib/supabase";

type Language = "ar" | "en";
type Profile = {
  business_name: string;
  business_type: string | null;
  country_code: string;
  currency_code: string;
};

const businessTypes = [
  { value: "food", ar: "حلويات ومخبوزات", en: "Food and baking" },
  { value: "perfumes", ar: "عطور وبخور", en: "Perfumes and incense" },
  { value: "clothing", ar: "ملابس وإكسسوارات", en: "Clothing and accessories" },
  { value: "gifts", ar: "هدايا وتوزيعات", en: "Gifts and favors" },
  { value: "handmade", ar: "منتجات يدوية", en: "Handmade products" },
  { value: "online_store", ar: "متجر إلكتروني", en: "Online store" },
  { value: "other", ar: "نشاط آخر", en: "Other" },
];

const countries = [
  { value: "KW", ar: "الكويت", en: "Kuwait" },
  { value: "SA", ar: "السعودية", en: "Saudi Arabia" },
  { value: "AE", ar: "الإمارات", en: "United Arab Emirates" },
  { value: "BH", ar: "البحرين", en: "Bahrain" },
  { value: "QA", ar: "قطر", en: "Qatar" },
  { value: "OM", ar: "عُمان", en: "Oman" },
  { value: "OTHER", ar: "دولة أخرى", en: "Other country" },
];

const currencies = ["KWD", "SAR", "AED", "BHD", "QAR", "OMR", "USD"];

const copy = {
  ar: {
    title: "أكمل ملف نشاطك",
    intro: "أضف معلومات أساسية عن نشاطك. ستُحفظ بأمان ضمن حسابك، ويمكنك تعديلها لاحقًا.",
    businessName: "اسم النشاط",
    businessNamePlaceholder: "مثال: مخبز دانة",
    businessType: "نوع النشاط",
    chooseType: "اختر نوع النشاط",
    country: "الدولة",
    currency: "العملة الأساسية",
    save: "حفظ الملف التجاري",
    saving: "جارٍ حفظ الملف…",
    saved: "تم حفظ الملف التجاري بنجاح.",
    saveError: "تعذر حفظ الملف. تحقق من الاتصال ثم أعد المحاولة.",
    loadError: "تعذر تحميل ملف النشاط. أعد تحميل الصفحة.",
    signOut: "تسجيل الخروج",
    signingOut: "جارٍ تسجيل الخروج…",
    account: "الحساب",
    home: "العودة إلى الرئيسية",
    language: "EN",
    loading: "جارٍ تحميل ملف نشاطك…",
    trust: "بيانات نشاطك خاصة بحسابك فقط.",
    section: "الملف التجاري",
    editHint: "يمكنك تحديث المعلومات وحفظ التعديلات في أي وقت.",
    continueDashboard: "فتح لوحة التحكم",
  },
  en: {
    title: "Complete your business profile",
    intro: "Add a few details about your business. They are saved securely to your account and can be edited later.",
    businessName: "Business name",
    businessNamePlaceholder: "For example, Dana Bakery",
    businessType: "Business type",
    chooseType: "Choose a business type",
    country: "Country",
    currency: "Primary currency",
    save: "Save business profile",
    saving: "Saving profile…",
    saved: "Business profile saved.",
    saveError: "We couldn't save the profile. Check your connection and try again.",
    loadError: "We couldn't load your profile. Refresh the page and try again.",
    signOut: "Sign out",
    signingOut: "Signing out…",
    account: "Account",
    home: "Back to home",
    language: "عربي",
    loading: "Loading your business profile…",
    trust: "Your business details are private to your account.",
    section: "Business profile",
    editHint: "You can update and save these details at any time.",
    continueDashboard: "Open dashboard",
  },
} as const;

export default function CompleteClient() {
  const router = useRouter();
  const [language, setLanguage] = useState<Language>("ar");
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [countryCode, setCountryCode] = useState("KW");
  const [currencyCode, setCurrencyCode] = useState("KWD");
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const rtl = language === "ar";
  const text = copy[language];
  const languageRef = useRef(language);

  useEffect(() => {
    languageRef.current = language;
    document.documentElement.lang = language;
    document.documentElement.dir = rtl ? "rtl" : "ltr";
    document.body.classList.toggle("arabic", rtl);
  }, [language, rtl]);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (!active) return;
        if (sessionError) throw sessionError;
        if (!data.session) {
          router.replace("/auth");
          return;
        }

        const currentUser = data.session.user;
        setEmail(currentUser.email ?? null);
        setUserId(currentUser.id);

        const { data: profile, error: profileError } = await supabase
          .from("business_profiles")
          .select("business_name, business_type, country_code, currency_code")
          .eq("user_id", currentUser.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!active) return;

        if (profile) {
          const savedProfile = profile as Profile;
          setBusinessName(savedProfile.business_name);
          setBusinessType(savedProfile.business_type ?? "");
          setCountryCode(savedProfile.country_code);
          setCurrencyCode(savedProfile.currency_code);
          setHasProfile(true);
        }
        setLoading(false);
      } catch {
        if (!active) return;
        setNotice({ kind: "error", message: copy[languageRef.current].loadError });
        setLoading(false);
      }
    }

    void loadProfile();
    return () => {
      active = false;
    };
  }, [router]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      router.replace("/auth");
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const { error: saveError } = await supabase.from("business_profiles").upsert(
        {
          user_id: userId,
          business_name: businessName.trim(),
          business_type: businessType || null,
          country_code: countryCode,
          currency_code: currencyCode,
        },
        { onConflict: "user_id" },
      );
      if (saveError) throw saveError;
      setHasProfile(true);
      setNotice({ kind: "success", message: text.saved });
    } catch {
      setNotice({ kind: "error", message: text.saveError });
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setNotice({ kind: "error", message: text.saveError });
      setSigningOut(false);
      return;
    }
    router.replace("/");
  }

  return (
    <main dir={rtl ? "rtl" : "ltr"} className="min-h-[100dvh] bg-[#f5f7fa] px-4 py-6 text-[#101b30] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 text-[#101b30]">
            <span className="relative grid size-10 place-items-center rounded-xl bg-[#101b30]">
              <span className="absolute inset-[5px] rounded-[8px] border border-[#d6b878]/70" />
              <span className="relative text-xl font-semibold text-[#d6b878]">د</span>
            </span>
            <span className="text-xl font-extrabold tracking-[-.04em]">Daftaro</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            {email && <span className="hidden max-w-48 truncate text-xs text-[#68758a] sm:inline" dir="ltr">{email}</span>}
            <button
              type="button"
              onClick={() => setLanguage(rtl ? "en" : "ar")}
              className="rounded-full border border-[#d9dfe6] bg-white px-3.5 py-2 text-xs font-bold text-[#59677c] transition hover:border-[#d6b878]"
              aria-label={rtl ? "Switch to English" : "التبديل إلى العربية"}
            >
              {text.language}
            </button>
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="inline-flex items-center gap-2 rounded-xl bg-[#101b30] px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-[#1b2c49] disabled:opacity-60 sm:px-4"
            >
              <LogOut size={15} />
              <span>{signingOut ? text.signingOut : text.signOut}</span>
            </button>
          </div>
        </header>

        <section className="mx-auto mt-8 max-w-2xl overflow-hidden rounded-[28px] border border-[#e4e9ee] bg-white shadow-[0_24px_80px_rgba(16,27,48,.09)] sm:mt-12">
          <div className="bg-[#101b30] px-6 py-7 text-white sm:px-10 sm:py-9">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-white/10 text-[#d6b878]">
                <Building2 size={22} />
              </span>
              <div>
                <p className="text-xs font-bold tracking-[.12em] text-[#d6b878]">{text.section}</p>
                <h1 className="mt-1 text-2xl font-extrabold tracking-[-.03em] sm:text-3xl">{text.title}</h1>
              </div>
            </div>
            <p className="mt-5 max-w-xl text-sm leading-7 text-[#c4ccda]">{text.intro}</p>
          </div>

          <div className="p-6 sm:p-10">
            {loading ? (
              <div className="py-8 text-center" role="status" aria-live="polite">
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eaf6f3]">
                  <span className="size-5 animate-spin rounded-full border-2 border-[#16a085]/25 border-t-[#16a085]" />
                </span>
                <p className="mt-4 text-sm text-[#68758a]">{text.loading}</p>
              </div>
            ) : (
              <>
                <form onSubmit={saveProfile} className="space-y-5">
                  <div>
                    <label htmlFor="business-name" className="mb-2 block text-sm font-semibold">{text.businessName}</label>
                    <input
                      id="business-name"
                      type="text"
                      autoComplete="organization"
                      required
                      maxLength={120}
                      value={businessName}
                      onChange={(event) => setBusinessName(event.target.value)}
                      className="w-full rounded-xl border border-[#dfe5ea] bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-[#9ba5b2] focus:border-[#16a085] focus:ring-4 focus:ring-[#16a085]/10"
                      placeholder={text.businessNamePlaceholder}
                    />
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="business-type" className="mb-2 block text-sm font-semibold">{text.businessType}</label>
                      <select
                        id="business-type"
                        value={businessType}
                        onChange={(event) => setBusinessType(event.target.value)}
                        className="w-full rounded-xl border border-[#dfe5ea] bg-white px-4 py-3.5 text-sm outline-none transition focus:border-[#16a085] focus:ring-4 focus:ring-[#16a085]/10"
                      >
                        <option value="">{text.chooseType}</option>
                        {businessTypes.map((type) => (
                          <option key={type.value} value={type.value}>{rtl ? type.ar : type.en}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="business-country" className="mb-2 block text-sm font-semibold">{text.country}</label>
                      <select
                        id="business-country"
                        value={countryCode}
                        onChange={(event) => setCountryCode(event.target.value)}
                        className="w-full rounded-xl border border-[#dfe5ea] bg-white px-4 py-3.5 text-sm outline-none transition focus:border-[#16a085] focus:ring-4 focus:ring-[#16a085]/10"
                      >
                        {countries.map((country) => (
                          <option key={country.value} value={country.value}>{rtl ? country.ar : country.en}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="business-currency" className="mb-2 block text-sm font-semibold">{text.currency}</label>
                    <select
                      id="business-currency"
                      value={currencyCode}
                      onChange={(event) => setCurrencyCode(event.target.value)}
                      className="w-full rounded-xl border border-[#dfe5ea] bg-white px-4 py-3.5 text-sm outline-none transition focus:border-[#16a085] focus:ring-4 focus:ring-[#16a085]/10"
                    >
                      {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                    </select>
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
                    disabled={saving || !businessName.trim()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#101b30] px-5 py-4 text-sm font-bold text-white transition hover:bg-[#1b2c49] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? <span>{text.saving}</span> : <><Save size={17} />{text.save}</>}
                  </button>
                </form>

                <div className="mt-6 flex items-start gap-2 border-t border-[#eef1f4] pt-5 text-xs leading-6 text-[#7c8898]">
                  <ShieldCheck size={16} className="mt-1 shrink-0 text-[#16a085]" />
                  <span>{text.trust} {text.editHint}</span>
                </div>
                {hasProfile && (
                  <Link
                    href="/dashboard"
                    data-testid="link-dashboard"
                    className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-[#d6b878] px-5 py-3.5 text-sm font-bold text-[#101b30] transition hover:bg-[#f6f2e8]"
                  >
                    {text.continueDashboard}
                  </Link>
                )}
              </>
            )}

            <div className="mt-6 flex items-center justify-between gap-4 text-xs text-[#8a95a4]">
              <span className="inline-flex items-center gap-1.5">
                <Check size={14} className="text-[#16a085]" />
                {text.account}
              </span>
              <Link href="/" className="font-semibold text-[#59677c] transition hover:text-[#16a085]">
                {text.home}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
