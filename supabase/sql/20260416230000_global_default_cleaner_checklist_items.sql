-- Admin-editable default checklist items for new job checklists.
alter table if exists public.global_settings
  add column if not exists default_cleaner_checklist_items text[] not null default array[
    'Vacuum Apartment/House',
    'Clean all Bedrooms',
    'Clean all Bathrooms',
    'Clean Toilet',
    'Clean Kitchen',
    'Clean Laundry',
    'Mop Floors (if needed)'
  ];

update public.global_settings
set default_cleaner_checklist_items = coalesce(
  default_cleaner_checklist_items,
  array[
    'Vacuum Apartment/House',
    'Clean all Bedrooms',
    'Clean all Bathrooms',
    'Clean Toilet',
    'Clean Kitchen',
    'Clean Laundry',
    'Mop Floors (if needed)'
  ]
)
where id = 1;
