-- ==============================================================================
-- BIZORA DATABASE MIGRATION - UPDATE PAYMENT METHODS CHECK CONSTRAINT
-- Adds support for 'Card' and 'PayPal' alongside 'Bank transfer', 'Credit card', 'Cash', 'Other'
-- ==============================================================================

alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check
  check (method in ('Bank transfer', 'Card', 'Credit card', 'Cash', 'PayPal', 'Other'));
