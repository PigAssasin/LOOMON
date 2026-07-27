-- Demo policy: every listed LOOMON product can be ordered from 1 piece.
-- This keeps the Arc checkout easy to test and prevents UI quantity from
-- diverging from Supabase quote validation.

update catalog.product_versions
set
  minimum_order_quantity = 1,
  updated_at = now()
where minimum_order_quantity <> 1;

update catalog.price_rules
set
  minimum_quantity = 1
where minimum_quantity <> 1;
