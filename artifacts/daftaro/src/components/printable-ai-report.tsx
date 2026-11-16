import type { AiLanguage, AiPeriod } from "../lib/ai-api";
import type { PrintableAiReportData } from "../lib/printable-ai-report";

const COPY = {
  ar: {
    title: "تقرير رؤى دفترُك",
    period: "الفترة المشمولة",
    currency: "العملة",
    financial: "الملخص المالي",
    income: "الدخل المسجل",
    expenses: "المصروفات المسجلة",
    netProfit: "صافي السجل",
    margin: "هامش السجل",
    orders: "إجمالي الطلبات حسب حالة الدفع",
    paid: "مدفوعة",
    unpaid: "غير مدفوعة أو معلقة",
    failed: "فشلت أو استُردت",
    categories: "أعلى فئات المصروفات",
    products: "أداء المنتجات",
    bestSellers: "الأكثر مبيعًا في الفترة المختارة",
    mostProfitable: "أعلى ربح تقديري خلال ٩٠ يومًا",
    slowMoving: "تباطؤ المبيعات خلال آخر ٣٠ يومًا",
    noSales: "لا توجد مبيعات مدفوعة خلال آخر ٣٠ يومًا",
    restocking: "تنبيهات إعادة التخزين",
    profitReview: "مراجعة الربحية",
    discounts: "خصومات الطلبات المدفوعة خلال ٩٠ يومًا",
    shippingExpenses: "مصروفات الشحن المسجلة في الفترة",
    evidence: "الأرقام والأدلة المحسوبة",
    calculations: "ملاحظات الحساب",
    aiExplanation: "تفسير دفترُك",
    recommendations: "التوصيات",
    paidUnits: "وحدات مدفوعة",
    revenue: "الإيراد المدفوع",
    suggested: "كمية مقترحة",
    available: "المتاح",
    threshold: "حد التنبيه",
    daysStock: "أيام مخزون تقريبية",
    previous: "السابق",
    current: "الحالي",
    change: "مقارنة بالفترة السابقة",
    unavailable: "غير متاح",
    noData: "لا توجد بيانات في هذه الفترة.",
    noExplanation: "لم يتوفر تفسير من الذكاء الاصطناعي؛ الأرقام أعلاه محسوبة من بيانات النشاط.",
    separate: "السجل المالي والطلبات مصدران منفصلان ولا يتم جمعهما.",
    cancelled: "الطلبات الملغاة مستبعدة من إجماليات الطلبات والمبيعات.",
    productCost: "تقديرات ربح المنتج تستخدم تكلفته الحالية المحفوظة، وليست لقطة تاريخية.",
    shippingNote: "مصروفات الشحن من السجل ولا تُوزّع على تكلفة المنتجات.",
    restockNote: "تقديرات إعادة التخزين تعتمد على الطلبات المدفوعة؛ ولا تظهر كمية محددة عند عدم كفاية البيانات.",
  },
  en: {
    title: "Daftaro business insights report",
    period: "Reporting period",
    currency: "Currency",
    financial: "Financial summary",
    income: "Ledger income",
    expenses: "Ledger expenses",
    netProfit: "Ledger net",
    margin: "Ledger margin",
    orders: "Order totals by payment status",
    paid: "Paid",
    unpaid: "Unpaid or pending",
    failed: "Failed or refunded",
    categories: "Largest expense categories",
    products: "Product performance",
    bestSellers: "Best sellers in the selected period",
    mostProfitable: "Highest estimated product profit in 90 days",
    slowMoving: "Sales slowing over the last 30 days",
    noSales: "No paid sales in the last 30 days",
    restocking: "Restocking signals",
    profitReview: "Profit review",
    discounts: "Paid-order discounts in the last 90 days",
    shippingExpenses: "Shipping expenses recorded in the selected period",
    evidence: "Calculated figures and evidence",
    calculations: "Calculation notes",
    aiExplanation: "Daftaro's explanation",
    recommendations: "Recommendations",
    paidUnits: "paid units",
    revenue: "Paid revenue",
    suggested: "Suggested quantity",
    available: "Available",
    threshold: "Alert threshold",
    daysStock: "Estimated stock days",
    previous: "Previous",
    current: "Current",
    change: "vs previous period",
    unavailable: "Not available",
    noData: "No data for this period.",
    noExplanation: "No AI explanation was returned; the figures above are calculated from business data.",
    separate: "Ledger entries and orders are separate sources and are not combined.",
    cancelled: "Cancelled orders are excluded from order and sales totals.",
    productCost: "Product-profit estimates use current saved costs, not historical cost snapshots.",
    shippingNote: "Shipping expenses come from the ledger and are not allocated to product costs.",
    restockNote: "Restocking estimates use paid orders; no quantity is suggested when history is insufficient.",
  },
} as const;

