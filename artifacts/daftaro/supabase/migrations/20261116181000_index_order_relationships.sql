drop index public.order_items_order_idx;
create index order_items_order_idx
  on public.order_items (order_id, user_id, position);
create index order_items_product_id_idx
  on public.order_items (product_id);

create index orders_customer_owner_fk_idx
  on public.orders (customer_id, user_id);

drop index public.invoices_user_order_idx;
create index invoices_order_owner_idx
  on public.invoices (order_id, user_id);
