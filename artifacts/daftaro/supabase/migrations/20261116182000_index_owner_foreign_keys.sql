-- Keep owner foreign-key checks efficient when a user account is removed.
create index if not exists order_items_user_id_idx
  on public.order_items (user_id);

create index if not exists invoices_user_id_idx
  on public.invoices (user_id);
