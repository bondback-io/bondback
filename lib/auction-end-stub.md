# Supabase: Realtime + `bids` table

## Realtime

Enable Supabase Realtime for tables used by the app:

1. In Supabase Dashboard → Database → Replication, add **`listings`** and **`bids`** to the publication (e.g. `supabase_realtime`).
2. Or run: `alter publication supabase_realtime add table listings, bids;`

The app subscribes to:
- `listings` (for `/jobs` and `/my-listings` and `/jobs/[id]`) for live updates to status and `current_lowest_bid_cents`.
- `bids` (for `/jobs/[id]`) for new bid rows.

## `bids` table (if not yet created)

```sql
create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  cleaner_id uuid not null references auth.users (id) on delete cascade,
  amount_cents integer not null,
  created_at timestamptz not null default now()
);

alter table public.bids enable row level security;

create policy "Cleaners can insert own bid"
  on public.bids for insert with check (auth.uid() = cleaner_id);

create policy "Anyone can read bids for listings"
  on public.bids for select using (true);

-- Optional: listers can read bids on their listings (if you restrict select above)
-- create policy "Lister can see bids on their listings"
--   on public.bids for select using (
--     exists (select 1 from public.listings l where l.id = bids.listing_id and l.lister_id = auth.uid())
--   );
```

---

# Auction end – stub for later cron/scheduled job

When a listing's `end_time` has passed, the auction should be closed:

1. Set `listings.status` to `'ended'`.
2. Optionally set a `winner_id` or store the winning bid (lowest bidder if lowest bid ≤ reserve).
3. Later: Stripe escrow/payout flow.

**Implementation options:**

- **Supabase Edge Function** on a schedule (e.g. every minute): select `listings` where `status = 'live'` and `end_time < now()`, then update to `'ended'` and derive winner from `bids` (lowest `amount_cents` for that listing, if ≤ `reserve_cents`).
- **External cron** (e.g. Vercel Cron, GitHub Actions): call an API route or server action that performs the same logic.
- **Database trigger**: on insert/update of `bids`, or a pg_cron job inside Supabase, to close expired listings.

Until then, the UI shows "Ended" via the countdown and server action `placeBid` rejects bids when `end_time` has passed.
