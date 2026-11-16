create index if not exists business_product_stock_reservations_product_idx
  on public.business_product_stock_reservations (product_id);

create index if not exists business_product_stock_reservations_user_idx
  on public.business_product_stock_reservations (user_id);
