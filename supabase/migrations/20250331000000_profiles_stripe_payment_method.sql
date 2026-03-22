-- Lister payment: saved card for Pay & Start Job (Setup Intent flow)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON public.profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

COMMENT ON COLUMN public.profiles.stripe_payment_method_id IS 'Stripe PaymentMethod ID (pm_...) for lister; saved after Setup Intent Checkout.';
COMMENT ON COLUMN public.profiles.stripe_customer_id IS 'Stripe Customer ID (cus_...) for lister; created by Checkout when connecting payment method.';
