import { supabase } from "./supabase";

export type OrderStatus = "New" | "Processing" | "Completed" | "Cancelled";
export type PaymentStatus = "Unpaid" | "Pending" | "Paid" | "Failed" | "Refunded";
export type StoredAmount = string | number;

export interface Customer {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerInput {
  id?: string;
  name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
}

export interface BusinessProfile {
  business_name: string;
  currency_code: string;
}

export interface BusinessProduct {
  id: string;
  user_id: string;
  name: string;
  selling_price: StoredAmount;
  currency_code: string;
}

export interface OrderItemInput {
  product_id: string;
  quantity: number;
}

export interface SaveOrderInput {
  order_id?: string | null;
  customer_id: string;
  items: OrderItemInput[];
  discount: string;
  shipping_fee: string;
  order_date: string;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
}

export interface SaveOrderResult {
  order_id: string;
  invoice_id: string;
  order_number: string;
  invoice_number: string;
  public_token: string;
  subtotal: StoredAmount;
  discount: StoredAmount;
  shipping_fee: StoredAmount;
  total: StoredAmount;
  currency_code: string;
}

export interface OrderSummary {
  id: string;
  user_id: string;
  order_number: string;
  customer_id: string;
  customer_name_snapshot: string;
  customer_phone_snapshot: string;
  order_date: string;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  currency_code: string;
  subtotal: StoredAmount;
  discount: StoredAmount;
  shipping_fee: StoredAmount;
  total: StoredAmount;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  product_id: string | null;
  position: number;
  product_name: string;
  quantity: number;
  unit_price: StoredAmount;
  line_total: StoredAmount;
  created_at: string;
}

export interface InvoiceRecord {
  id: string;
  order_id: string;
  invoice_number: string;
  public_token: string;
  business_name_snapshot: string;
  issued_at: string;
  payment_url: string | null;
  payment_provider_reference: string | null;
}

export interface OrderDetails extends OrderSummary {
  customer_email_snapshot: string | null;
  items: OrderItem[];
  invoice: InvoiceRecord | null;
}

export interface PublicInvoice {
  invoice: {
    invoice_number: string;
    issued_at: string;
    payment_url: string | null;
  };
  order: {
    order_number: string;
    order_date: string;
    order_status: OrderStatus;
    payment_status: PaymentStatus;
    currency_code: string;
    subtotal: StoredAmount;
    discount: StoredAmount;
    shipping_fee: StoredAmount;
    total: StoredAmount;
  };
  business: {
    business_name: string;
  };
  customer: {
    name: string;
    phone: string;
    email: string | null;
  };
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: StoredAmount;
    line_total: StoredAmount;
  }>;
}

const PAGE_SIZE = 500;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function requireCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.user.id) throw new Error("Authentication required.");
  return data.session.user.id;
}

export async function getBusinessProfile(): Promise<BusinessProfile> {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from("business_profiles")
    .select("business_name,currency_code")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Complete your business profile first.");
  return data as BusinessProfile;
}

