"use client";

import { useEffect, useRef, useState } from "react";
import { cn, parseUtcTimestamp } from "@/lib/utils";

const DEFAULT_URGENT_CLASS =
  "text-red-600 font-semibold dark:text-red-400";
const DEFAULT_SAFE_CLASS =
  "text-emerald-600 font-semibold dark:text-emerald-400";

export type CountdownTimerProps = {
  endTime: string; // ISO string
  className?: string;
  expiredLabel?: string;
  /**
   * When true (default), applies red when time left &lt; threshold and green when ≥ threshold.
   * Set false to rely only on `className` and explicit urgent/warning/safe props.
   */
  colorByTimeRemaining?: boolean;
  /** Hours remaining below this → urgent (red). Default 24. */
  urgentBelowHours?: number;
  urgentClassName?: string;
  /** Hours remaining below this (and ≥ urgent threshold) → warning (e.g. amber). */
  warningBelowHours?: number;
  warningClassName?: string;
  /** Hours remaining at or above warning threshold (when warning tier is used) or ≥ urgent threshold otherwise → green. */
  safeClassName?: string;
  /** Called once when the countdown first reaches zero (e.g. to resolve the auction server-side). */
  onExpired?: () => void;
};

/**
 * Client-side countdown until endTime. Shows "Ended" when past.
 * By default: &lt; 24h left = red, ≥ 24h = green (while still running).
 */
export function CountdownTimer({
  endTime,
  className,
  expiredLabel = "Ended",
  colorByTimeRemaining = true,
  urgentBelowHours,
  urgentClassName,
  warningBelowHours,
  warningClassName,
  safeClassName,
  onExpired,
}: CountdownTimerProps) {
  const expiredOnceRef = useRef(false);
  const [text, setText] = useState<string>("");
  const [isExpired, setIsExpired] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const [isWarning, setIsWarning] = useState(false);
  const [isSafe, setIsSafe] = useState(false);

  useEffect(() => {
    expiredOnceRef.current = false;
  }, [endTime]);

  useEffect(() => {
    const end = parseUtcTimestamp(endTime);
    const uTh = urgentBelowHours ?? 24;
    const hasWarning =
      warningBelowHours != null &&
      warningClassName &&
      warningBelowHours > uTh;

    const update = () => {
      const now = Date.now();
      if (now >= end) {
        setText(expiredLabel);
        setIsExpired(true);
        setIsUrgent(false);
        setIsWarning(false);
        setIsSafe(false);
        if (onExpired && !expiredOnceRef.current) {
          expiredOnceRef.current = true;
          onExpired();
        }
        return;
      }
      setIsExpired(false);
      const d = end - now;
      const hoursLeft = d / (60 * 60 * 1000);

      if (hasWarning) {
        setIsUrgent(hoursLeft < uTh);
        setIsWarning(hoursLeft >= uTh && hoursLeft < warningBelowHours!);
        setIsSafe(hoursLeft >= warningBelowHours!);
      } else {
        setIsUrgent(hoursLeft < uTh);
        setIsWarning(false);
        setIsSafe(hoursLeft >= uTh);
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
  }, [
    endTime,
    expiredLabel,
    urgentBelowHours,
    warningBelowHours,
    warningClassName,
    onExpired,
  ]);

  const urgentStyle =
    urgentClassName ?? (colorByTimeRemaining ? DEFAULT_URGENT_CLASS : undefined);
  const safeStyle =
    safeClassName ??
    (colorByTimeRemaining || urgentClassName != null
      ? DEFAULT_SAFE_CLASS
      : undefined);

  return (
    <span
      className={cn(
        "tabular-nums",
        className,
        !isExpired &&
          isUrgent &&
          !isWarning &&
          urgentStyle,
        !isExpired && isWarning && warningClassName,
        !isExpired && isSafe && !isWarning && safeStyle
      )}
    >
      {text || "—"}
    </span>
  );
}
