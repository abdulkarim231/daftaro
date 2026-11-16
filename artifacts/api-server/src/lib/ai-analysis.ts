export type AiPeriod = "7d" | "30d" | "90d";
export type AiLanguage = "ar" | "en";

export type AiTransactionRow = {
  transaction_type: "income" | "expense";
  amount: string | number;
  currency_code: string;
  transaction_date: string;
  category: string | null;
};

export type AiOrderRow = {
  id: string;
  order_date: string;
  order_status: string;
  payment_status: string;
  currency_code: string;
  subtotal: string | number;
  discount: string | number;
  shipping_fee: string | number;
  total: string | number;
};

export type AiOrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  position: number;
  line_total: string | number;
};

export type AiProductRow = {
  id: string;
  name: string;
  selling_price: string | number;
  materials_cost: string | number;
  packaging_cost: string | number;
  other_cost: string | number;
  available_quantity: number;
  low_stock_threshold: number;
  currency_code: string;
  created_at: string;
};

export type AiAnalysisInput = {
  transactions: AiTransactionRow[];
  orders: AiOrderRow[];
  items: AiOrderItemRow[];
  products: AiProductRow[];
  currencyCode: string;
  period: AiPeriod;
  today: string;
};

export type AiEvidence = {
  id: string;
  label: string;
  details: Record<string, string | number | null>;
};

export type AiAnalysis = {
  period: AiPeriod;
  currencyCode: string;
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  monthToDate: { from: string; to: string; income: string; expenses: string; netProfit: string; marginPercent: string | null };
  previousMonth: { from: string; to: string; income: string; expenses: string; netProfit: string; marginPercent: string | null };
  financial: {
    current: { income: string; expenses: string; netProfit: string; marginPercent: string | null };
    previous: { income: string; expenses: string; netProfit: string; marginPercent: string | null };
    changes: {
      incomePercent: string | null;
      expensesPercent: string | null;
      netProfitPercent: string | null;
      marginPoints: string | null;
    };
    expenseCategories: Array<{ category: string; amount: string }>;
    paidOrderTotal: string;
    unpaidOrPendingOrderTotal: string;
    cancelledOrdersExcluded: true;
    ledgerAndOrdersKeptSeparate: true;
  };
  productPerformance: {
    bestSellers: Record<AiPeriod, Array<{ productId: string; name: string; paidUnits: number; paidRevenue: string }>>;
    mostProfitable: Array<{ productId: string; name: string; estimatedProfit: string; marginPercent: string | null; paidUnits: number }>;
    slowMoving: Array<{ productId: string; name: string; previousPaidUnits: number; currentPaidUnits: number }>;
    noSales: Array<{ productId: string; name: string; daysSinceAdded: number }>;
    costBasisNote: string;
  };
  profitLeaks: {
    paidOrderDiscounts: string;
    shippingExpensesFromLedger: string;
    negativeMarginProducts: Array<{ productId: string; name: string; unitProfit: string; marginPercent: string }>;
    note: string;
  };
  restocking: Array<{
    productId: string;
    name: string;
    availableQuantity: number;
    lowStockThreshold: number;
    paidUnitsLast30Days: number;
    daysOfStock: number | null;
    suggestedQuantity: number | null;
    reason: string;
  }>;
  evidence: AiEvidence[];
};

function parseMilli(value: string | number): bigint {
  const text = String(value).trim();
  if (!/^\d{1,11}(?:\.\d{1,3})?$/.test(text)) {
    throw new Error("Financial data contains an invalid amount.");
  }
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, "0"));
}

function amount(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 1000n}.${String(absolute % 1000n).padStart(3, "0")}`;
}

function percent(value: bigint | null): string | null {
  if (value === null) return null;
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

function margin(profit: bigint, revenue: bigint): bigint | null {
  if (revenue <= 0n) return null;
  const absolute = profit < 0n ? -profit : profit;
  const rounded = (absolute * 10_000n + revenue / 2n) / revenue;
  return profit < 0n ? -rounded : rounded;
}

function addDays(key: string, days: number): string {
  const date = new Date(`${key}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dateKeyInKuwait(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuwait",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function periodRange(period: AiPeriod, today: string) {
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const to = today;
  const from = addDays(today, 1 - days);
  const previousTo = addDays(from, -1);
  const previousFrom = addDays(previousTo, 1 - days);
  return { from, to, previousFrom, previousTo, days };
}

