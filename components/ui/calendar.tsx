import * as React from "react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export const Calendar = ({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) => {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-2", className)}
      classNames={{
        months: "flex flex-col space-y-2",
        month: "space-y-2",
        caption:
          "flex justify-center pt-1 relative items-center text-sm font-medium",
        caption_label: "capitalize",
        nav: "space-x-1 flex items-center",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.7rem]",
        row: "flex w-full mt-1",
        cell:
          "relative h-8 w-8 text-center text-xs p-0 focus-within:relative focus-within:z-20",
        day: cn(
          "h-8 w-8 p-0 font-normal aria-selected:opacity-100",
          "hover:bg-muted rounded-md"
        ),
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
        day_today:
          "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground",
        day_outside: "text-muted-foreground/60 opacity-60",
        day_disabled: "opacity-40 cursor-not-allowed",
        ...classNames
      }}
      {...props}
    />
  );
};

Calendar.displayName = "Calendar";

