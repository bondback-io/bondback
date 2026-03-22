"use client";

import { useEffect, useState } from "react";
import { cn, parseUtcTimestamp } from "@/lib/utils";

export type CountdownTimerProps = {
  endTime: string; // ISO string
  className?: string;
  expiredLabel?: string;
  /** When time left is below this many hours, apply urgentClassName (e.g. red). */
  urgentBelowHours?: number;
  urgentClassName?: string;
  /** When time left is below this many hours (and above urgent), apply warningClassName (e.g. orange). */
  warningBelowHours?: number;
  warningClassName?: string;
};

/**
 * Client-side countdown until endTime. Shows "Ended" when past.
 */
export function CountdownTimer({
  endTime,
  className,
  expiredLabel = "Ended",
  urgentBelowHours,
  urgentClassName,
  warningBelowHours,
  warningClassName,
}: CountdownTimerProps) {
  const [text, setText] = useState<string>("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [isWarning, setIsWarning] = useState(false);

  useEffect(() => {
    const end = parseUtcTimestamp(endTime);

    const update = () => {
      const now = Date.now();
      if (now >= end) {
        setText(expiredLabel);
        setIsUrgent(false);
        setIsWarning(false);
        return;
      }
      const d = end - now;
      const hoursLeft = d / (60 * 60 * 1000);
      if (urgentBelowHours != null && urgentClassName) {
        setIsUrgent(hoursLeft < urgentBelowHours);
      }
      if (warningBelowHours != null && warningClassName) {
        const urgentThreshold = urgentBelowHours ?? 0;
        setIsWarning(hoursLeft >= urgentThreshold && hoursLeft < warningBelowHours);
      } else {
        setIsWarning(false);
      }
      const days = Math.floor(d / (24 * 60 * 60 * 1000));
      const h = Math.floor((d % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const m = Math.floor((d % (60 * 60 * 1000)) / (60 * 1000));
      const s = Math.floor((d % (60 * 1000)) / 1000);
      if (days > 0) {
        setText(`${days}d ${h}h ${m}m ${s}s`);
      } else if (h > 0) {
        setText(`${h}h ${m}m ${s}s`);
      } else {
        setText(`${m}m ${s}s`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endTime, expiredLabel, urgentBelowHours, urgentClassName, warningBelowHours, warningClassName]);

  return (
    <span
      className={cn(
        "tabular-nums",
        className,
        isUrgent && urgentClassName,
        isWarning && !isUrgent && warningClassName
      )}
    >
      {text || "—"}
    </span>
  );
}
