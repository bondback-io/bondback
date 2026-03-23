"use client";

import { useTransition, useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { savePayoutSchedule, type PreferredPayoutSchedule } from "@/app/settings/actions";

export type PayoutScheduleFormProps = {
  initial: PreferredPayoutSchedule;
};

export function PayoutScheduleForm({ initial }: PayoutScheduleFormProps) {
  const [value, setValue] = useState<PreferredPayoutSchedule>(initial);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  const handleChange = (val: string) => {
    const preferred = val as PreferredPayoutSchedule;
    setValue(preferred);
    startTransition(async () => {
      const result = await savePayoutSchedule(preferred);
      if (result.ok) {
        toast({
          title: "Payout schedule updated",
          description: "Your preference has been saved and applied to your connected account if applicable.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Could not save",
          description: result.error,
        });
      }
    });
  };

  return (
    <div className="space-y-2">
      <Label className="text-base font-medium text-muted-foreground dark:text-gray-300 md:text-sm">
        My payout schedule
      </Label>
      <p className="text-base text-muted-foreground dark:text-gray-400 md:text-[11px]">
        How often you receive payouts from completed jobs. &quot;Follow Platform Default&quot; uses the platform default (see admin settings).
      </p>
      <Select
        value={value}
        onValueChange={handleChange}
        disabled={isPending}
      >
        <SelectTrigger className="w-full max-w-full md:max-w-[220px] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="platform_default">Follow Platform Default</SelectItem>
          <SelectItem value="daily">Daily</SelectItem>
          <SelectItem value="weekly">Weekly</SelectItem>
          <SelectItem value="monthly">Monthly</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