export async function getCustomers(): Promise<Customer[]> {
  const userId = await requireCurrentUserId();
  const rows: Customer[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("customers")
      .select("id,user_id,name,phone,email,notes,created_at,updated_at")
      .eq("user_id", userId)
      .order("name", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as Customer[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export async function saveCustomer(input: CustomerInput): Promise<Customer> {
  const userId = await requireCurrentUserId();
  const values = {
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email?.trim() || null,
    notes: input.notes?.trim() || null,
  };
  const query = input.id
    ? supabase.from("customers").update(values).eq("id", input.id).eq("user_id", userId)
    : supabase.from("customers").insert({ ...values, user_id: userId });
  const { data, error } = await query
    .select("id,user_id,name,phone,email,notes,created_at,updated_at")
    .single();
  if (error) throw error;
  return data as Customer;
}

export async function getOrderableProducts(currencyCode: string): Promise<BusinessProduct[]> {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from("business_products")
    .select("id,user_id,name,selling_price,currency_code")
    .eq("user_id", userId)
    .eq("currency_code", currencyCode)
    .order("name", { ascending: true })
    .range(0, PAGE_SIZE - 1);
  if (error) throw error;
  return (data ?? []) as BusinessProduct[];
}

export async function getOrders(): Promise<OrderSummary[]> {
  const userId = await requireCurrentUserId();
  const rows: OrderSummary[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id,user_id,order_number,customer_id,customer_name_snapshot,customer_phone_snapshot,order_date,order_status,payment_status,currency_code,subtotal,discount,shipping_fee,total,created_at,updated_at",
      )
      .eq("user_id", userId)
      .order("order_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as OrderSummary[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export async function getCustomerOrderHistory(customerId: string): Promise<OrderSummary[]> {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id,user_id,order_number,customer_id,customer_name_snapshot,customer_phone_snapshot,order_date,order_status,payment_status,currency_code,subtotal,discount,shipping_fee,total,created_at,updated_at",
    )
    .eq("user_id", userId)
    .eq("customer_id", customerId)
    .order("order_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OrderSummary[];
}

export async function getOrderDetails(orderId: string): Promise<OrderDetails | null> {
  const userId = await requireCurrentUserId();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id,user_id,order_number,customer_id,customer_name_snapshot,customer_phone_snapshot,customer_email_snapshot,order_date,order_status,payment_status,currency_code,subtotal,discount,shipping_fee,total,created_at,updated_at",
    )
    .eq("id", orderId)
    .eq("user_id", userId)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order) return null;

  const [itemsResult, invoiceResult] = await Promise.all([
    supabase
      .from("order_items")
      .select("id,product_id,position,product_name,quantity,unit_price,line_total,created_at")
      .eq("order_id", orderId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("invoices")
      .select(
        "id,order_id,invoice_number,public_token,business_name_snapshot,issued_at,payment_url,payment_provider_reference",
      )
      .eq("order_id", orderId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (itemsResult.error) throw itemsResult.error;
  if (invoiceResult.error) throw invoiceResult.error;

  return {
    ...(order as Omit<OrderDetails, "items" | "invoice">),
    items: (itemsResult.data ?? []) as OrderItem[],
    invoice: (invoiceResult.data as InvoiceRecord | null) ?? null,
  };
}

export async function saveOrder(input: SaveOrderInput): Promise<SaveOrderResult> {
  await requireCurrentUserId();
  const { data, error } = await supabase.rpc("save_order_with_invoice", {
    p_order_id: input.order_id ?? null,
    p_customer_id: input.customer_id,
    p_items: input.items,
    p_discount: input.discount,
    p_shipping_fee: input.shipping_fee,
    p_order_date: input.order_date,
    p_order_status: input.order_status,
    p_payment_status: input.payment_status,
  });
  if (error) throw error;
  return data as SaveOrderResult;
}

export async function updateOrderStatus(
  orderId: string,
  orderStatus: OrderStatus,
  paymentStatus: PaymentStatus,
): Promise<void> {
  await requireCurrentUserId();
  const { error } = await supabase.rpc("set_order_status", {
    p_order_id: orderId,
    p_order_status: orderStatus,
    p_payment_status: paymentStatus,
  });
  if (error) throw error;
}

export async function getPublicInvoice(token: string): Promise<PublicInvoice | null> {
  if (!UUID_PATTERN.test(token)) return null;
  const { data, error } = await supabase.rpc("get_public_invoice", {
    p_public_token: token,
  });
  if (error) throw error;
  return (data as PublicInvoice | null) ?? null;
}

export async function getInvoiceForOrder(orderId: string): Promise<PublicInvoice | null> {
  const token = await getInvoiceTokenForOrder(orderId);
  if (!token) return null;
  return getPublicInvoice(token);
}

export async function getInvoiceTokenForOrder(orderId: string): Promise<string | null> {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from("invoices")
    .select("public_token")
    .eq("order_id", orderId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.public_token ?? null;
}
