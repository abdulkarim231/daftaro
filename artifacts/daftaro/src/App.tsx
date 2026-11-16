"use client";

import Link from "next/link";
import { useEffect, useState } from 'react';
import {
  ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpLeft, Check, ChevronDown,
  CircleHelp, Compass, FileText, Heart, Layers3, Menu, Package, ShieldCheck,
  Sparkles, Wallet, X,
} from 'lucide-react';

type Lang = 'ar' | 'en';

const copy = {
  ar: {
    nav: ['الفكرة', 'كيف يعمل', 'لمن صُمّم', 'الأسئلة'],
    eyebrow: 'دفتر أوضح. قرار أهدأ.',
    titleStart: 'شغلك يكبر،',
    titleAccent: 'والربح يصير أوضح.',
    intro: 'دفترك مساحة مالية بسيطة لصاحب المشروع الصغير. يساعدك على فهم ما يدخل وما يخرج، وما يتبقى فعلًا — من دون أن تحتاج إلى خبرة محاسبية.',
    primary: 'اكتشف الفكرة',
    secondary: 'كيف يعمل دفترك؟',
    note: 'مصمم لأصحاب المشاريع الصغيرة والمنزلية في الخليج',
    visualKicker: 'مساحة عملك، على مهل',
    visualTitle: 'صورة أوضح لأعمالك',
    visualSub: 'كل ما يهمّك، في مكان واحد',
    income: 'الإيرادات',
    costs: 'المصروفات',
    result: 'ما يتبقى',
    preview: 'معاينة توضيحية',
    chartTitle: 'حركة المشروع',
    chartSub: 'نظرة بسيطة على الداخل والخارج',
    incomeLabel: 'داخل',
    costsLabel: 'خارج',
    insight: 'ملاحظة تساعدك',
    insightText: 'سجّل تكلفة التغليف مع كل طلب، لتقترب من معرفة ربحك الحقيقي.',
    section1Eyebrow: 'المشكلة ليست فيك',
    section1Title: 'البيع كثيرًا لا يعني دائمًا أن الربح واضح.',
    section1Text: 'طلبات ورسائل، إيصالات متناثرة، ومصاريف صغيرة يصعب تذكّرها. بين كل هذا، يصبح السؤال البسيط — «كم ربحت؟» — أصعب مما يجب.',
    pain1: 'دخل ومصاريف في أماكن مختلفة',
    pain2: 'تكلفة الطلب لا تقتصر على سعر المنتج',
    pain3: 'قرارات العمل مبنية على الإحساس لا الصورة الكاملة',
    bridge: 'دفترك يبدأ من هنا: ترتيب هادئ، يفهمه صاحب المشروع.',
    section2Eyebrow: 'بلا تعقيد',
    section2Title: 'من تفاصيل اليوم إلى صورة مفهومة.',
    section2Text: 'دفترك يخطط لجمع تفاصيل عملك الصغيرة في مساحة مرتبة، ثم عرضها بلغة واضحة تساعدك على اتخاذ الخطوة التالية.',
    steps: [
      ['١', 'سجّل ما يحدث', 'أضف المبيعات والمصروفات بالطريقة التي تناسب يومك.'],
      ['٢', 'رتّب التفاصيل', 'اجمع المنتجات والتكاليف والطلبات في صورة أسهل للمتابعة.'],
      ['٣', 'افهم ما يتبقى', 'شاهد ملخصًا أوضح يساعدك في التخطيط بثقة أكبر.'],
    ],
    section3Eyebrow: 'ما يخطط دفترك لتقديمه',
    section3Title: 'وضوح عملي، من أول طلب إلى نهاية الشهر.',
    feature1Title: 'صورة الربح الحقيقي', feature1Text: 'فهم ما يتبقى بعد احتساب التكاليف، لا الاكتفاء بمجموع المبيعات.',
    feature2Title: 'تنظيم المبيعات والمصاريف', feature2Text: 'مكان واحد لتفاصيل الطلبات والتكاليف اليومية التي قد تضيع بين الرسائل.',
    feature3Title: 'متابعة المنتجات', feature3Text: 'نظرة مرتبة على المنتجات وتكاليفها لتعرف ما يستحق اهتمامك.',
    feature4Title: 'ملخصات مفهومة', feature4Text: 'عرض واضح لأداء العمل يساعدك على ملاحظة التغيّر والتخطيط له.',
    section4Eyebrow: 'من واقع يومك',
    section4Title: 'لكل مشروع صغير طريقته. دفترك يتسع لها.',
    section4Text: 'سواء كنت تجهّز الطلبات من البيت أو تدير متجرًا صغيرًا، المهم أن تكون الصورة المالية على مقاس يومك — لا العكس.',
    persona1: 'مشاريع منزلية', persona1b: 'حلويات، عطور، أعمال يدوية',
    persona2: 'متاجر صغيرة', persona2b: 'منتجات مختارة وطلبات مباشرة',
    persona3: 'متاجر Instagram وWhatsApp', persona3b: 'الطلبات والمبيعات عبر الرسائل',
    quote: 'معرفة ما يتبقى بعد التكاليف تساعدك على تقييم وقتك وجهدك.',
    quoteBy: 'الفكرة الأساسية لدفترك',
    section5Eyebrow: 'صُمّم للطمأنينة',
    section5Title: 'أداة مالية تتحدث بلغتك، وتحترم وقتك.',
    trust1Title: 'واضح من البداية', trust1Text: 'لغة مباشرة بعيدًا عن المصطلحات المحاسبية الثقيلة.',
    trust2Title: 'على مقاس المشاريع الصغيرة', trust2Text: 'مصمم لواقع صاحب المشروع الفردي والمنزلي في الخليج.',
    trust3Title: 'خطوة بخطوة', trust3Text: 'تبدأ بالصورة التي تحتاجها اليوم، وتكبر مع احتياجك.',
    faqEyebrow: 'أسئلة شائعة',
    faqTitle: 'قبل أن تبدأ',
    faq: [
      ['هل أحتاج إلى خبرة في المحاسبة؟', 'لا. الفكرة أن تكون التفاصيل المالية مفهومة لصاحب المشروع نفسه، بلغة يومية وبلا تعقيد.'],
      ['هل دفترك مخصص للمشاريع المنزلية فقط؟', 'لا. الفكرة تناسب المشاريع المنزلية والمتاجر الصغيرة ومقدمي الخدمات الذين يريدون فهم دخلهم وتكاليفهم.'],
      ['هل أستطيع الاعتماد عليه لإقراراتي أو التزاماتي الرسمية؟', 'دفترك يهدف إلى تنظيم صورة عملك ومساعدتك على فهمها. لا يحل محل استشارة محاسب أو جهة مختصة بالمتطلبات الرسمية.'],
      ['متى يمكنني استخدامه؟', 'دفترك في مرحلة التخطيط حاليًا، وسيُعلن عن تفاصيل الإطلاق لاحقًا.'],
    ],
    ctaEyebrow: 'في مرحلة التخطيط',
    ctaTitle: 'وضوح مالي، خطوة بخطوة.',
    ctaText: 'نخطط لدفترك ليجعل تفاصيل المشروع أوضح ويساعدك على فهم ما يتبقى بعد التكاليف.',
    ctaButton: 'استكشف الفكرة',
    footer: 'دفترك — وضوح مالي لأصحاب المشاريع الصغيرة.',
    disclaimer: 'دفترك في مرحلة التخطيط. الميزات المذكورة تصف قدرات مخططًا لها وليست خدمة متاحة حاليًا.',
    made: 'من الكويت، لأصحاب المشاريع في الخليج',
  },
  en: {
    nav: ['The idea', 'How it works', 'Who it’s for', 'Questions'],
    eyebrow: 'A clearer book. A calmer mind.',
    titleStart: 'Your business is growing.',
    titleAccent: 'Know what stays.',
    intro: 'Daftarik is a simple financial companion for small businesses. It is being designed to help you understand what comes in, what goes out, and what is truly left — without accounting expertise.',
    primary: 'Explore the idea',
    secondary: 'How Daftarik works',
    note: 'Designed for small and home-based businesses across the Gulf',
    visualKicker: 'A little more clarity',
    visualTitle: 'Your business, in view',
    visualSub: 'The important details, together',
    income: 'Sales',
    costs: 'Expenses',
    result: 'What remains',
    preview: 'Illustrative preview',
    chartTitle: 'Business activity',
    chartSub: 'A simple view of what comes in and out',
    incomeLabel: 'In',
    costsLabel: 'Out',
    insight: 'A helpful reminder',
    insightText: 'Include packaging with each order to get closer to your actual profit.',
    section1Eyebrow: 'It is not you',
    section1Title: 'A busy sales day does not always mean clear profit.',
    section1Text: 'Orders and messages, scattered receipts, little costs you meant to remember. Somewhere in it all, the simple question — “What did I actually earn?” — gets harder than it should be.',
    pain1: 'Income and expenses live in different places',
    pain2: 'An order costs more than the product itself',
    pain3: 'Decisions rely on instinct, not the full picture',
    bridge: 'Daftarik starts here: a calmer way to put your business in order.',
    section2Eyebrow: 'Without the jargon',
    section2Title: 'From everyday details to a picture that makes sense.',
    section2Text: 'Daftarik is planned to bring the small details of your business into one organized place, then show them in clear language that helps you decide what comes next.',
    steps: [
      ['01', 'Note what happens', 'Add sales and expenses in a way that fits your day.'],
      ['02', 'Bring details together', 'Keep products, costs and orders easier to follow.'],
      ['03', 'Understand what remains', 'See a clearer summary to help you plan with confidence.'],
    ],
    section3Eyebrow: 'What Daftarik is being designed for',
    section3Title: 'Practical clarity, from the first order to month-end.',
    feature1Title: 'A truer view of profit', feature1Text: 'Understand what remains after costs, rather than looking at sales alone.',
    feature2Title: 'Sales and expense organization', feature2Text: 'One place for order details and everyday costs that can disappear in a chat.',
    feature3Title: 'Product tracking', feature3Text: 'A considered view of products and costs, so you know where to focus.',
    feature4Title: 'Readable summaries', feature4Text: 'A clear view of business activity to help you spot changes and plan ahead.',
    section4Eyebrow: 'Built around real days',
    section4Title: 'Every small business has its own rhythm. Daftarik can fit it.',
    section4Text: 'Whether you prepare orders at home or run a small shop, your financial picture should fit your day — not the other way around.',
    persona1: 'Home businesses', persona1b: 'Bakes, fragrance, handmade work',
    persona2: 'Small shops', persona2b: 'Independent products and direct orders',
    persona3: 'Instagram & WhatsApp sellers', persona3b: 'Orders and sales through messaging',
    quote: 'Understanding what remains after costs helps you value the time and effort you put in.',
    quoteBy: 'The idea behind Daftarik',
    section5Eyebrow: 'Designed for peace of mind',
    section5Title: 'A financial tool that speaks your language and respects your time.',
    trust1Title: 'Clear from the start', trust1Text: 'Plain language, without the weight of accounting jargon.',
    trust2Title: 'Made for small businesses', trust2Text: 'Designed around the reality of independent and home businesses in the Gulf.',
    trust3Title: 'One step at a time', trust3Text: 'Start with the picture you need today, and grow from there.',
    faqEyebrow: 'Common questions',
    faqTitle: 'Before you begin',
    faq: [
      ['Do I need accounting experience?', 'No. The idea is to make the financial details understandable to business owners themselves, in everyday language.'],
      ['Is Daftarik only for home businesses?', 'No. It is intended for home businesses, small shops and service providers who want to understand income and costs.'],
      ['Can I rely on it for tax filings or official obligations?', 'Daftarik is intended to organize and clarify your business picture. It is not a substitute for an accountant or official guidance.'],
      ['When can I use it?', 'Daftarik is currently in the planning stage. Launch details will be shared when available.'],
    ],
    ctaEyebrow: 'Currently in planning',
    ctaTitle: 'Financial clarity, one step at a time.',
    ctaText: 'Daftarik is being planned to make the details of your business clearer and help you understand what remains after costs.',
    ctaButton: 'Explore the idea',
    footer: 'Daftarik — financial clarity for small businesses.',
    disclaimer: 'Daftarik is in the planning stage. The capabilities described are planned, not currently available.',
    made: 'From Kuwait, for Gulf businesses',
  },
} as const;

