# Max travel radius (Cleaner profile)

Cleaners can set how far they’re willing to travel for jobs on the profile edit page (`/profile`). The value is stored in `profiles.max_travel_km` and used for “new job near you” SMS and job matching.

## Summary of changes

- **Where:** `/profile` — cleaner profile edit form (only when `active_role === 'cleaner'` or `roles` includes `'cleaner'`).
- **UI:** Max travel distance section with:
  - **Slider (shadcn/ui):** 5–100 km, step 5, default 30 km. Labels: 5 km, 30 km, 50 km, 100 km.
  - **Live value:** e.g. “Max travel distance: 35 km” (or in miles when unit is miles).
  - **Unit toggle:** km / miles (display only; value is always stored in km).
  - **Preview:** “Jobs within 35 km will be shown.”
  - **Note:** “This will be used for ‘Jobs near you’ alerts and filtering.”
  - **Help tooltip:** “Set how far you're willing to travel for jobs. Helps us show you relevant listings.”
  - **Button:** “Update radius” with loading state; calls `updateMaxTravelKm(userId, km)` and shows toast: “Travel radius updated to [X] km.”
- **Persistence:** `profiles.max_travel_km` (integer, default 30). Full profile “Save profile” still sends `max_travel_km` via `updateProfile`; “Update radius” uses `updateMaxTravelKm` for just this field.
- **Mobile:** Full-width slider and large touch target.

## Slider JSX example

```tsx
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

{/* Only when roles.includes("cleaner") */}
<div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
  <div className="flex items-center justify-between gap-2">
    <div className="flex items-center gap-1.5">
      <Label htmlFor="max_travel_km">Max travel distance</Label>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[240px] text-xs">
            Set how far you're willing to travel for jobs. Helps us show you relevant listings.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
    {/* Unit toggle: km | miles (display only) */}
  </div>
  <Slider
    id="max_travel_km"
    min={5}
    max={100}
    step={5}
    value={[maxTravelKm]}
    onValueChange={([v]) => setMaxTravelKm(v ?? 30)}
    className="touch-none"
    aria-label="Max travel distance in km"
  />
  <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
    <span>5 km</span>
    <span>30 km</span>
    <span>50 km</span>
    <span>100 km</span>
  </div>
  <p className="text-sm font-medium">
    Max travel distance: {displayValue} {/* e.g. "35 km" or "21.7 miles" */}
  </p>
  <p className="text-xs text-muted-foreground">
    Jobs within {maxTravelKm} km will be shown.
  </p>
  <p className="text-[11px] text-muted-foreground/90">
    This will be used for "Jobs near you" alerts and filtering.
  </p>
  <Button
    type="button"
    variant="secondary"
    size="sm"
    disabled={savingTravelRadius}
    onClick={async () => {
      setSavingTravelRadius(true);
      const result = await updateMaxTravelKm(userId, maxTravelKm);
      if (result.ok) {
        toast({ title: "Travel radius updated", description: `Travel radius updated to ${maxTravelKm} km` });
      }
      setSavingTravelRadius(false);
    }}
  >
    {savingTravelRadius ? "Saving…" : "Update radius"}
  </Button>
</div>
```

## Server action

```ts
// lib/actions/profile.ts

export type UpdateMaxTravelKmResult = { ok: true } | { ok: false; error: string };

const MAX_TRAVEL_KM_MIN = 5;
const MAX_TRAVEL_KM_MAX = 100;

/**
 * Update the current user's max travel radius (cleaner profile). Stored as integer km.
 */
export async function updateMaxTravelKm(
  userId: string,
  km: number
): Promise<UpdateMaxTravelKmResult> {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || session.user.id !== userId) {
    return { ok: false, error: "You must be logged in." };
  }
  const clamped = Math.round(Math.max(MAX_TRAVEL_KM_MIN, Math.min(MAX_TRAVEL_KM_MAX, km)));
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "Server error." };
  const { error } = await admin
    .from("profiles")
    .update({ max_travel_km: clamped, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  return { ok: true };
}
```

## Profiles table column

- **Column:** `profiles.max_travel_km`
- **Type:** `integer`
- **Default:** `30` (set in migration `20250612000000_profiles_max_travel_km_default.sql` if the column is added there).
- **Validation in app:** 5–100 (step 5 in the slider). Server action clamps to this range.

Migration snippet:

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS max_travel_km integer DEFAULT 30;

COMMENT ON COLUMN public.profiles.max_travel_km IS 'Max travel radius in km for cleaners (5–100). Used for job matching and "new job near you" SMS.';
```

## Files touched

| File | Change |
|------|--------|
| `lib/actions/profile.ts` | Added `updateMaxTravelKm(userId, km)`. |
| `components/features/profile-form.tsx` | Travel radius section: Slider 5–100 km, unit toggle (km/miles), tooltip, preview text, future note, “Update radius” button and toast. Section only when `roles.includes("cleaner")`. |
| `supabase/migrations/20250612000000_profiles_max_travel_km_default.sql` | Ensure `max_travel_km` exists with default 30. |
| `docs/TRAVEL_RADIUS_PROFILE.md` | This doc. |