const FIELD_LABELS = {
  ar: {
    current: "الحالي", previous: "السابق", changePercent: "التغير المئوي",
    largestCategory: "أكبر فئة", product: "المنتج", unitProfit: "ربح الوحدة",
    marginPercent: "الهامش", amount: "المبلغ", availableQuantity: "المتاح",
    threshold: "حد التنبيه", daysOfStock: "أيام المخزون", suggestedQuantity: "الكمية المقترحة",
  },
  en: {
    current: "Current", previous: "Previous", changePercent: "Change",
    largestCategory: "Largest category", product: "Product", unitProfit: "Unit profit",
    marginPercent: "Margin", amount: "Amount", availableQuantity: "Available",
    threshold: "Alert threshold", daysOfStock: "Stock days", suggestedQuantity: "Suggested quantity",
  },
} as const;

function formatAmount(value: string | number, currency: string, language: AiLanguage) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return `${new Intl.NumberFormat(language === "ar" ? "ar-KW" : "en-KW", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(number)} ${currency}`;
}

function formatPercent(value: string | null, language: AiLanguage) {
  if (value === null) return "—";
  return `${new Intl.NumberFormat(language === "ar" ? "ar-KW" : "en-KW", { maximumFractionDigits: 2 }).format(Number(value))}%`;
}

function formatPercentagePoints(value: string | null, language: AiLanguage) {
  if (value === null) return "—";
  const label = language === "ar" ? "نقطة مئوية" : "percentage points";
  return `${formatPercent(value, language)} ${label}`;
}

function evidenceLabel(kind: string, label: string, language: AiLanguage) {
  const copy = COPY[language];
  if (kind === "income") return copy.income;
  if (kind === "expenses") return copy.expenses;
  if (kind === "profit") return copy.netProfit;
  if (kind === "negativeMargin") return language === "ar" ? "هامش وحدة سالب" : "Negative unit margin";
  if (kind === "restock") return language === "ar" ? "إشارة إعادة تخزين" : "Restocking signal";
  if (kind === "shipping") return copy.shippingExpenses;
  return label;
}

function formatEvidenceValue(key: string, value: string | number | null, currency: string, language: AiLanguage) {
  if (value === null) return "—";
  if (["current", "previous", "unitProfit", "amount"].includes(key)) return formatAmount(value, currency, language);
  if (["changePercent", "marginPercent"].includes(key)) return formatPercent(String(value), language);
  return String(value);
}

