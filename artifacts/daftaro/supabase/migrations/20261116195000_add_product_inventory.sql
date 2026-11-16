alter table public.business_products
  add column available_quantity integer not null default 0
    check (available_quantity >= 0),
  add column low_stock_threshold integer not null default 5
    check (low_stock_threshold >= 0);

create table public.business_product_stock_reservations (
  order_item_id uuid primary key
    references public.order_items (id) on delete cascade,
  order_id uuid not null
    references public.orders (id) on delete cascade,
  product_id uuid not null
    references public.business_products (id) on delete cascade,
  user_id uuid not null
    references auth.users (id) on delete cascade,
  quantity integer not null check (quantity between 1 and 99),
  created_at timestamptz not null default now()
);

create index business_product_stock_reservations_order_idx
  on public.business_product_stock_reservations (order_id, user_id);

alter table public.business_product_stock_reservations enable row level security;
revoke all on public.business_product_stock_reservations
  from public, anon, authenticated;

create or replace function public.reserve_business_product_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_status text;
begin
  if new.product_id is null then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 0)
  );

  select order_record.order_status
    into v_order_status
    from public.orders as order_record
    where order_record.id = new.order_id
      and order_record.user_id = new.user_id
    for key share;

  if not found then
    raise exception 'Order not found while reserving product stock';
  end if;
  if v_order_status = 'Cancelled' then
    return new;
  end if;

  update public.business_products as product
    set available_quantity = product.available_quantity - new.quantity
    where product.id = new.product_id
      and product.user_id = new.user_id
      and product.available_quantity >= new.quantity;

  if not found then
    raise exception 'Insufficient stock. Update the product quantity and retry the order.';
  end if;

  insert into public.business_product_stock_reservations (
    order_item_id,
    order_id,
    product_id,
    user_id,
    quantity
  ) values (
    new.id,
    new.order_id,
    new.product_id,
    new.user_id,
    new.quantity
  );

  return new;
end;
$$;

create or replace function public.release_business_product_stock_for_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product_id uuid;
  v_user_id uuid;
  v_quantity integer;
begin
  delete from public.business_product_stock_reservations as reservation
    where reservation.order_item_id = old.id
      and reservation.user_id = old.user_id
    returning reservation.product_id, reservation.user_id, reservation.quantity
      into v_product_id, v_user_id, v_quantity;

  if found then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_user_id::text, 0)
    );
    update public.business_products as product
      set available_quantity = product.available_quantity + v_quantity
      where product.id = v_product_id
        and product.user_id = v_user_id;
  end if;

  return old;
end;
$$;

create or replace function public.release_business_product_stock_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.order_status is distinct from 'Cancelled'
    and new.order_status = 'Cancelled' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(new.user_id::text, 0)
    );

    with released as (
      delete from public.business_product_stock_reservations as reservation
        where reservation.order_id = new.id
          and reservation.user_id = new.user_id
        returning reservation.product_id, reservation.user_id, reservation.quantity
    ),
    totals as (
      select released.product_id, released.user_id, sum(released.quantity)::integer as quantity
        from released
        group by released.product_id, released.user_id
    )
    update public.business_products as product
      set available_quantity = product.available_quantity + totals.quantity
      from totals
      where product.id = totals.product_id
        and product.user_id = totals.user_id;
  end if;

  return new;
end;
$$;

revoke all on function public.reserve_business_product_stock()
  from public, anon, authenticated;
revoke all on function public.release_business_product_stock_for_item()
  from public, anon, authenticated;
revoke all on function public.release_business_product_stock_on_cancel()
  from public, anon, authenticated;

drop trigger if exists reserve_business_product_stock_after_item_insert
  on public.order_items;
create trigger reserve_business_product_stock_after_item_insert
  after insert on public.order_items
  for each row
  execute function public.reserve_business_product_stock();

drop trigger if exists release_business_product_stock_after_item_delete
  on public.order_items;
create trigger release_business_product_stock_after_item_delete
  after delete on public.order_items
  for each row
  execute function public.release_business_product_stock_for_item();

drop trigger if exists release_business_product_stock_after_order_cancel
  on public.orders;
create trigger release_business_product_stock_after_order_cancel
  after update of order_status on public.orders
  for each row
  execute function public.release_business_product_stock_on_cancel();
