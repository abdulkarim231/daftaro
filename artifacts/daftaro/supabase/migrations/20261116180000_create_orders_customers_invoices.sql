create sequence public.daftaro_order_number_seq;
create sequence public.daftaro_invoice_number_seq;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null
    check (char_length(btrim(name)) between 1 and 120),
  phone text not null
    check (
      phone ~ '^[+0-9() .-]{7,24}$'
      and char_length(regexp_replace(phone, '[^0-9]', '', 'g')) between 7 and 20
    ),
  email text
    check (
      email is null
      or (
        char_length(email) <= 254
        and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      )
    ),
  notes text
    check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index customers_user_name_idx
  on public.customers (user_id, lower(name));
create index customers_user_phone_idx
  on public.customers (user_id, phone);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  order_number text not null unique,
  customer_id uuid not null,
  customer_name_snapshot text not null
    check (char_length(btrim(customer_name_snapshot)) between 1 and 120),
  customer_phone_snapshot text not null,
  customer_email_snapshot text,
  order_date date not null default current_date,
  order_status text not null default 'New'
    check (order_status in ('New', 'Processing', 'Completed', 'Cancelled')),
  payment_status text not null default 'Unpaid'
    check (payment_status in ('Unpaid', 'Pending', 'Paid', 'Failed', 'Refunded')),
  currency_code text not null
    check (currency_code in ('KWD', 'SAR', 'AED', 'BHD', 'QAR', 'OMR', 'USD')),
  subtotal numeric(14, 3) not null check (subtotal > 0),
  discount numeric(14, 3) not null default 0
    check (discount >= 0 and discount <= subtotal),
  shipping_fee numeric(14, 3) not null default 0
    check (shipping_fee >= 0),
  total numeric(14, 3) not null
    check (total >= 0 and total = subtotal - discount + shipping_fee),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (customer_id, user_id)
    references public.customers (id, user_id)
    on delete restrict
);

create index orders_user_date_idx
  on public.orders (user_id, order_date desc, created_at desc);
create index orders_user_status_idx
  on public.orders (user_id, order_status, payment_status);
create index orders_user_customer_idx
  on public.orders (user_id, customer_id, order_date desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid references public.business_products (id) on delete set null,
  position integer not null check (position between 1 and 50),
  product_name text not null
    check (char_length(btrim(product_name)) between 1 and 120),
  quantity integer not null check (quantity between 1 and 99),
  unit_price numeric(14, 3) not null check (unit_price > 0),
  line_total numeric(14, 3) not null
    check (line_total > 0 and line_total = unit_price * quantity),
  created_at timestamptz not null default now(),
  foreign key (order_id, user_id)
    references public.orders (id, user_id)
    on delete cascade,
  unique (order_id, position)
);

create index order_items_order_idx
  on public.order_items (user_id, order_id, position);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  invoice_number text not null unique,
  public_token uuid not null unique default gen_random_uuid(),
  business_name_snapshot text not null
    check (char_length(btrim(business_name_snapshot)) between 1 and 120),
  issued_at timestamptz not null default now(),
  payment_url text
    check (payment_url is null or payment_url ~ '^https://'),
  payment_provider_reference text
    check (
      payment_provider_reference is null
      or char_length(payment_provider_reference) <= 200
    ),
  foreign key (order_id, user_id)
    references public.orders (id, user_id)
    on delete cascade,
  unique (order_id)
);

create index invoices_user_order_idx
  on public.invoices (user_id, order_id);

alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.invoices enable row level security;

revoke all on table public.customers, public.orders, public.order_items, public.invoices
  from public, anon, authenticated;
grant select, insert, update on public.customers to authenticated;
grant select on public.orders, public.order_items, public.invoices to authenticated;

create policy "Customers are private to their owner"
  on public.customers
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Owners can create their customers"
  on public.customers
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Owners can update their customers"
  on public.customers
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Orders are private to their owner"
  on public.orders
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Order items are private to their owner"
  on public.order_items
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Invoices are private to their owner"
  on public.invoices
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.set_customers_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create trigger set_customers_updated_at
  before update on public.customers
  for each row
  execute function public.set_customers_updated_at();

create or replace function public.set_orders_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create trigger set_orders_updated_at
  before update on public.orders
  for each row
  execute function public.set_orders_updated_at();

