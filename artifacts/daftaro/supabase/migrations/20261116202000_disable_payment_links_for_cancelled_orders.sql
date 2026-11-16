create or replace function public.get_public_invoice(p_public_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'invoice', pg_catalog.jsonb_build_object(
      'invoice_number', invoice.invoice_number,
      'issued_at', invoice.issued_at,
      'payment_url', case
        when order_record.order_status <> 'Cancelled'
          and invoice.payment_provider_reference ~ '^plink_[A-Za-z0-9]+$'
          then invoice.payment_url
        else null
      end
    ),
    'order', pg_catalog.jsonb_build_object(
      'order_number', order_record.order_number,
      'order_date', order_record.order_date,
      'order_status', order_record.order_status,
      'payment_status', order_record.payment_status,
      'currency_code', order_record.currency_code,
      'subtotal', order_record.subtotal,
      'discount', order_record.discount,
      'shipping_fee', order_record.shipping_fee,
      'total', order_record.total
    ),
    'business', pg_catalog.jsonb_build_object(
      'business_name', invoice.business_name_snapshot
    ),
    'customer', pg_catalog.jsonb_build_object(
      'name', order_record.customer_name_snapshot,
      'phone', order_record.customer_phone_snapshot,
      'email', order_record.customer_email_snapshot
    ),
    'items', coalesce(
      (
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'product_name', item.product_name,
            'quantity', item.quantity,
            'unit_price', item.unit_price,
            'line_total', item.line_total
          )
          order by item.position
        )
        from public.order_items as item
        where item.order_id = order_record.id
          and item.user_id = order_record.user_id
      ),
      '[]'::jsonb
    )
  )
  from public.invoices as invoice
  join public.orders as order_record
    on order_record.id = invoice.order_id
   and order_record.user_id = invoice.user_id
  where invoice.public_token = p_public_token;
$$;

revoke all on function public.get_public_invoice(uuid)
  from public, anon, authenticated;
grant execute on function public.get_public_invoice(uuid)
  to anon, authenticated;

create or replace function public.save_stripe_generated_payment_link(
  p_order_id uuid,
  p_payment_url text,
  p_payment_provider_reference text,
  p_expected_total numeric,
  p_expected_currency_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_total numeric;
  v_current_currency text;
  v_order_status text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_order_id is null then
    raise exception 'Order is required';
  end if;
  if p_payment_url is null then
    if p_payment_provider_reference is not null then
      raise exception 'A cleared payment link cannot keep a provider reference';
    end if;
  elsif p_payment_url !~ '^https://buy[.]stripe[.]com/test_[A-Za-z0-9_-]+/?$'
    or p_payment_provider_reference is null
    or p_payment_provider_reference !~ '^plink_[A-Za-z0-9]+$' then
    raise exception 'A Stripe test-mode Payment Link and reference are required';
  end if;

  select order_record.total, order_record.currency_code, order_record.order_status
    into v_current_total, v_current_currency, v_order_status
    from public.orders as order_record
    join public.invoices as invoice
      on invoice.order_id = order_record.id
     and invoice.user_id = order_record.user_id
    where order_record.id = p_order_id
      and order_record.user_id = v_user_id
    for update of order_record;

  if not found then
    raise exception 'Invoice not found';
  end if;

  if p_payment_url is not null and v_order_status = 'Cancelled' then
    raise exception 'Cancelled orders cannot create payment links';
  end if;

  if p_payment_url is not null
    and (
      v_current_total is distinct from p_expected_total
      or v_current_currency is distinct from p_expected_currency_code
    ) then
    raise exception 'Invoice total changed during payment-link generation';
  end if;

  update public.invoices
    set payment_url = p_payment_url,
        payment_provider_reference = p_payment_provider_reference
    where order_id = p_order_id
      and user_id = v_user_id;

  if not found then
    raise exception 'Invoice not found';
  end if;
end;
$$;

revoke all on function public.save_stripe_generated_payment_link(uuid, text, text, numeric, text)
  from public, anon, authenticated;
grant execute on function public.save_stripe_generated_payment_link(uuid, text, text, numeric, text)
  to authenticated;
