-- Prepaid checkout uses uppercase UUID fragments, which can include 0 and 1.
-- Keep the same human-readable LM-YY-MM-XXXXXX shape and align the database
-- constraint with the API schema.

alter table commerce.orders
  drop constraint if exists orders_order_number_format_check;

alter table commerce.orders
  add constraint orders_order_number_format_check
  check (order_number ~ '^LM-[0-9]{2}-[0-9]{2}-[A-Z0-9]{6}$');
