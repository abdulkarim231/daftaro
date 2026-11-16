import { createClient } from "@supabase/supabase-js";
import {
  CreateInvoicePaymentLinkBody,
  CreateInvoicePaymentLinkResponse,
} from "@workspace/api-zod";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  deactivateInvoicePaymentLink,
  createInvoicePaymentLink as createStripeInvoicePaymentLink,
} from "../lib/stripe-invoice-payment";
import {
  InvoiceAmountError,
  isStripeTestPaymentLink,
  toStripeUnitAmount,
} from "../lib/stripe-invoice-amount";
import {
  createStripeTestClient,
  StripeTestConfigurationError,
} from "../lib/stripe-client";

const router: IRouter = Router();
const PAYMENT_LINK_ID = /^plink_[A-Za-z0-9]+$/;

type OrderRow = {
  id: string;
  order_number: string;
  total: string | number;
  currency_code: string;
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  payment_url: string | null;
  payment_provider_reference: string | null;
};

function sendError(res: Response, status: number, error: string): void {
  res.status(status).json({ error });
}

function accessTokenFrom(req: Request): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(req.get("authorization") ?? "");
  return match?.[1] ?? null;
}

function getSupabaseClient(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) return null;

  return createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

async function savePaymentLink(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  order: OrderRow,
  paymentUrl: string | null,
  paymentLinkId: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("save_stripe_generated_payment_link", {
    p_order_id: order.id,
    p_payment_url: paymentUrl,
    p_payment_provider_reference: paymentLinkId,
    p_expected_total: order.total,
    p_expected_currency_code: order.currency_code,
  });
  if (error) throw error;
}

function isInvoiceTotalChanged(error: unknown): boolean {
  return (
    typeof error === "object"
    && error !== null
    && "message" in error
    && error.message === "Invoice total changed during payment-link generation"
  );
}

router.post(
  "/invoice-payment-links",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = CreateInvoicePaymentLinkBody.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, "A valid order ID is required.");
      return;
    }

    const accessToken = accessTokenFrom(req);
    if (!accessToken) {
      sendError(res, 401, "Sign in to create a payment link.");
      return;
    }

    const supabase = getSupabaseClient(accessToken);
    if (!supabase) {
      sendError(res, 503, "Payment services are not configured.");
      return;
    }

    const { data: authData, error: authError } =
      await supabase.auth.getUser(accessToken);
    if (authError || !authData.user) {
      sendError(res, 401, "Sign in to create a payment link.");
      return;
    }

    const userId = authData.user.id;
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("id,order_number,total,currency_code")
      .eq("id", parsed.data.orderId)
      .eq("user_id", userId)
      .maybeSingle();
    if (orderError) {
      req.log.error({ code: orderError.code }, "Could not load invoice order");
      sendError(res, 502, "The invoice could not be loaded.");
      return;
    }
    const order = orderData as OrderRow | null;
    if (!order) {
      sendError(res, 404, "Order not found.");
      return;
    }

    const { data: invoiceData, error: invoiceError } = await supabase
      .from("invoices")
      .select("id,invoice_number,payment_url,payment_provider_reference")
      .eq("order_id", order.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (invoiceError) {
      req.log.error({ code: invoiceError.code }, "Could not load order invoice");
      sendError(res, 502, "The invoice could not be loaded.");
      return;
    }
    const invoice = invoiceData as InvoiceRow | null;
    if (!invoice) {
      sendError(res, 404, "Invoice not found.");
      return;
    }

    let unitAmount: number;
    try {
      unitAmount = toStripeUnitAmount(order.total, order.currency_code);
    } catch (error) {
      if (error instanceof InvoiceAmountError) {
        sendError(res, 400, error.message);
        return;
      }
      throw error;
    }

    const paymentLinkId =
      invoice.payment_provider_reference
      && PAYMENT_LINK_ID.test(invoice.payment_provider_reference)
        ? invoice.payment_provider_reference
        : null;

    if (
      unitAmount > 0
      && invoice.payment_url
      && paymentLinkId
      && isStripeTestPaymentLink(invoice.payment_url)
    ) {
      res.json(
        CreateInvoicePaymentLinkResponse.parse({
          paymentUrl: invoice.payment_url,
          status: "reused",
        }),
      );
      return;
    }

    if (unitAmount === 0) {
      try {
        if (paymentLinkId) {
          const stripe = createStripeTestClient();
          await deactivateInvoicePaymentLink(stripe, paymentLinkId);
        }
        if (invoice.payment_url || invoice.payment_provider_reference) {
          await savePaymentLink(supabase, order, null, null);
        }
      } catch (error) {
        if (error instanceof StripeTestConfigurationError) {
          req.log.error({ reason: error.message }, "Stripe test key is unavailable");
          sendError(res, 503, "Stripe test payments are not configured.");
          return;
        }
        const stripeCode =
          typeof error === "object" && error !== null && "code" in error
            ? String(error.code)
            : "unknown";
        req.log.error({ stripeCode }, "Could not clear zero-total invoice link");
        sendError(res, 502, "The old payment link could not be disabled.");
        return;
      }
      res.json(
        CreateInvoicePaymentLinkResponse.parse({
          paymentUrl: null,
          status: "no_payment_due",
        }),
      );
      return;
    }

    let stripe;
    try {
      stripe = createStripeTestClient();
    } catch (error) {
      if (error instanceof StripeTestConfigurationError) {
        req.log.error({ reason: error.message }, "Stripe test key is unavailable");
        sendError(res, 503, "Stripe test payments are not configured.");
        return;
      }
      throw error;
    }

    try {
      if (paymentLinkId) {
        await deactivateInvoicePaymentLink(stripe, paymentLinkId);
      }

      if (!paymentLinkId && invoice.payment_url) {
        await savePaymentLink(supabase, order, null, null);
      }

      const created = await createStripeInvoicePaymentLink(stripe, {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        orderId: order.id,
        orderNumber: order.order_number,
        total: order.total,
        currencyCode: order.currency_code,
        previousPaymentLinkId: invoice.payment_provider_reference,
      });

      try {
        await savePaymentLink(supabase, order, created.url, created.id);
      } catch (error) {
        if (isInvoiceTotalChanged(error)) {
          await deactivateInvoicePaymentLink(stripe, created.id).catch(() => {
            req.log.warn(
              { code: "stale_payment_link_cleanup_failed" },
              "Could not deactivate a link for an outdated invoice total",
            );
          });
          sendError(res, 409, "Invoice total changed. Retry to use the latest total.");
          return;
        }
        throw error;
      }

      res.json(
        CreateInvoicePaymentLinkResponse.parse({
          paymentUrl: created.url,
          status: "created",
        }),
      );
    } catch (error) {
      const stripeCode =
        typeof error === "object" && error !== null && "code" in error
          ? String(error.code)
          : "unknown";
      req.log.error({ stripeCode }, "Stripe invoice payment-link creation failed");
      sendError(res, 502, "A payment link could not be created. Try again.");
    }
  },
);

export default router;