export function PrintableAiReport({
  report,
  language,
}: {
  report: PrintableAiReportData;
  language: AiLanguage;
}) {
  const copy = COPY[language];
  const labels = FIELD_LABELS[language] as Record<string, string>;
  const periodLabel = language === "ar"
    ? ({ "7d": "آخر ٧ أيام", "30d": "آخر ٣٠ يومًا", "90d": "آخر ٩٠ يومًا" } satisfies Record<AiPeriod, string>)[report.period]
    : ({ "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days" } satisfies Record<AiPeriod, string>)[report.period];

  return (
    <article className="print-only mx-auto max-w-[900px] px-2 py-5 text-[#172639]" dir={language === "ar" ? "rtl" : "ltr"} data-print-report data-testid="ai-print-report">
      <header className="border-b-2 border-[#167b70] pb-5">
        <p className="text-xs font-bold tracking-wide text-[#167b70]">DAFTARO</p>
        <h1 className="mt-2 text-3xl font-extrabold">{copy.title}</h1>
        <div className="mt-4 flex flex-wrap gap-x-7 gap-y-2 text-sm">
          <p><b>{copy.period}:</b> {periodLabel} · <span dir="ltr">{report.from} — {report.to}</span></p>
          <p><b>{copy.currency}:</b> <span dir="ltr">{report.currencyCode}</span></p>
        </div>
      </header>

      <section className="report-section mt-6">
        <h2>{copy.financial}</h2>
        <div className="report-grid">
          <p><span>{copy.income}</span><b dir="ltr">{formatAmount(report.financial.current.income, report.currencyCode, language)}</b></p>
          <p><span>{copy.expenses}</span><b dir="ltr">{formatAmount(report.financial.current.expenses, report.currencyCode, language)}</b></p>
          <p><span>{copy.netProfit}</span><b dir="ltr">{formatAmount(report.financial.current.netProfit, report.currencyCode, language)}</b></p>
          <p><span>{copy.margin}</span><b dir="ltr">{formatPercent(report.financial.current.marginPercent, language)}</b></p>
        </div>
        <div className="mt-3 text-xs leading-6">
          <p>{copy.previous} · {copy.income}: {formatAmount(report.financial.previous.income, report.currencyCode, language)} · {formatPercent(report.financial.changes.incomePercent, language)} {copy.change}</p>
          <p>{copy.previous} · {copy.expenses}: {formatAmount(report.financial.previous.expenses, report.currencyCode, language)} · {formatPercent(report.financial.changes.expensesPercent, language)} {copy.change}</p>
          <p>{copy.previous} · {copy.netProfit}: {formatAmount(report.financial.previous.netProfit, report.currencyCode, language)} · {formatPercent(report.financial.changes.netProfitPercent, language)} {copy.change}</p>
          <p>{copy.previous} · {copy.margin}: {formatPercent(report.financial.previous.marginPercent, language)} · {formatPercentagePoints(report.financial.changes.marginPoints, language)}</p>
        </div>
      </section>

      <section className="report-section mt-6">
        <h2>{copy.orders}</h2>
        <div className="report-grid">
          <p><span>{copy.paid}</span><b dir="ltr">{formatAmount(report.financial.orders.paid, report.currencyCode, language)}</b></p>
          <p><span>{copy.unpaid}</span><b dir="ltr">{formatAmount(report.financial.orders.unpaidOrPending, report.currencyCode, language)}</b></p>
          <p><span>{copy.failed}</span><b dir="ltr">{formatAmount(report.financial.orders.failedOrRefunded, report.currencyCode, language)}</b></p>
        </div>
        {report.financial.expenseCategories.length > 0 && <div className="mt-4">
          <h3>{copy.categories}</h3>
          <ul className="report-list">{report.financial.expenseCategories.map((item) => <li key={item.category}><span>{item.category}</span><b dir="ltr">{formatAmount(item.amount, report.currencyCode, language)}</b></li>)}</ul>
        </div>}
      </section>

      <section className="report-section mt-6">
        <h2>{copy.products}</h2>
        <div className="report-columns">
          <div>
            <h3>{copy.bestSellers}</h3>
            {report.bestSellers.length ? <ul className="report-list">{report.bestSellers.map((item) => <li key={item.name}><span>{item.name} · {item.paidUnits} {copy.paidUnits}</span><b dir="ltr">{formatAmount(item.paidRevenue, report.currencyCode, language)}</b></li>)}</ul> : <p>{copy.noData}</p>}
            <h3 className="mt-4">{copy.mostProfitable}</h3>
            {report.mostProfitable.length ? <ul className="report-list">{report.mostProfitable.map((item) => <li key={item.name}><span>{item.name} · {item.paidUnits} {copy.paidUnits}</span><b dir="ltr">{formatAmount(item.estimatedProfit, report.currencyCode, language)} · {formatPercent(item.marginPercent, language)}</b></li>)}</ul> : <p>{copy.noData}</p>}
          </div>
          <div>
            <h3>{copy.slowMoving}</h3>
            {report.slowMoving.length ? <ul className="report-list">{report.slowMoving.map((item) => <li key={item.name}><span>{item.name}</span><b dir="ltr">{item.previousPaidUnits} → {item.currentPaidUnits}</b></li>)}</ul> : <p>{copy.noData}</p>}
            <h3 className="mt-4">{copy.noSales}</h3>
            {report.noSales.length ? <ul className="report-list">{report.noSales.map((item) => <li key={item.name}><span>{item.name}</span><b>{item.daysSinceAdded} {language === "ar" ? "يومًا" : "days"}</b></li>)}</ul> : <p>{copy.noData}</p>}
          </div>
        </div>
      </section>

      <section className="report-section mt-6">
        <h2>{copy.profitReview}</h2>
        <div className="report-grid">
          <p><span>{copy.discounts}</span><b dir="ltr">{formatAmount(report.profitReview.paidOrderDiscountsLast90Days, report.currencyCode, language)}</b></p>
          <p><span>{copy.shippingExpenses}</span><b dir="ltr">{formatAmount(report.profitReview.shippingExpensesFromLedger, report.currencyCode, language)}</b></p>
        </div>
        {report.profitReview.negativeMarginProducts.length > 0 && <ul className="report-list mt-3">{report.profitReview.negativeMarginProducts.map((item) => <li key={item.name}><span>{item.name} · {formatPercent(item.marginPercent, language)}</span><b dir="ltr">{formatAmount(item.unitProfit, report.currencyCode, language)}</b></li>)}</ul>}
        {report.restocking.length > 0 && <div className="mt-4">
          <h3>{copy.restocking}</h3>
          <ul className="report-list">{report.restocking.map((item) => <li key={item.name}><span>{item.name} · {copy.available}: {item.availableQuantity} · {copy.threshold}: {item.lowStockThreshold} · {copy.paidUnits}: {item.paidUnitsLast30Days}</span><b>{item.suggestedQuantity === null ? copy.unavailable : `${copy.suggested}: ${item.suggestedQuantity}`} · {copy.daysStock}: {item.daysOfStock ?? "—"}</b></li>)}</ul>
        </div>}
      </section>

      <section className="report-section mt-6">
        <h2>{copy.aiExplanation}</h2>
        <p className="mt-2 whitespace-pre-wrap leading-7">{report.ai.summary || copy.noExplanation}</p>
        {report.ai.recommendations.length > 0 && <div className="mt-4">
          <h3>{copy.recommendations}</h3>
          <ul className="report-list report-recommendation-list">
            {report.ai.recommendations.map((item, index) => (
              <li key={`${index}-${item.advice}`}>
                <span>{item.advice}</span>
                {item.evidenceLabel && (
                  <small className="mt-1 block">{copy.evidence}: {evidenceLabel(item.evidenceKind ?? "other", item.evidenceLabel, language)}</small>
                )}
              </li>
            ))}
          </ul>
        </div>}
      </section>

      {report.evidence.length > 0 && <section className="report-section mt-6">
        <h2>{copy.evidence}</h2>
        <ul className="report-evidence">{report.evidence.map((item, index) => <li key={`${index}-${item.label}`}><b>{evidenceLabel(item.kind, item.label, language)}</b><span>{Object.entries(item.details).map(([key, value]) => <span key={key}><strong>{labels[key] ?? key}:</strong> {formatEvidenceValue(key, value, report.currencyCode, language)}</span>)}</span></li>)}</ul>
      </section>}

      <section className="report-section mt-6">
        <h2>{copy.calculations}</h2>
        <ul className="report-notes">
          <li>{copy.separate}</li>
          <li>{copy.cancelled}</li>
          <li>{copy.productCost}</li>
          <li>{copy.shippingNote}</li>
          <li>{copy.restockNote}</li>
        </ul>
      </section>
      <footer className="mt-8 border-t border-slate-300 pt-3 text-[10px] text-slate-500">DAFTARO · {report.currencyCode} · <span dir="ltr">{report.from} — {report.to}</span></footer>
    </article>
  );
}
