create table public.purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  invoice_number text
    check (invoice_number is null or char_length(btrim(invoice_number)) between 1 and 100),
  supplier_name text
    check (supplier_name is null or char_length(btrim(supplier_name)) between 1 and 160),
  supplier_phone text
    check (supplier_phone is null or char_length(supplier_phone) <= 40),
  supplier_email text
    check (
      supplier_email is null
      or (
        char_length(supplier_email) <= 254
        and supplier_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      )
    ),
  invoice_date date not null,
  currency_code text not null
    check (currency_code in ('KWD', 'SAR', 'AED', 'BHD', 'QAR', 'OMR', 'USD')),
  subtotal numeric(14, 3) not null check (subtotal >= 0),
  discount numeric(14, 3) not null default 0 check (discount >= 0),
  tax numeric(14, 3) not null default 0 check (tax >= 0),
  shipping_fee numeric(14, 3) not null default 0 check (shipping_fee >= 0),
  other_charges numeric(14, 3) not null default 0 check (other_charges >= 0),
  total numeric(14, 3) not null check (total >= 0),
  ocr_engine smallint not null check (ocr_engine in (0, 2, 3)),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index purchase_invoices_user_supplier_number_idx
  on public.purchase_invoices (
    user_id,
    pg_catalog.lower(coalesce(supplier_name, '')),
    pg_catalog.lower(invoice_number)
  )
  where invoice_number is not null;

create index purchase_invoices_user_date_idx
  on public.purchase_invoices (user_id, invoice_date desc, created_at desc);

create table public.purchase_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid references public.business_products (id) on delete set null,
  position integer not null check (position between 1 and 100),
  product_name_snapshot text not null
    check (char_length(btrim(product_name_snapshot)) between 1 and 160),
  description_snapshot text
    check (description_snapshot is null or char_length(description_snapshot) <= 500),
  sku_snapshot text
    check (sku_snapshot is null or char_length(sku_snapshot) <= 100),
  quantity numeric(14, 3) not null check (quantity > 0),
  unit_of_measurement text
    check (unit_of_measurement is null or char_length(unit_of_measurement) <= 32),
  unit_purchase_price numeric(14, 3) not null check (unit_purchase_price >= 0),
  line_total numeric(14, 3) not null check (line_total >= 0),
  discount numeric(14, 3) not null default 0 check (discount >= 0),
  product_action text not null check (product_action in ('matched', 'created', 'skipped')),
  stock_updated boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (invoice_id, user_id)
    references public.purchase_invoices (id, user_id)
    on delete cascade,
  unique (invoice_id, position)
);

create index purchase_invoice_items_invoice_idx
  on public.purchase_invoice_items (user_id, invoice_id, position);
create index purchase_invoice_items_product_idx
  on public.purchase_invoice_items (user_id, product_id)
  where product_id is not null;

alter table public.purchase_invoices enable row level security;
alter table public.purchase_invoice_items enable row level security;

revoke all on table public.purchase_invoices, public.purchase_invoice_items
  from public, anon, authenticated;
grant select on table public.purchase_invoices, public.purchase_invoice_items to authenticated;