create or replace function public.save_order_with_invoice(
  p_order_id uuid,
  p_customer_id uuid,
  p_items jsonb,
  p_discount numeric,
  p_shipping_fee numeric,
  p_order_date date,
  p_order_status text,
  p_payment_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_business_name text;
  v_currency_code text;
  v_customer_name text;
  v_customer_phone text;
  v_customer_email text;
  v_existing_status text;
  v_order_id uuid;
  v_order_number text;
  v_invoice_id uuid;
  v_invoice_number text;
  v_public_token uuid;
  v_item jsonb;
  v_snapshot jsonb;
  v_product_id uuid;
  v_product_name text;
  v_product_price numeric;
  v_product_currency text;
  v_quantity_text text;
  v_quantity integer;
  v_position integer := 0;
  v_seen_products uuid[] := array[]::uuid[];
  v_snapshots jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_total numeric;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_customer_id is null or p_order_date is null then
    raise exception 'Customer and order date are required';
  end if;
  if p_discount is null or p_shipping_fee is null
    or p_discount < 0 or p_shipping_fee < 0
    or pg_catalog.scale(p_discount) > 3
    or pg_catalog.scale(p_shipping_fee) > 3
    or p_discount >= 100000000000
    or p_shipping_fee >= 100000000000 then
    raise exception 'Discount or shipping fee is invalid';
  end if;
  if p_order_status not in ('New', 'Processing', 'Completed', 'Cancelled') then
    raise exception 'Order status is invalid';
  end if;
  if p_payment_status not in ('Unpaid', 'Pending', 'Paid', 'Failed', 'Refunded') then
    raise exception 'Payment status is invalid';
  end if;
  if p_items is null or pg_catalog.jsonb_typeof(p_items) <> 'array' then
    raise exception 'Order items must be an array';
  end if;
  if pg_catalog.jsonb_array_length(p_items) < 1
    or pg_catalog.jsonb_array_length(p_items) > 50 then
    raise exception 'An order must contain between 1 and 50 products';
  end if;

  select profile.business_name, profile.currency_code
    into v_business_name, v_currency_code
    from public.business_profiles as profile
    where profile.user_id = v_user_id
    for key share;
  if not found then
    raise exception 'Complete your business profile first';
  end if;

  select customer.name, customer.phone, customer.email
    into v_customer_name, v_customer_phone, v_customer_email
    from public.customers as customer
    where customer.id = p_customer_id
      and customer.user_id = v_user_id
    for key share;
  if not found then
    raise exception 'Customer not found';
  end if;

  for v_item in
    select value from pg_catalog.jsonb_array_elements(p_items)
  loop
    if pg_catalog.jsonb_typeof(v_item) <> 'object'
      or coalesce(v_item ->> 'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'Product selection is invalid';
    end if;

    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity_text := v_item ->> 'quantity';
    if v_quantity_text !~ '^[1-9][0-9]?$' then
      raise exception 'Quantity must be a whole number between 1 and 99';
    end if;
    v_quantity := v_quantity_text::integer;

    if v_product_id = any(v_seen_products) then
      raise exception 'Each product can appear only once in an order';
    end if;
    v_seen_products := pg_catalog.array_append(v_seen_products, v_product_id);

    select product.name, product.selling_price, product.currency_code
      into v_product_name, v_product_price, v_product_currency
      from public.business_products as product
      where product.id = v_product_id
        and product.user_id = v_user_id
      for key share;
    if not found or v_product_currency <> v_currency_code then
      raise exception 'Product not found or its currency does not match the business currency';
    end if;

    v_position := v_position + 1;
    v_subtotal := v_subtotal + (v_product_price * v_quantity);
    if v_subtotal >= 100000000000 then
      raise exception 'Order subtotal is outside the supported range';
    end if;
    v_snapshots := v_snapshots || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'product_id', v_product_id,
        'product_name', v_product_name,
        'quantity', v_quantity,
        'unit_price', v_product_price,
        'line_total', v_product_price * v_quantity,
        'position', v_position
      )
    );
  end loop;

  if p_discount > v_subtotal then
    raise exception 'Discount cannot exceed the product subtotal';
  end if;
  v_total := v_subtotal - p_discount + p_shipping_fee;
  if v_total >= 100000000000 then
    raise exception 'Order total is outside the supported range';
  end if;

  if p_order_id is null then
    v_order_number := pg_catalog.format(
      'ORD-%s-%s',
      pg_catalog.to_char(p_order_date, 'YYYY'),
      pg_catalog.lpad(pg_catalog.nextval('public.daftaro_order_number_seq')::text, 8, '0')
    );
    insert into public.orders (
      user_id,
      order_number,
      customer_id,
      customer_name_snapshot,
      customer_phone_snapshot,
      customer_email_snapshot,
      order_date,
      order_status,
      payment_status,
      currency_code,
      subtotal,
      discount,
      shipping_fee,
      total
    ) values (
      v_user_id,
      v_order_number,
      p_customer_id,
      v_customer_name,
      v_customer_phone,
      v_customer_email,
      p_order_date,
      p_order_status,
      p_payment_status,
      v_currency_code,
      v_subtotal,
      p_discount,
      p_shipping_fee,
      v_total
    )
    returning id into v_order_id;
  else
    select existing.order_number, existing.order_status
      into v_order_number, v_existing_status
      from public.orders as existing
      where existing.id = p_order_id
        and existing.user_id = v_user_id
      for update;
    if not found then
      raise exception 'Order not found';
    end if;
    if v_existing_status = 'Cancelled' then
      raise exception 'Cancelled orders cannot be edited';
    end if;

    v_order_id := p_order_id;
    update public.orders
      set customer_id = p_customer_id,
          customer_name_snapshot = v_customer_name,
          customer_phone_snapshot = v_customer_phone,
          customer_email_snapshot = v_customer_email,
          order_date = p_order_date,
          order_status = p_order_status,
          payment_status = p_payment_status,
          currency_code = v_currency_code,
          subtotal = v_subtotal,
          discount = p_discount,
          shipping_fee = p_shipping_fee,
          total = v_total
      where id = v_order_id
        and user_id = v_user_id;

    delete from public.order_items
      where order_id = v_order_id
        and user_id = v_user_id;
  end if;

  for v_snapshot in
    select value from pg_catalog.jsonb_array_elements(v_snapshots)
  loop
    insert into public.order_items (
      order_id,
      user_id,
      product_id,
      position,
      product_name,
      quantity,
      unit_price,
      line_total
    ) values (
      v_order_id,
      v_user_id,
      (v_snapshot ->> 'product_id')::uuid,
      (v_snapshot ->> 'position')::integer,
      v_snapshot ->> 'product_name',
      (v_snapshot ->> 'quantity')::integer,
      (v_snapshot ->> 'unit_price')::numeric,
      (v_snapshot ->> 'line_total')::numeric
    );
  end loop;

  select invoice.id, invoice.invoice_number, invoice.public_token
    into v_invoice_id, v_invoice_number, v_public_token
    from public.invoices as invoice
    where invoice.order_id = v_order_id
      and invoice.user_id = v_user_id;

  if not found then
    v_invoice_number := pg_catalog.format(
      'INV-%s-%s',
      pg_catalog.to_char(current_date, 'YYYY'),
      pg_catalog.lpad(pg_catalog.nextval('public.daftaro_invoice_number_seq')::text, 8, '0')
    );
    insert into public.invoices (
      user_id,
      order_id,
      invoice_number,
      business_name_snapshot
    ) values (
      v_user_id,
      v_order_id,
      v_invoice_number,
      v_business_name
    )
    returning id, public_token into v_invoice_id, v_public_token;
  end if;

  return pg_catalog.jsonb_build_object(
    'order_id', v_order_id,
    'invoice_id', v_invoice_id,
    'order_number', v_order_number,
    'invoice_number', v_invoice_number,
    'public_token', v_public_token,
    'subtotal', v_subtotal,
    'discount', p_discount,
    'shipping_fee', p_shipping_fee,
    'total', v_total,
    'currency_code', v_currency_code
  );
