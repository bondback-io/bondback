# Job completion: before/after photo upload requirement

When a job is won (auction ends, lowest bid ≤ reserve), the **cleaner** must complete the work and then upload **before and after photos** to mark the job as complete and release payment (escrow flow).

## Requirement

- **Before photos**: at least one photo of each area/room before cleaning (or a single overview acceptable per listing type).
- **After photos**: at least one photo of each area/room after cleaning, matching the before set where possible.
- Uploads go to Supabase Storage (e.g. bucket `job-completion-photos/{listingId}/{cleanerId}/before|after/`).
- A **job_completions** table (or similar) can store:
  - `listing_id`, `cleaner_id`, `status` (`pending_photos` | `photos_uploaded` | `approved`),
  - `before_photo_urls`, `after_photo_urls` (arrays),
  - `submitted_at`, `approved_at`.

## Flow (stub)

1. Auction ends → winner set → notify cleaner (see `lib/notifications.ts`).
2. Cleaner completes work and uploads before/after photos via a completion form (e.g. `/jobs/[id]/complete`).
3. Lister can review photos and confirm; or auto-approve after X days.
4. On approval → release escrow (Stripe PaymentIntent capture or Connect transfer) to cleaner; platform fee (12%) retained.

## Schema stub (SQL when implementing)

```sql
-- Optional: job_completions table
create table if not exists public.job_completions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id),
  cleaner_id uuid not null references auth.users (id),
  status text not null default 'pending_photos', -- pending_photos | photos_uploaded | approved
  before_photo_urls text[] not null default '{}',
  after_photo_urls text[] not null default '{}',
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
```

Until this is implemented, the app does not enforce photo upload; the stub is for future use.
