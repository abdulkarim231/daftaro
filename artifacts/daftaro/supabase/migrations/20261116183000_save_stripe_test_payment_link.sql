create or replace function public.save_stripe_test_payment_link(
  p_order_id uuid,
  p_payment_url text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_order_id is null then
    raise exception 'Order is required';
  end if;
  if p_payment_url is not null
    and p_payment_url !~ '^https://buy[.]stripe[.]com/test_[A-Za-z0-9_-]+/?$' then
    raise exception 'A Stripe test-mode Payment Link is required';
  end if;

  update public.invoices as invoice
    set payment_url = p_payment_url
    from public.orders as order_record
    where invoice.order_id = p_order_id
      and invoice.user_id = v_user_id
      and order_record.id = invoice.order_id
      and order_record.user_id = invoice.user_id;

  if not found then
    raise exception 'Invoice not found';
  end if;
end;
$$;

revoke all on function public.save_stripe_test_payment_link(uuid, text)
  from public, anon, authenticated;
grant execute on function public.save_stripe_test_payment_link(uuid, text)
  to authenticated;