function sumTransactions(
  rows: AiTransactionRow[],
  from: string,
  to: string,
  currencyCode: string,
) {
  let income = 0n;
  let expenses = 0n;
  const categories = new Map<string, bigint>();
  for (const row of rows) {
    if (
      row.currency_code !== currencyCode
      || row.transaction_date < from
      || row.transaction_date > to
    ) continue;
    const value = parseMilli(row.amount);
    if (row.transaction_type === "income") income += value;
    else {
      expenses += value;
      const category = row.category?.trim() || "other";
      categories.set(category, (categories.get(category) ?? 0n) + value);
    }
  }
  const net = income - expenses;
  return {
    income,
    expenses,
    net,
    margin: margin(net, income),
    categories: [...categories.entries()]
      .sort((a, b) => a[1] === b[1] ? a[0].localeCompare(b[0]) : a[1] > b[1] ? -1 : 1)
      .map(([category, value]) => ({ category, amount: value })),
  };
}

function changePercent(current: bigint, previous: bigint): bigint | null {
  if (previous === 0n) return null;
  const delta = current - previous;
  const absDelta = delta < 0n ? -delta : delta;
  const absPrevious = previous < 0n ? -previous : previous;
  const result = (absDelta * 10_000n + absPrevious / 2n) / absPrevious;
  return delta < 0n ? -result : result;
}

function daysBetween(from: string, to: string): number {
  return Math.max(0, Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000));
}

function productCost(product: AiProductRow): bigint {
  return parseMilli(product.materials_cost)
    + parseMilli(product.packaging_cost)
    + parseMilli(product.other_cost);
}

function allocateOrderDiscount(
  order: AiOrderRow,
  items: AiOrderItemRow[],
): Map<string, bigint> {
  const discount = parseMilli(order.discount);
  const subtotal = parseMilli(order.subtotal);
  const result = new Map<string, bigint>();
  if (discount === 0n || subtotal <= 0n) {
    for (const item of items) result.set(item.id, 0n);
    return result;
  }
  const shares = items.map((item) => {
    const line = parseMilli(item.line_total);
    const numerator = discount * line;
    return {
      item,
      value: numerator / subtotal,
      remainder: numerator % subtotal,
    };
  });
  const allocated = shares.reduce((total, share) => total + share.value, 0n);
  let remaining = discount - allocated;
  shares.sort((a, b) => a.remainder === b.remainder
    ? a.item.position - b.item.position
    : a.remainder > b.remainder ? -1 : 1);
  for (const share of shares) {
    const extra = remaining > 0n ? 1n : 0n;
    if (extra) remaining -= 1n;
    result.set(share.item.id, share.value + extra);
  }
  return result;
}

function buildPaidProductSales(
  orders: AiOrderRow[],
  items: AiOrderItemRow[],
  products: AiProductRow[],
  from: string,
  to: string,
  currencyCode: string,
) {
  const byOrder = new Map<string, AiOrderItemRow[]>();
  for (const item of items) {
    const group = byOrder.get(item.order_id) ?? [];
    group.push(item);
    byOrder.set(item.order_id, group);
  }
  const productMap = new Map(products.map((product) => [product.id, product]));
  const sales = new Map<string, { units: number; revenue: bigint; cost: bigint; orders: Set<string> }>();
  let paidOrderTotal = 0n;
  let unpaidOrderTotal = 0n;
  let paidOrderDiscounts = 0n;

  for (const order of orders) {
    if (
      order.order_status === "Cancelled"
      || order.currency_code !== currencyCode
      || order.order_date < from
      || order.order_date > to
    ) continue;
    const total = parseMilli(order.total);
    if (order.payment_status === "Paid") {
      paidOrderTotal += total;
      paidOrderDiscounts += parseMilli(order.discount);
    } else {
      unpaidOrderTotal += total;
    }
    const orderItems = byOrder.get(order.id) ?? [];
    if (order.payment_status !== "Paid" || orderItems.length === 0) continue;
    const discountShares = allocateOrderDiscount(order, orderItems);
    for (const item of orderItems) {
      if (!item.product_id) continue;
      const lineRevenue = parseMilli(item.line_total) - (discountShares.get(item.id) ?? 0n);
      const product = productMap.get(item.product_id);
      const current = sales.get(item.product_id) ?? {
        units: 0,
        revenue: 0n,
        cost: 0n,
        orders: new Set<string>(),
      };
      current.units += item.quantity;
      current.revenue += lineRevenue;
      if (product) current.cost += productCost(product) * BigInt(item.quantity);
      current.orders.add(order.id);
      sales.set(item.product_id, current);
    }
  }
  return { sales, paidOrderTotal, unpaidOrderTotal, paidOrderDiscounts };
}