create policy "Users can view their own purchase invoices"
  on public.purchase_invoices
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can view their own purchase invoice items"
  on public.purchase_invoice_items
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.save_purchase_invoice(p_invoice jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_business_currency text;
  v_invoice_id uuid;
  v_invoice_number text;
  v_invoice_date date;
  v_currency_code text;
  v_item jsonb;
  v_item_count integer;
  v_position integer := 0;
  v_name text;
  v_action text;
  v_product_id uuid;
  v_quantity numeric;
  v_unit_price numeric;
  v_line_total numeric;
  v_item_discount numeric;
  v_selling_price numeric;
  v_update_cost boolean;
  v_stock_updated boolean;
  v_stock bigint;
  v_stock_updated_count integer := 0;
  v_created_product_count integer := 0;
  v_product_action text;
  v_invoice_total numeric;
  v_invoice_subtotal numeric;
  v_invoice_discount numeric;
  v_invoice_tax numeric;
  v_invoice_shipping numeric;
  v_invoice_other numeric;
  v_expected_total numeric;
  v_line_subtotal numeric := 0;
  v_line_discounts numeric := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_invoice is null or pg_catalog.jsonb_typeof(p_invoice) <> 'object' then
    raise exception 'Invoice details are invalid';
  end if;
  if pg_catalog.jsonb_typeof(p_invoice -> 'items') is distinct from 'array' then
    raise exception 'Invoice items are invalid';
  end if;

  v_item_count := pg_catalog.jsonb_array_length(p_invoice -> 'items');
  if v_item_count < 1 or v_item_count > 100 then
    raise exception 'An invoice must contain between 1 and 100 items';
  end if;

  select profile.currency_code
    into v_business_currency
    from public.business_profiles as profile
    where profile.user_id = v_user_id
    for key share;
  if not found then
    raise exception 'Complete your business profile first';
  end if;

  if coalesce(p_invoice ->> 'invoiceDate', '') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Invoice date is invalid';
  end if;
  v_invoice_date := (p_invoice ->> 'invoiceDate')::date;
  v_invoice_number := nullif(pg_catalog.btrim(p_invoice ->> 'invoiceNumber'), '');
  if v_invoice_number is not null and pg_catalog.char_length(v_invoice_number) > 100 then
    raise exception 'Invoice number is too long';
  end if;
  v_currency_code := p_invoice ->> 'currencyCode';
  if v_currency_code not in ('KWD', 'SAR', 'AED', 'BHD', 'QAR', 'OMR', 'USD') then
    raise exception 'Invoice currency is not supported';
  end if;

  if coalesce(p_invoice ->> 'ocrEngine', '') not in ('0', '2', '3') then
    raise exception 'OCR engine is invalid';
  end if;

  if coalesce(p_invoice ->> 'subtotal', '') !~ '^\d{1,11}(\.\d{1,3})?$'
    or coalesce(p_invoice ->> 'discount', '0') !~ '^\d{1,11}(\.\d{1,3})?$'
    or coalesce(p_invoice ->> 'tax', '0') !~ '^\d{1,11}(\.\d{1,3})?$'
    or coalesce(p_invoice ->> 'shippingFee', '0') !~ '^\d{1,11}(\.\d{1,3})?$'
    or coalesce(p_invoice ->> 'otherCharges', '0') !~ '^\d{1,11}(\.\d{1,3})?$'
    or coalesce(p_invoice ->> 'total', '') !~ '^\d{1,11}(\.\d{1,3})?$' then
    raise exception 'Invoice amounts are invalid';
  end if;
  v_invoice_total := (p_invoice ->> 'total')::numeric;
  v_invoice_subtotal := (p_invoice ->> 'subtotal')::numeric;
  v_invoice_discount := coalesce(nullif(p_invoice ->> 'discount', ''), '0')::numeric;
  v_invoice_tax := coalesce(nullif(p_invoice ->> 'tax', ''), '0')::numeric;
  v_invoice_shipping := coalesce(nullif(p_invoice ->> 'shippingFee', ''), '0')::numeric;
  v_invoice_other := coalesce(nullif(p_invoice ->> 'otherCharges', ''), '0')::numeric;
  if v_invoice_total <= 0 then
    raise exception 'Invoice total must be greater than zero';
  end if;

  insert into public.purchase_invoices (
    user_id,
    invoice_number,
    supplier_name,
    supplier_phone,
    supplier_email,
    invoice_date,
    currency_code,
    subtotal,
    discount,
    tax,
    shipping_fee,
    other_charges,
    total,
    ocr_engine
  ) values (
    v_user_id,
    v_invoice_number,
    nullif(pg_catalog.btrim(p_invoice ->> 'supplierName'), ''),
    nullif(pg_catalog.btrim(p_invoice ->> 'supplierPhone'), ''),
    nullif(pg_catalog.btrim(p_invoice ->> 'supplierEmail'), ''),
    v_invoice_date,
    v_currency_code,
    (p_invoice ->> 'subtotal')::numeric,
    coalesce(nullif(p_invoice ->> 'discount', ''), '0')::numeric,
    coalesce(nullif(p_invoice ->> 'tax', ''), '0')::numeric,
    coalesce(nullif(p_invoice ->> 'shippingFee', ''), '0')::numeric,
    coalesce(nullif(p_invoice ->> 'otherCharges', ''), '0')::numeric,
    v_invoice_total,
    (p_invoice ->> 'ocrEngine')::smallint
  )
  returning id into v_invoice_id;

  for v_item in
    select value from pg_catalog.jsonb_array_elements(p_invoice -> 'items')
  loop
    v_position := v_position + 1;
    if pg_catalog.jsonb_typeof(v_item) <> 'object' then
      raise exception 'Invoice item is invalid';
    end if;
    v_name := pg_catalog.btrim(coalesce(v_item ->> 'productName', ''));
    if pg_catalog.char_length(v_name) < 1 or pg_catalog.char_length(v_name) > 160 then
      raise exception 'Product name is required';
    end if;
    if coalesce(v_item ->> 'quantity', '') !~ '^\d{1,11}(\.\d{1,3})?$'
      or coalesce(v_item ->> 'unitPurchasePrice', '') !~ '^\d{1,11}(\.\d{1,3})?$'
      or coalesce(v_item ->> 'lineTotal', '') !~ '^\d{1,11}(\.\d{1,3})?$'
      or coalesce(v_item ->> 'discount', '0') !~ '^\d{1,11}(\.\d{1,3})?$' then
      raise exception 'Product quantity or cost is invalid';
    end if;
    v_quantity := (v_item ->> 'quantity')::numeric;
    v_unit_price := (v_item ->> 'unitPurchasePrice')::numeric;
    v_line_total := (v_item ->> 'lineTotal')::numeric;
    v_item_discount := coalesce(nullif(v_item ->> 'discount', ''), '0')::numeric;
    if v_quantity <= 0 then
      raise exception 'Product quantity must be greater than zero';
    end if;
    if v_item_discount > v_line_total
      or pg_catalog.abs(v_line_total - (v_quantity * v_unit_price)) > 0.001 then
      raise exception 'Line total does not match quantity times unit purchase price';
    end if;
    v_line_subtotal := v_line_subtotal + v_line_total;
    v_line_discounts := v_line_discounts + v_item_discount;

    v_action := v_item ->> 'action';
    v_product_id := null;
    v_stock_updated := false;
    v_update_cost := coalesce((v_item ->> 'updateMaterialsCost')::boolean, false);

    if v_action = 'match' then
      if coalesce(v_item ->> 'productId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or v_quantity <> pg_catalog.trunc(v_quantity) then
        raise exception 'Choose an existing product and a whole-number quantity';
      end if;
      v_product_id := (v_item ->> 'productId')::uuid;
      select product.available_quantity
        into v_stock
        from public.business_products as product
        where product.id = v_product_id
          and product.user_id = v_user_id
          and product.currency_code = v_business_currency
        for update;
      if not found then
        raise exception 'Selected product was not found in your account';
      end if;
      v_stock := v_stock + v_quantity::bigint;
      if v_stock > 2147483647 then
        raise exception 'The selected product quantity exceeds the supported limit';
      end if;
      if v_update_cost and v_currency_code <> v_business_currency then
        raise exception 'Product cost cannot be updated when invoice currency differs from business currency';
      end if;
      update public.business_products
        set available_quantity = v_stock::integer,
            materials_cost = case when v_update_cost then v_unit_price else materials_cost end
        where id = v_product_id
          and user_id = v_user_id;
      v_stock_updated := true;
      v_stock_updated_count := v_stock_updated_count + 1;
      v_product_action := 'matched';
    elsif v_action = 'create' then
      if v_quantity <> pg_catalog.trunc(v_quantity)
        or coalesce(v_item ->> 'sellingPrice', '') !~ '^\d{1,11}(\.\d{1,3})?$' then
        raise exception 'A new product needs a whole-number quantity and a valid selling price';
      end if;
      v_selling_price := (v_item ->> 'sellingPrice')::numeric;
      if v_selling_price <= 0 then
        raise exception 'A new product selling price must be greater than zero';
      end if;

      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(v_user_id::text || ':' || pg_catalog.lower(v_name), 0)
      );
      if exists (
        select 1
          from public.business_products as product
          where product.user_id = v_user_id
            and pg_catalog.lower(pg_catalog.btrim(product.name)) = pg_catalog.lower(v_name)
      ) then
        raise exception 'A product with this name already exists. Match it instead of creating a duplicate';
      end if;

      insert into public.business_products (
        user_id,
        name,
        selling_price,
        materials_cost,
        packaging_cost,
        other_cost,
        currency_code,
        available_quantity,
        low_stock_threshold
      ) values (
        v_user_id,
        v_name,
        v_selling_price,
        case when v_currency_code = v_business_currency then v_unit_price else 0 end,
        0,
        0,
        v_business_currency,
        v_quantity::integer,
        5
      )
      returning id into v_product_id;
      v_stock_updated := true;
      v_stock_updated_count := v_stock_updated_count + 1;
      v_created_product_count := v_created_product_count + 1;
      v_product_action := 'created';
    elsif v_action = 'skip' then
      v_product_action := 'skipped';
    else
      raise exception 'Product action is invalid';
    end if;

    insert into public.purchase_invoice_items (
      invoice_id,
      user_id,
      product_id,
      position,
      product_name_snapshot,
      description_snapshot,
      sku_snapshot,
      quantity,
      unit_of_measurement,
      unit_purchase_price,
      line_total,
      discount,
      product_action,
      stock_updated
    ) values (
      v_invoice_id,
      v_user_id,
      v_product_id,
      v_position,
      v_name,
      nullif(pg_catalog.btrim(v_item ->> 'description'), ''),
      nullif(pg_catalog.btrim(v_item ->> 'sku'), ''),
      v_quantity,
      nullif(pg_catalog.btrim(v_item ->> 'unitOfMeasure'), ''),
      v_unit_price,
      v_line_total,
      v_item_discount,
      v_product_action,
      v_stock_updated
    );
  end loop;

  if pg_catalog.abs(v_invoice_subtotal - v_line_subtotal) > 0.001 then
    raise exception 'Invoice subtotal does not match the item totals';
  end if;
  if v_invoice_discount > v_invoice_subtotal then
    raise exception 'Invoice discount cannot exceed the subtotal';
  end if;
  v_expected_total :=
    v_line_subtotal
    - v_invoice_discount
    - v_line_discounts
    + v_invoice_tax
    + v_invoice_shipping
    + v_invoice_other;
  if v_expected_total < 0 or pg_catalog.abs(v_invoice_total - v_expected_total) > 0.001 then
    raise exception 'Invoice total does not match the confirmed amounts';
  end if;

  return pg_catalog.jsonb_build_object(
    'invoiceId', v_invoice_id,
    'invoiceNumber', v_invoice_number,
    'itemsCount', v_item_count,
    'stockUpdatedCount', v_stock_updated_count,
    'createdProductCount', v_created_product_count
  );
end;
$$;

revoke all on function public.save_purchase_invoice(jsonb) from public, anon;
grant execute on function public.save_purchase_invoice(jsonb) to authenticated;
