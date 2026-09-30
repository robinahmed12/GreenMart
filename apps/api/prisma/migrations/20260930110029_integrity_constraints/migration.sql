-- Integrity constraints that the Prisma schema cannot express.
-- Application validation is a convenience; these are the guarantee.

ALTER TABLE "products"
  ADD CONSTRAINT "products_price_positive" CHECK ("price" > 0);

ALTER TABLE "products"
  ADD CONSTRAINT "products_selling_kind_supported"
  CHECK ("selling_kind" IN ('weight', 'count', 'bunch', 'pack'));

ALTER TABLE "products"
  ADD CONSTRAINT "products_stock_status_supported"
  CHECK ("stock_status" IN ('in_stock', 'low_stock', 'out_of_stock'));

ALTER TABLE "products"
  ADD CONSTRAINT "products_selling_label_not_blank"
  CHECK (length(btrim("selling_label")) > 0);

ALTER TABLE "products"
  ADD CONSTRAINT "products_name_not_blank"
  CHECK (length(btrim("name")) > 0);

ALTER TABLE "products"
  ADD CONSTRAINT "products_description_not_blank"
  CHECK (length(btrim("description")) > 0);

ALTER TABLE "categories"
  ADD CONSTRAINT "categories_sort_order_positive" CHECK ("sort_order" > 0);

ALTER TABLE "categories"
  ADD CONSTRAINT "categories_slug_not_blank"
  CHECK (length(btrim("slug")) > 0);