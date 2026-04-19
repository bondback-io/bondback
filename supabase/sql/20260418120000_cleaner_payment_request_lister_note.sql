-- Optional note from lister when denying a cleaner additional payment request.
alter table public.cleaner_additional_payment_requests
  add column if not exists lister_response_note text;

comment on column public.cleaner_additional_payment_requests.lister_response_note is
  'Lister explanation when denying an additional payment request (optional).';
