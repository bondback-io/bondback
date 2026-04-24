-- Hybrid service add-ons: priced line items (quote) + free cleaner checklist labels (guidance only).
-- Bond cleaning continues to use pricing_addon_* columns and default_cleaner_checklist_items.

ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS service_addons_checklists jsonb DEFAULT NULL;

COMMENT ON COLUMN public.global_settings.service_addons_checklists IS
  'JSON: { "v": 1, "byService": { "airbnb_turnover"|"recurring_house_cleaning"|"deep_clean": { "priced": [{ "id", "name", "price_aud" }], "free": ["..."] } } }. Bond uses legacy columns.';
