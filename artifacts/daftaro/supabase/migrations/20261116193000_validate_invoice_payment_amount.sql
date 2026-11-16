revoke all on function public.save_stripe_generated_payment_link(uuid, text, text)
  from public, anon, authenticated;
drop function public.save_stripe_generated_payment_link(uuid, text, text);

create function public.save_stripe_generated_payment_link(
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

  select order_record.total, order_record.currency_code
    into v_current_total, v_current_currency
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