end;
$$;

create or replace function public.set_order_status(
  p_order_id uuid,
  p_order_status text,
  p_payment_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_status text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_order_status not in ('New', 'Processing', 'Completed', 'Cancelled') then
    raise exception 'Order status is invalid';
  end if;
  if p_payment_status not in ('Unpaid', 'Pending', 'Paid', 'Failed', 'Refunded') then
    raise exception 'Payment status is invalid';
  end if;

  select order_record.order_status
    into v_current_status
    from public.orders as order_record
    where order_record.id = p_order_id
      and order_record.user_id = v_user_id
    for update;
  if not found then
    raise exception 'Order not found';
  end if;
  if v_current_status = 'Cancelled' and p_order_status <> 'Cancelled' then
    raise exception 'Cancelled orders cannot be reopened';
  end if;

  update public.orders
    set order_status = p_order_status,
        payment_status = p_payment_status
    where id = p_order_id
      and user_id = v_user_id;
end;
$$;

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
      'payment_url', invoice.payment_url
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

revoke all on sequence public.daftaro_order_number_seq from public, anon, authenticated;
revoke all on sequence public.daftaro_invoice_number_seq from public, anon, authenticated;

revoke all on function public.set_customers_updated_at() from public, anon, authenticated;
revoke all on function public.set_orders_updated_at() from public, anon, authenticated;
revoke all on function public.save_order_with_invoice(uuid, uuid, jsonb, numeric, numeric, date, text, text)
  from public, anon, authenticated;
revoke all on function public.set_order_status(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.get_public_invoice(uuid)
  from public, anon, authenticated;

grant execute on function public.save_order_with_invoice(uuid, uuid, jsonb, numeric, numeric, date, text, text)
  to authenticated;
grant execute on function public.set_order_status(uuid, text, text)
  to authenticated;
grant execute on function public.get_public_invoice(uuid)
  to anon, authenticated;