export function buildAiAnalysis(input: AiAnalysisInput): AiAnalysis {
  const { from, to, previousFrom, previousTo } = periodRange(input.period, input.today);
  const current = sumTransactions(input.transactions, from, to, input.currencyCode);
  const previous = sumTransactions(input.transactions, previousFrom, previousTo, input.currencyCode);
  const monthFrom = `${input.today.slice(0, 7)}-01`;
  const priorMonthTo = addDays(monthFrom, -1);
  const priorMonthFrom = `${priorMonthTo.slice(0, 7)}-01`;
  const monthCurrent = sumTransactions(input.transactions, monthFrom, input.today, input.currencyCode);
  const monthPrevious = sumTransactions(input.transactions, priorMonthFrom, priorMonthTo, input.currencyCode);
  const expenseShipping = input.transactions.reduce((total, transaction) => {
    if (
      transaction.transaction_type !== "expense"
      || transaction.category !== "shipping"
      || transaction.currency_code !== input.currencyCode
      || transaction.transaction_date < from
      || transaction.transaction_date > to
    ) return total;
    return total + parseMilli(transaction.amount);
  }, 0n);

  const today = input.today;
  const productById = new Map(input.products.map((product) => [product.id, product]));
  const productPeriods: Record<AiPeriod, Array<{ productId: string; name: string; paidUnits: number; paidRevenue: string }>> = {
    "7d": [],
    "30d": [],
    "90d": [],
  };
  const profitByProduct = new Map<string, { revenue: bigint; profit: bigint; units: number }>();
  const prior30 = buildPaidProductSales(input.orders, input.items, input.products, addDays(today, -59), addDays(today, -30), input.currencyCode);
  const last30 = buildPaidProductSales(input.orders, input.items, input.products, addDays(today, -29), today, input.currencyCode);
  const last90 = buildPaidProductSales(input.orders, input.items, input.products, addDays(today, -89), today, input.currencyCode);

  for (const window of ["7d", "30d", "90d"] as const) {
    const days = window === "7d" ? 7 : window === "30d" ? 30 : 90;
    const sales = buildPaidProductSales(input.orders, input.items, input.products, addDays(today, 1 - days), today, input.currencyCode);
    productPeriods[window] = [...sales.sales.entries()]
      .map(([productId, values]) => ({
        productId,
        name: productById.get(productId)?.name ?? "Deleted product",
        paidUnits: values.units,
        paidRevenue: amount(values.revenue),
      }))
      .sort((a, b) => b.paidUnits - a.paidUnits || b.paidRevenue.localeCompare(a.paidRevenue))
      .slice(0, 5);
  }

  for (const [productId, values] of last90.sales) {
    profitByProduct.set(productId, {
      revenue: values.revenue,
      profit: values.revenue - values.cost,
      units: values.units,
    });
  }
  const mostProfitable = [...profitByProduct.entries()]
    .map(([productId, value]) => {
      const product = productById.get(productId);
      return {
        productId,
        name: product?.name ?? "Deleted product",
        estimatedProfit: amount(value.profit),
        marginPercent: percent(margin(value.profit, value.revenue)),
        paidUnits: value.units,
        profitValue: value.profit,
      };
    })
    .sort((a, b) => a.profitValue === b.profitValue ? a.name.localeCompare(b.name) : a.profitValue > b.profitValue ? -1 : 1)
    .slice(0, 5)
    .map(({ profitValue: _profitValue, ...value }) => value);

  const negativeMarginProducts = input.products
    .filter((product) => product.currency_code === input.currencyCode)
    .map((product) => {
      const selling = parseMilli(product.selling_price);
      const cost = productCost(product);
      const unitProfit = selling - cost;
      return {
        productId: product.id,
        name: product.name,
        unitProfit,
        margin: margin(unitProfit, selling),
      };
    })
    .filter((product) => product.unitProfit < 0n && product.margin !== null)
    .slice(0, 8);

  const slowMoving = input.products
    .filter((product) => product.currency_code === input.currencyCode && product.created_at.slice(0, 10) <= addDays(today, -30))
    .map((product) => ({
      productId: product.id,
      name: product.name,
      previousPaidUnits: prior30.sales.get(product.id)?.units ?? 0,
      currentPaidUnits: last30.sales.get(product.id)?.units ?? 0,
    }))
    .filter((product) => product.previousPaidUnits >= 3 && product.currentPaidUnits <= Math.floor(product.previousPaidUnits / 2))
    .sort((a, b) => a.currentPaidUnits - b.currentPaidUnits || b.previousPaidUnits - a.previousPaidUnits)
    .slice(0, 8);

  const noSales = input.products
    .filter((product) => product.currency_code === input.currencyCode && product.created_at.slice(0, 10) <= addDays(today, -30))
    .filter((product) => (last30.sales.get(product.id)?.units ?? 0) === 0)
    .map((product) => ({
      productId: product.id,
      name: product.name,
      daysSinceAdded: daysBetween(product.created_at.slice(0, 10), today),
    }))
    .slice(0, 8);

  const restocking = input.products
    .filter((product) => product.currency_code === input.currencyCode)
    .map((product) => {
      const sales = last90.sales.get(product.id);
      const paidUnitsLast30Days = last30.sales.get(product.id)?.units ?? 0;
      const observedDays = Math.max(1, Math.min(90, daysBetween(product.created_at.slice(0, 10), today) + 1));
      const sufficientHistory = observedDays >= 30 && (sales?.orders.size ?? 0) >= 3;
      const dailyUnits = sufficientHistory ? (sales?.units ?? 0) / observedDays : 0;
      const daysOfStock = dailyUnits > 0 ? Math.floor(product.available_quantity / dailyUnits) : null;
      const needsRestock = product.available_quantity <= product.low_stock_threshold
        || (daysOfStock !== null && daysOfStock <= 14);
      if (!needsRestock) return null;
      const suggestedQuantity = sufficientHistory && dailyUnits > 0
        ? Math.max(0, Math.ceil(dailyUnits * 30 - product.available_quantity))
        : null;
      return {
        productId: product.id,
        name: product.name,
        availableQuantity: product.available_quantity,
        lowStockThreshold: product.low_stock_threshold,
        paidUnitsLast30Days,
        daysOfStock,
        suggestedQuantity,
        reason: sufficientHistory
          ? "Based on paid order history and current stock."
          : "Stock is at its alert threshold, but paid order history is insufficient for a purchase quantity.",
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => a.availableQuantity - b.availableQuantity)
    .slice(0, 10);

  const evidence: AiEvidence[] = [];
  const addEvidence = (id: string, label: string, details: AiEvidence["details"]) => {
    evidence.push({ id, label, details });
  };
  if (current.income !== 0n || previous.income !== 0n) {
    addEvidence("financial-income", "ledger income", {
      current: amount(current.income), previous: amount(previous.income),
      changePercent: percent(changePercent(current.income, previous.income)),
    });
  }
  if (current.expenses !== 0n || previous.expenses !== 0n) {
    addEvidence("financial-expenses", "ledger expenses", {
      current: amount(current.expenses), previous: amount(previous.expenses),
      changePercent: percent(changePercent(current.expenses, previous.expenses)),
      largestCategory: current.categories[0]?.category ?? null,
    });
  }
  if (current.net !== 0n || previous.net !== 0n) {
    addEvidence("financial-profit", "ledger net profit", {
      current: amount(current.net), previous: amount(previous.net),
      changePercent: percent(changePercent(current.net, previous.net)),
    });
  }
  for (const product of negativeMarginProducts.slice(0, 5)) {
    addEvidence(`negative-margin-${product.productId}`, "negative unit margin", {
      product: product.name,
      unitProfit: amount(product.unitProfit),
      marginPercent: percent(product.margin),
    });
  }
  for (const product of restocking.slice(0, 5)) {
    addEvidence(`stock-${product.productId}`, "restock signal", {
      product: product.name,
      availableQuantity: product.availableQuantity,
      threshold: product.lowStockThreshold,
      daysOfStock: product.daysOfStock,
      suggestedQuantity: product.suggestedQuantity,
    });
  }
  if (expenseShipping > 0n) {
    addEvidence("shipping-expenses", "shipping expenses from the ledger", { amount: amount(expenseShipping) });
  }

  return {
    period: input.period,
    currencyCode: input.currencyCode,
    from,
    to,
    previousFrom,
    previousTo,
    monthToDate: {
      from: monthFrom,
      to: input.today,
      income: amount(monthCurrent.income),
      expenses: amount(monthCurrent.expenses),
      netProfit: amount(monthCurrent.net),
      marginPercent: percent(monthCurrent.margin),
    },
    previousMonth: {
      from: priorMonthFrom,
      to: priorMonthTo,
      income: amount(monthPrevious.income),
      expenses: amount(monthPrevious.expenses),
      netProfit: amount(monthPrevious.net),
      marginPercent: percent(monthPrevious.margin),
    },
    financial: {
      current: {
        income: amount(current.income),
        expenses: amount(current.expenses),
        netProfit: amount(current.net),
        marginPercent: percent(current.margin),
      },
      previous: {
        income: amount(previous.income),
        expenses: amount(previous.expenses),
        netProfit: amount(previous.net),
        marginPercent: percent(previous.margin),
      },
      changes: {
        incomePercent: percent(changePercent(current.income, previous.income)),
        expensesPercent: percent(changePercent(current.expenses, previous.expenses)),
        netProfitPercent: percent(changePercent(current.net, previous.net)),
        marginPoints: current.margin === null || previous.margin === null ? null : percent(current.margin - previous.margin),
      },
      expenseCategories: current.categories.slice(0, 8).map((entry) => ({ category: entry.category, amount: amount(entry.amount) })),
      paidOrderTotal: amount(buildPaidProductSales(input.orders, input.items, input.products, from, to, input.currencyCode).paidOrderTotal),
      unpaidOrPendingOrderTotal: amount(buildPaidProductSales(input.orders, input.items, input.products, from, to, input.currencyCode).unpaidOrderTotal),
      cancelledOrdersExcluded: true,
      ledgerAndOrdersKeptSeparate: true,
    },
    productPerformance: {
      bestSellers: productPeriods,
      mostProfitable,
      slowMoving,
      noSales,
      costBasisNote: "Profit estimates use current saved unit costs and paid order revenue after proportionally allocated discounts; general expenses and shipping are not assigned to products.",
    },
    profitLeaks: {
      paidOrderDiscounts: amount(last90.paidOrderDiscounts),
      shippingExpensesFromLedger: amount(expenseShipping),
      negativeMarginProducts: negativeMarginProducts.map((entry) => ({
        productId: entry.productId,
        name: entry.name,
        unitProfit: amount(entry.unitProfit),
        marginPercent: percent(entry.margin) ?? "0",
      })),
      note: "Shipping expenses come from the user's ledger and are not allocated to product costs.",
    },
    restocking,
    evidence,
  };
}

export function buildChatFacts(analysis: AiAnalysis) {
  return {
    currency: analysis.currencyCode,
    period: { from: analysis.from, to: analysis.to },
    ledger: analysis.financial.current,
    previousLedgerPeriod: { from: analysis.previousFrom, to: analysis.previousTo, ...analysis.financial.previous },
    ledgerChanges: analysis.financial.changes,
    monthToDate: analysis.monthToDate,
    previousMonth: analysis.previousMonth,
    expenseCategories: analysis.financial.expenseCategories,
    paidOrderRevenue: analysis.financial.paidOrderTotal,
    unpaidOrPendingOrderRevenue: analysis.financial.unpaidOrPendingOrderTotal,
    bestSellers7d: analysis.productPerformance.bestSellers["7d"],
    bestSellers30d: analysis.productPerformance.bestSellers["30d"],
    bestSellers90d: analysis.productPerformance.bestSellers["90d"],
    mostProfitableProducts: analysis.productPerformance.mostProfitable,
    slowMovingProducts: analysis.productPerformance.slowMoving,
    noPaidSalesLast30Days: analysis.productPerformance.noSales,
    restocking: analysis.restocking,
    negativeMarginProducts: analysis.profitLeaks.negativeMarginProducts,
    dataRules: [
      "Ledger income and order revenue are separate sources and are never added together.",
      "Cancelled orders are excluded. Paid and unpaid or pending totals are separate.",
      "Product profit uses current saved costs, not historical cost snapshots.",
      "General operating and shipping expenses are not allocated to individual products.",
    ],
  };
}

export function calculatePriceAdvice(
  product: AiProductRow,
  proposedPrice: string | number,
) {
  if (!/^\d{1,11}(?:\.\d{1,3})?$/.test(String(proposedPrice).trim())) {
    throw new Error("Enter a selling price greater than zero.");
  }
  const priceMilli = parseMilli(proposedPrice);
  if (priceMilli <= 0n) throw new Error("Enter a selling price greater than zero.");
  const currentPrice = parseMilli(product.selling_price);
  const totalCost = productCost(product);
  const currentProfit = currentPrice - totalCost;
  const proposedProfit = priceMilli - totalCost;
  return {
    productId: product.id,
    productName: product.name,
    currencyCode: product.currency_code,
    currentPrice: amount(currentPrice),
    proposedPrice: amount(priceMilli),
    totalUnitCost: amount(totalCost),
    currentUnitProfit: amount(currentProfit),
    proposedUnitProfit: amount(proposedProfit),
    currentMarginPercent: percent(margin(currentProfit, currentPrice)),
    proposedMarginPercent: percent(margin(proposedProfit, priceMilli)),
    profitChangePerUnit: amount(proposedProfit - currentProfit),
  };
}
