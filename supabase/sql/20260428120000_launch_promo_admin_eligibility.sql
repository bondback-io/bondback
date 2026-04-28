-- Launch promo: admin-configurable fee-free service types + marketing copy numbers (dashboard / tooltips).

ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS launch_promo_zero_fee_service_types text[] NOT NULL DEFAULT ARRAY['airbnb_turnover', 'recurring_house_cleaning']::text[],
  ADD COLUMN IF NOT EXISTS launch_promo_marketing_price_cap_aud integer NOT NULL DEFAULT 350
    CONSTRAINT launch_promo_marketing_price_cap_aud_check CHECK (
      launch_promo_marketing_price_cap_aud >= 0 AND launch_promo_marketing_price_cap_aud <= 999999
    ),
  ADD COLUMN IF NOT EXISTS launch_promo_marketing_monthly_airbnb_recurring_cap smallint NOT NULL DEFAULT 2
    CONSTRAINT launch_promo_marketing_monthly_cap_check CHECK (
      launch_promo_marketing_monthly_airbnb_recurring_cap >= 0
      AND launch_promo_marketing_monthly_airbnb_recurring_cap <= 100
    );

COMMENT ON COLUMN public.global_settings.launch_promo_zero_fee_service_types IS
  'listings.service_type values that may use 0% platform fee during launch promo (subset of app service types).';
COMMENT ON COLUMN public.global_settings.launch_promo_marketing_price_cap_aud IS
  'Marketing/tooltip: AUD starting-price ceiling copy for planned Airbnb+recurring monthly tier (not enforced in DB yet).';
COMMENT ON COLUMN public.global_settings.launch_promo_marketing_monthly_airbnb_recurring_cap IS
  'Marketing/tooltip: per-calendar-month job count copy for planned Airbnb+recurring tier (not enforced in DB yet).';
