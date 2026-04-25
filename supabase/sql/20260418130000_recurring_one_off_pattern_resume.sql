-- When a lister reschedules a visit "this occurrence only" (not a permanent weekday change),
-- we store the pre-move scheduled date. After the job completes, the next occurrence uses this
-- anchor for `nextRecurringDate` so the long-term cadence (e.g. every Tuesday) is preserved.
ALTER TABLE public.recurring_occurrences
  ADD COLUMN IF NOT EXISTS one_off_pattern_resume_from date;

COMMENT ON COLUMN public.recurring_occurrences.one_off_pattern_resume_from IS
  'Set when a visit was moved for one-off rescheduling; used when rolling to the next occurrence so the original cadence (weekday) is kept.';
