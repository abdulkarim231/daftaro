import { createClient } from "@supabase/supabase-js";
import express, { Router, type IRouter, type Request, type Response } from "express";
import { extractConfirmedStripePayment, paymentMatchesInvoiceAmount } from "../lib/stripe-payment-confirmation";
import { createStripeTestClient, StripeTestConfigurationError } from "../lib/stripe-client";

const router: IRouter = Router();

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function respondReceived(res: Response, processed: boolean): void {
  res.status(200).json({ received: true, processed });
}

router.post(
  "/stripe/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  async (req: Request, res: Response): Promise<void> => {
    const signature = req.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!signature) {
      res.status(400).json({ error: "Missing Stripe signature." });
      return;
    }
    if (!webhookSecret || !Buffer.isBuffer(req.body)) {
      req.log.error({ code: "stripe_webhook_configuration_missing" }, "Stripe webhook is not configured");
      res.status(503).json({ error: "Stripe payment confirmation is not configured." });
      return;
    }

    let event;
    try {
      const stripe = createStripeTestClient();
      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    } catch (error) {
      if (error instanceof StripeTestConfigurationError) {
        req.log.error({ code: "stripe_test_key_missing" }, "Stripe test payments are not configured");
        res.status(503).json({ error: "Stripe test payments are not configured." });
        return;
      }
      req.log.warn({ code: "stripe_webhook_signature_invalid" }, "Rejected invalid Stripe webhook signature");
      res.status(400).json({ error: "Invalid Stripe signature." });
      return;
    }

    const payment = extractConfirmedStripePayment(event);
    if (!payment) {
      respondReceived(res, false);
      return;
    }

    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      req.log.error({ eventId: payment.eventId, code: "supabase_webhook_configuration_missing" }, "Stripe payment could not be recorded");
      res.status(503).json({ error: "Payment confirmation storage is not configured." });
      return;
    }

    try {
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .select("id,order_id,user_id")
        .eq("payment_provider_reference", payment.paymentLinkId)
        .maybeSingle();
      if (invoiceError) throw invoiceError;
      if (!invoice) {
        req.log.warn({ eventId: payment.eventId, code: "invoice_payment_link_not_found" }, "Stripe payment link did not match an invoice");
        respondReceived(res, false);
        return;
      }

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("id,total,currency_code,payment_status")
        .eq("id", invoice.order_id)
        .eq("user_id", invoice.user_id)
        .maybeSingle();
      if (orderError) throw orderError;
      if (!order) {
        req.log.warn({ eventId: payment.eventId, code: "invoice_order_not_found" }, "Stripe payment invoice has no matching order");
        respondReceived(res, false);
        return;
      }

      if (!paymentMatchesInvoiceAmount(payment, order.total, order.currency_code)) {
        req.log.warn({ eventId: payment.eventId, orderId: order.id, code: "stripe_payment_amount_mismatch" }, "Stripe payment did not match the saved order total");
        respondReceived(res, false);
        return;
      }

      if (order.payment_status === "Paid" || order.payment_status === "Refunded") {
        respondReceived(res, true);
        return;
      }

      const { data: updatedOrder, error: updateError } = await supabase
        .from("orders")
        .update({ payment_status: "Paid" })
        .eq("id", order.id)
        .eq("user_id", invoice.user_id)
        .eq("total", order.total)
        .eq("currency_code", order.currency_code)
        .neq("payment_status", "Paid")
        .neq("payment_status", "Refunded")
        .select("id")
        .maybeSingle();
      if (updateError) throw updateError;

      if (updatedOrder) {
        req.log.info({ eventId: payment.eventId, orderId: order.id }, "Stripe payment confirmed for order");
      } else {
        req.log.info({ eventId: payment.eventId, orderId: order.id }, "Stripe payment was already processed or order details changed");
      }
      respondReceived(res, true);
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "unknown";
      req.log.error({ eventId: payment.eventId, code }, "Stripe payment confirmation failed");
      res.status(500).json({ error: "Stripe payment confirmation could not be recorded." });
    }
  },
);

export default router;