function BrandMark({ lang }: { lang: Lang }) {
  return (
    <div className="flex items-center gap-2.5" aria-label={lang === "ar" ? "دفترك" : "Daftarik"}>
      <span className="relative grid size-9 place-items-center rounded-xl bg-[#101b30]">
        <span className="absolute inset-[5px] rounded-[8px] border border-[#d6b878]/70" />
        <span className="relative text-[19px] font-semibold leading-none text-[#d6b878]">د</span>
      </span>
      <span className="text-[20px] font-extrabold tracking-[-.045em] text-[#101b30]">{lang === "ar" ? "دفترك" : "Daftarik"}</span>
    </div>
  );
}

function PreviewCard({ t, lang }: { t: (typeof copy)['ar'] | (typeof copy)['en']; lang: Lang }) {
  return (
    <div className="relative mx-auto w-full max-w-[510px]">
      <div className="absolute -inset-6 rounded-[40px] bg-[#d6b878]/10 blur-2xl" />
      <div className="float soft-shadow relative overflow-hidden rounded-[25px] border border-white/70 bg-white/90 p-5 backdrop-blur-xl sm:p-7" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="mb-1 text-[11px] font-semibold tracking-wide text-[#16a085]">{t.visualKicker}</p>
            <h3 className="text-[20px] font-bold tracking-tight text-[#101b30]">{t.visualTitle}</h3>
            <p className="mt-1 text-xs text-[#7b8797]">{t.visualSub}</p>
          </div>
          <div className="grid size-10 place-items-center rounded-[14px] bg-[#f6f2e8] text-[#b0914d]"><Layers3 size={18} /></div>
        </div>
        <div className="my-5 grid grid-cols-3 gap-2.5">
          {[t.income, t.costs, t.result].map((label, i) => (
            <div key={label} className={`rounded-[14px] p-3 ${i === 2 ? 'bg-[#eaf6f3]' : 'bg-[#f5f7fa]'}`}>
              <span className="mb-3 block text-[10px] text-[#778396]">{label}</span>
              <span className={`block h-[7px] rounded-full ${i === 2 ? 'w-[58%] bg-[#16a085]' : 'w-[70%] bg-[#cbd3dc]'}`} />
              <span className={`mt-2 block h-[5px] rounded-full ${i === 2 ? 'w-[38%] bg-[#9dd8c9]' : 'w-[44%] bg-[#e0e5eb]'}`} />
            </div>
          ))}
        </div>
        <div className="rounded-[17px] border border-[#edf0f4] p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-[12px] font-bold text-[#26364d]">{t.chartTitle}</p><p className="mt-1 text-[10px] text-[#8a95a3]">{t.chartSub}</p></div>
            <span className="rounded-full bg-[#f6f2e8] px-2.5 py-1 text-[9px] font-semibold text-[#9b8045]">{t.preview}</span>
          </div>
          <div className="relative mt-4 h-[104px] overflow-hidden">
            <div className="absolute inset-x-0 top-4 border-t border-dashed border-[#e7ebef]" />
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-[#e7ebef]" />
            <div className="absolute inset-x-0 bottom-2 border-t border-dashed border-[#e7ebef]" />
            <svg viewBox="0 0 400 110" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              <path d="M0 82 C42 72 46 78 80 57 S132 67 164 47 S215 53 248 32 S300 51 334 24 S376 32 400 10" fill="none" stroke="#16a085" strokeWidth="3" strokeLinecap="round" />
              <path d="M0 94 C42 87 55 90 84 78 S133 88 164 68 S215 80 248 60 S300 72 334 57 S375 63 400 48" fill="none" stroke="#d6b878" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="5 5" />
            </svg>
          </div>
          <div className="flex gap-4 text-[10px] text-[#778396]">
            <span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-[#16a085]" />{t.incomeLabel}</span>
            <span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-[#d6b878]" />{t.costsLabel}</span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-[14px] bg-[#f8f6f0] p-3.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#eee5d0] text-[#9a7d42]"><Sparkles size={14} /></span>
          <div><p className="text-[10px] font-bold text-[#344258]">{t.insight}</p><p className="mt-0.5 text-[10px] leading-relaxed text-[#778396]">{t.insightText}</p></div>
        </div>
      </div>
      <div className="absolute -bottom-5 -start-5 hidden items-center gap-2 rounded-xl border border-[#e9edf0] bg-white px-4 py-3 text-[11px] font-semibold text-[#455369] shadow-lg sm:flex">
        <span className="grid size-6 place-items-center rounded-full bg-[#eaf6f3] text-[#16a085]"><Check size={13} /></span>
        {lang === 'ar' ? 'تفاصيلك، بصورة أهدأ' : 'Your details, made clearer'}
      </div>
    </div>
  );
}

function App() {
  const [lang, setLang] = useState<Lang>('ar');
  const [menuOpen, setMenuOpen] = useState(false);
  const t = copy[lang];
  const rtl = lang === 'ar';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.body.classList.toggle('arabic', rtl);
  }, [lang, rtl]);

  const sectionIds = ['idea', 'how', 'audience', 'questions'];
  const Arrow = rtl ? ArrowLeft : ArrowRight;

  return (
    <main className="page-grain min-h-[100dvh] overflow-hidden" dir={rtl ? 'rtl' : 'ltr'}>
      <header className="sticky top-0 z-30 border-b border-[#e8ebef]/80 bg-[#f5f7fa]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1220px] items-center justify-between px-5 sm:px-8">
          <a href="#top" aria-label={lang === "ar" ? "الصفحة الرئيسية لدفترك" : "Daftarik home"} data-testid="link-home" className="outline-ring rounded-xl"><BrandMark lang={lang} /></a>
          <nav className="hidden items-center gap-8 lg:flex" aria-label={rtl ? 'التنقل الرئيسي' : 'Main navigation'}>
            {t.nav.map((item, i) => <a key={item} href={`#${sectionIds[i]}`} className="nav-link text-[12px] font-semibold text-[#59677c]" data-testid={`link-nav-${i}`}>{item}</a>)}
          </nav>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setLang(rtl ? 'en' : 'ar')} className="outline-ring rounded-lg px-2.5 py-2 text-[11px] font-bold text-[#59677c] transition hover:bg-white" aria-label={rtl ? 'Switch to English' : 'التبديل إلى العربية'} data-testid="button-language">
              {rtl ? 'EN' : 'عربي'}
            </button>
            <Link href="/auth" className="hidden rounded-full bg-[#101b30] px-5 py-2.5 text-[11px] font-bold text-white transition hover:bg-[#1b2c49] sm:inline-flex" data-testid="link-header-auth">{rtl ? 'دخول' : 'Sign in'}</Link>
            <button type="button" aria-label={menuOpen ? (rtl ? 'إغلاق القائمة' : 'Close menu') : (rtl ? 'فتح القائمة' : 'Open menu')} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} className="outline-ring grid size-10 place-items-center rounded-xl border border-[#e2e7ed] text-[#101b30] lg:hidden" data-testid="button-menu">{menuOpen ? <X size={18} /> : <Menu size={18} />}</button>
          </div>
        </div>
        {menuOpen && <nav className="grid gap-1 border-t border-[#e8ebef] bg-[#f5f7fa] px-5 py-3 lg:hidden">{t.nav.map((item, i) => <a key={item} href={`#${sectionIds[i]}`} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold text-[#59677c] hover:bg-white" data-testid={`link-mobile-nav-${i}`}>{item}</a>)}<Link href="/auth" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold text-[#16a085]" data-testid="link-mobile-auth">{rtl ? 'تسجيل الدخول أو إنشاء حساب' : 'Sign in or create an account'}</Link></nav>}
      </header>

      <section id="top" className="relative mx-auto grid max-w-[1220px] items-center gap-14 px-5 pb-24 pt-16 sm:px-8 sm:pt-20 lg:min-h-[650px] lg:grid-cols-[1fr_1fr] lg:gap-16 lg:pb-28">
        <div className={`reveal relative z-10 ${rtl ? 'lg:pl-4' : 'lg:pr-4'}`}>
          <div className="mb-6 flex items-center gap-3">
            <span className="h-px w-9 bg-[#d6b878]" />
            <span className="text-[11px] font-bold tracking-[.1em] text-[#927a46]">{t.eyebrow}</span>
          </div>
          <h1 className="max-w-[620px] text-[clamp(2.7rem,6.5vw,5.4rem)] font-extrabold leading-[1.13] tracking-[-.065em] text-[#101b30]">
            {t.titleStart}<br /><span className="relative inline-block text-[#16a085]">{t.titleAccent}<span className="absolute -bottom-1 inset-x-0 h-[7px] rounded-full bg-[#d6b878]/35" /></span>
          </h1>
          <p className="mt-7 max-w-[500px] text-[15px] leading-[1.95] text-[#59677c] sm:text-[16px]">{t.intro}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#idea" className="outline-ring inline-flex items-center gap-3 rounded-full bg-[#101b30] px-6 py-3.5 text-[12px] font-bold text-white shadow-lg shadow-[#101b30]/10 transition hover:-translate-y-0.5 hover:bg-[#1b2c49]" data-testid="link-hero-primary">{t.primary}<Arrow size={15} /></a>
            <a href="#how" className="outline-ring inline-flex items-center gap-2 rounded-full border border-[#d9dfe6] bg-white/65 px-5 py-3.5 text-[12px] font-bold text-[#344258] transition hover:border-[#d6b878]" data-testid="link-hero-secondary">{rtl ? <ArrowUpLeft size={15} /> : <ArrowDownLeft size={15} />}{t.secondary}</a>
          </div>
          <div className="mt-8 flex items-center gap-2 text-[10px] font-medium text-[#7b8797]"><ShieldCheck size={14} className="text-[#16a085]" />{t.note}</div>
        </div>
        <div className="reveal reveal-delay-1 relative py-2"><PreviewCard t={t} lang={lang} /></div>
        <a href="#idea" className="absolute bottom-7 start-8 hidden items-center gap-2 text-[10px] font-semibold tracking-wide text-[#8792a0] lg:flex" data-testid="link-scroll"><span className="grid size-7 place-items-center rounded-full border border-[#dce2e7]"><ChevronDown size={13} /></span>{rtl ? 'تابع القراءة' : 'Keep reading'}</a>
      </section>

      <section id="idea" className="scroll-mt-20 border-y border-[#e8ebef] bg-white/60">
        <div className="mx-auto grid max-w-[1120px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[.95fr_1.05fr] lg:items-center lg:py-28">
          <div>
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[.2em] text-[#a1864b]">{t.section1Eyebrow}</p>
            <h2 className="max-w-[510px] text-[clamp(2rem,4.2vw,3.25rem)] font-extrabold leading-[1.22] tracking-[-.055em] text-[#101b30]">{t.section1Title}</h2>
            <p className="mt-5 max-w-[520px] text-[14px] leading-[1.9] text-[#687589]">{t.section1Text}</p>
          </div>
          <div className="relative rounded-[24px] bg-[#101b30] p-7 text-white sm:p-9">
            <div className="absolute end-8 top-8 h-20 w-20 rounded-full border border-[#d6b878]/20" />
            <span className="mb-7 grid size-11 place-items-center rounded-[15px] bg-[#d6b878]/15 text-[#d6b878]"><CircleHelp size={20} /></span>
            <div className="space-y-5">
              {[t.pain1, t.pain2, t.pain3].map((text, i) => <div key={text} className="flex items-start gap-3 border-b border-white/10 pb-4 last:border-0 last:pb-0"><span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full border border-[#d6b878]/50 text-[9px] text-[#d6b878]">{i + 1}</span><p className="text-[13px] leading-relaxed text-[#e0e5ec]">{text}</p></div>)}
            </div>
          </div>
          <div className="lg:col-span-2"><div className="gold-rule h-px w-full" /><p className="mt-6 text-center text-[13px] font-semibold text-[#59677c]">{t.bridge}</p></div>
        </div>
      </section>

      <section id="how" className="scroll-mt-20 mx-auto max-w-[1120px] px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-[640px] text-center">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[.2em] text-[#a1864b]">{t.section2Eyebrow}</p>
          <h2 className="text-[clamp(2rem,4.2vw,3.25rem)] font-extrabold leading-[1.2] tracking-[-.055em] text-[#101b30]">{t.section2Title}</h2>
          <p className="mx-auto mt-5 max-w-[590px] text-[14px] leading-[1.9] text-[#687589]">{t.section2Text}</p>
        </div>
        <div className="relative mt-14 grid gap-4 md:grid-cols-3">
          <div className="absolute top-8 hidden h-px bg-[#dce3e8] md:block" style={{ insetInline: '16%' }} />
          {t.steps.map((step, i) => <article key={step[0]} className="relative rounded-[20px] border border-[#e5e9ed] bg-white/70 p-6 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#101b30]/5 sm:p-7" data-testid={`card-step-${i}`}>
            <div className="mb-7 flex items-center justify-between"><span className="grid size-11 place-items-center rounded-full border border-[#d6b878] bg-[#f5f2e9] text-[12px] font-bold text-[#907741]">{step[0]}</span><span className="text-[10px] font-semibold text-[#b2bac4]">{rtl ? 'خطوة' : 'STEP'} 0{i + 1}</span></div>
            <h3 className="text-[17px] font-bold text-[#101b30]">{step[1]}</h3><p className="mt-3 text-[12px] leading-[1.8] text-[#758194]">{step[2]}</p>
          </article>)}
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#101b30] text-white">
        <div className="absolute -end-36 -top-48 size-[430px] rounded-full border border-white/[.06]" /><div className="absolute -end-20 -top-32 size-[300px] rounded-full border border-[#d6b878]/[.12]" />
        <div className="relative mx-auto max-w-[1120px] px-5 py-20 sm:px-8 lg:py-28">
          <div className="max-w-[660px]">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[.2em] text-[#d6b878]">{t.section3Eyebrow}</p>
            <h2 className="text-[clamp(2rem,4.2vw,3.25rem)] font-extrabold leading-[1.2] tracking-[-.055em]">{t.section3Title}</h2>
          </div>
          <div className="mt-12 grid gap-x-10 gap-y-0 md:grid-cols-2">
            {[
              [Wallet, t.feature1Title, t.feature1Text],
              [FileText, t.feature2Title, t.feature2Text],
              [Package, t.feature3Title, t.feature3Text],
              [Compass, t.feature4Title, t.feature4Text],
            ].map(([Icon, title, text], i) => {
              const FeatureIcon = Icon as typeof Wallet;
              return <article key={String(title)} className={`flex gap-5 border-t border-white/15 py-7 ${i % 2 === 0 ? (rtl ? 'md:pl-8' : 'md:pr-8') : (rtl ? 'md:pr-8' : 'md:pl-8')}`} data-testid={`card-feature-${i}`}>
                <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-white/[.07] text-[#d6b878]"><FeatureIcon size={18} /></span>
                <div><h3 className="text-[15px] font-bold">{title as string}</h3><p className="mt-2 max-w-[420px] text-[12px] leading-[1.85] text-[#adb7c5]">{text as string}</p></div>
              </article>;
            })}
          </div>
          <p className="mt-4 text-[10px] text-[#8f9aaa]">{t.disclaimer}</p>
        </div>
      </section>

      <section id="audience" className="scroll-mt-20 bg-[#eeece5]">
        <div className="mx-auto grid max-w-[1120px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:py-28">
          <div>
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[.2em] text-[#a1864b]">{t.section4Eyebrow}</p>
            <h2 className="max-w-[520px] text-[clamp(2rem,4.2vw,3.2rem)] font-extrabold leading-[1.2] tracking-[-.055em] text-[#101b30]">{t.section4Title}</h2>
            <p className="mt-5 max-w-[480px] text-[14px] leading-[1.9] text-[#687589]">{t.section4Text}</p>
            <div className="mt-9 border-s-2 border-[#d6b878] ps-5"><p className="max-w-[480px] text-[17px] font-semibold leading-[1.7] text-[#344258]">{t.quote}</p><p className="mt-3 text-[10px] font-bold text-[#927a46]">{t.quoteBy}</p></div>
          </div>
          <div className="grid gap-3">
            {[[Heart, t.persona1, t.persona1b], [Layers3, t.persona2, t.persona2b], [Sparkles, t.persona3, t.persona3b]].map(([Icon, title, sub], i) => {
              const PersonaIcon = Icon as typeof Heart;
              return <article key={String(title)} className="group flex items-center gap-4 rounded-[17px] border border-[#e0dfd8] bg-[#f7f6f1] p-5 transition hover:border-[#d6b878] sm:p-6" data-testid={`card-audience-${i}`}>
                <span className="grid size-12 shrink-0 place-items-center rounded-[15px] bg-white text-[#16a085] shadow-sm transition group-hover:bg-[#101b30] group-hover:text-[#d6b878]"><PersonaIcon size={19} /></span>
                <div className="flex-1"><h3 className="text-[14px] font-bold text-[#101b30]">{title as string}</h3><p className="mt-1 text-[11px] text-[#7b8797]">{sub as string}</p></div>
                <Arrow size={16} className="text-[#b1b8c1]" />
              </article>;
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1120px] px-5 py-20 sm:px-8 lg:py-28">
        <div className="grid gap-14 lg:grid-cols-[.75fr_1.25fr] lg:items-center">
          <div><p className="mb-4 text-[10px] font-bold uppercase tracking-[.2em] text-[#a1864b]">{t.section5Eyebrow}</p><h2 className="text-[clamp(2rem,4vw,3.1rem)] font-extrabold leading-[1.2] tracking-[-.055em] text-[#101b30]">{t.section5Title}</h2></div>
          <div className="space-y-7">
            {[[ShieldCheck,t.trust1Title,t.trust1Text],[Heart,t.trust2Title,t.trust2Text],[Sparkles,t.trust3Title,t.trust3Text]].map(([Icon,title,text],i)=>{
              const TrustIcon = Icon as typeof ShieldCheck;
              return <div key={String(title)} className="flex gap-4" data-testid={`item-trust-${i}`}><span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e7f3ef] text-[#16a085]"><TrustIcon size={18}/></span><div><h3 className="text-[14px] font-bold text-[#101b30]">{title as string}</h3><p className="mt-1.5 text-[12px] leading-relaxed text-[#758194]">{text as string}</p></div></div>;
            })}
          </div>
        </div>
      </section>

      <section id="questions" className="scroll-mt-20 border-y border-[#e8ebef] bg-white/65">
        <div className="mx-auto grid max-w-[1120px] gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[.7fr_1.3fr] lg:py-24">
          <div><p className="mb-4 text-[10px] font-bold uppercase tracking-[.2em] text-[#a1864b]">{t.faqEyebrow}</p><h2 className="text-[clamp(2rem,4vw,3rem)] font-extrabold leading-[1.2] tracking-[-.055em] text-[#101b30]">{t.faqTitle}</h2></div>
          <div className="divide-y divide-[#e4e8ec]">
            {t.faq.map(([question, answer],i)=><details key={question} className="group py-5" data-testid={`faq-${i}`}><summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-[13px] font-bold text-[#26364d] outline-none"><span>{question}</span><span className="grid size-7 shrink-0 place-items-center rounded-full border border-[#dce2e7] text-[#16a085] transition group-open:rotate-180"><ChevronDown size={14}/></span></summary><p className="max-w-[640px] pt-4 text-[12px] leading-[1.9] text-[#758194]">{answer}</p></details>)}
          </div>
        </div>
      </section>

      <section id="contact" className="scroll-mt-20 relative mx-auto max-w-[1220px] px-5 py-16 sm:px-8 lg:py-24">
        <div className="relative overflow-hidden rounded-[27px] bg-[#101b30] px-6 py-12 text-center text-white sm:px-12 sm:py-16">
          <div className="absolute -start-16 -top-36 size-[300px] rounded-full border border-[#d6b878]/20" /><div className="absolute -start-4 -top-24 size-[180px] rounded-full border border-white/10" />
          <div className="relative mx-auto max-w-[680px]">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[.2em] text-[#d6b878]">{t.ctaEyebrow}</p>
            <h2 className="text-[clamp(2rem,4.5vw,3.4rem)] font-extrabold leading-[1.2] tracking-[-.055em]">{t.ctaTitle}</h2>
            <p className="mx-auto mt-5 max-w-[570px] text-[13px] leading-[1.9] text-[#b8c1ce]">{t.ctaText}</p>
            <a href="#idea" className="outline-ring mt-8 inline-flex items-center gap-3 rounded-full bg-[#d6b878] px-7 py-3.5 text-[12px] font-extrabold text-[#101b30] transition hover:-translate-y-0.5 hover:bg-[#e4cc91]" data-testid="link-contact">{t.ctaButton}<Arrow size={15}/></a>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#e2e7ed] bg-[#f0f3f6]">
        <div className="mx-auto flex max-w-[1220px] flex-col gap-5 px-5 py-7 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div><BrandMark lang={lang}/><p className="mt-3 text-[10px] text-[#758194]">{t.footer}</p></div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] font-semibold text-[#758194]">
            <a href="#idea" className="hover:text-[#16a085]" data-testid="link-footer-idea">{t.nav[0]}</a>
            <a href="#how" className="hover:text-[#16a085]" data-testid="link-footer-how">{t.nav[1]}</a>
            <a href="#questions" className="hover:text-[#16a085]" data-testid="link-footer-faq">{t.nav[3]}</a>
            <span className="text-[#a1aab5]">{t.made}</span>
          </div>
          <p className="text-[9px] leading-relaxed text-[#909ba9]">{t.disclaimer}</p>
        </div>
      </footer>
    </main>
  );
}

export default App;
