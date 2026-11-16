alter table public.business_product_stock_reservations
  drop constraint business_product_stock_reservations_order_item_id_fkey,
  drop constraint business_product_stock_reservations_order_id_fkey;

alter table public.business_product_stock_reservations
  add constraint business_product_stock_reservations_order_item_id_fkey
    foreign key (order_item_id)
    references public.order_items (id)
    deferrable initially deferred,
  add constraint business_product_stock_reservations_order_id_fkey
    foreign key (order_id)
    references public.orders (id)
    deferrable initially deferred;
