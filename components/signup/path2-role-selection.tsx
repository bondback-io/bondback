"use client";

import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Brush, House, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { MAX_TRAVEL_KM } from "@/lib/max-travel-km";
import { Alert, AlertDescription } from "@/components/ui/alert";

const listerBullets = [
  "Post bond cleans and compare bids in one place",
  "Hire cleaners you trust for end-of-lease work",
] as const;

const cleanerBullets = [
  "Find nearby jobs with transparent bidding",
  "Get paid for quality work and build repeat clients",
] as const;

const listerWhyParagraphs = [
  "Post end-of-lease bond cleans and receive competitive bids from cleaners in your area.",
  "Compare offers side by side before you hire — no guesswork.",
  "Keep listings, access, and payments organized so managing your property stays simple.",
  "Move faster toward getting your bond back with clear quotes and timelines.",
] as const;

const cleanerWhyParagraphs = [
  "See bond-clean jobs near you and pick work that fits your schedule and radius.",
  "Place transparent bids and win jobs that match your skills and rates.",
  "Earn money for quality work and grow your income as you complete more jobs.",
  "Build reviews and a reputation that brings repeat clients and steadier work.",
] as const;

/** Subtle motion — max ~320ms; disabled when `prefers-reduced-motion`. */
const EASE = [0.25, 0.1, 0.25, 1] as const;

export type Path2RoleSelectionProps = {
  role: "lister" | "cleaner" | undefined;
  /** One tap: set Lister and submit the sign-up (no extra fields). */
  onStartAsLister: () => void;
  /** Set Cleaner and reveal ABN + travel fields; user completes via Create account. */
  onChooseCleaner: () => void;
  maxTravelKm: number;
  onMaxTravelChange: (n: number) => void;
  abnInputProps: ComponentProps<typeof Input>;
  abnError?: string;
  /** Server-side ABN / profile error (e.g. ABR lookup failed) — shown under the ABN field */
  abnServerError?: string | null;
  roleError?: string;
  submitting: boolean;
  /** Optional; omitted on single-page sign-up. */
  backButton?: ReactNode | null;
};

/**
 * Combined sign-up — role block. Large touch targets, “Why choose this role?” accordions.
 * Parent `<form>` wraps this; Lister uses `type="button"`; Cleaner confirms with `type="submit"`.
 */
export function Path2RoleSelection({
  role,
  onStartAsLister,
  onChooseCleaner,
  maxTravelKm,
  onMaxTravelChange,
  abnInputProps,
  abnError,
  abnServerError,
  roleError,
  submitting,
  backButton,
}: Path2RoleSelectionProps) {
  const reduceMotion = useReducedMotion();
  const listerActive = role === "lister";
  const cleanerActive = role === "cleaner";

  const t = reduceMotion ? 0 : 0.32;
  const tFast = reduceMotion ? 0 : 0.28;
  const cardHover = reduceMotion ? undefined : { y: -4, scale: 1.01, transition: { duration: 0.26, ease: EASE } };
  const cardTap = reduceMotion ? undefined : { scale: 0.985, y: 0, transition: { duration: 0.22, ease: EASE } };
  const btnTap = reduceMotion ? undefined : { scale: 0.98, transition: { duration: 0.2, ease: EASE } };

  return (
    <div className="space-y-7 sm:space-y-8">
      {backButton}

      <div className="space-y-2 text-center sm:text-left">
        <h2 className="text-balance text-[1.35rem] font-semibold leading-tight tracking-tight text-foreground sm:text-2xl md:text-[1.65rem]">
          How would you like to use Bond Back?
        </h2>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          Choose one to get started — both stay available later.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-7">
        <motion.div
          layout={!reduceMotion}
          whileHover={cardHover}
          whileTap={cardTap}
          animate={
            reduceMotion
              ? {}
              : listerActive
                ? {
                    boxShadow:
                      "0 14px 44px -18px rgba(14, 165, 233, 0.4), 0 0 0 1px rgba(14, 165, 233, 0.12)",
                  }
                : {
                    boxShadow: "0 6px 28px -16px rgba(0, 0, 0, 0.12)",
                  }
          }
          transition={{ duration: t, ease: EASE }}
          className={cn(
            "flex min-h-[min(28rem,70vh)] flex-col rounded-3xl border-2 bg-card/90 p-6 shadow-md backdrop-blur-sm sm:min-h-0 sm:p-7",
            "dark:bg-gradient-to-b dark:from-gray-900/95 dark:to-gray-950/90 dark:shadow-none",
            "ring-1 ring-black/[0.05] dark:ring-white/[0.08]",
            listerActive
              ? "border-sky-500 shadow-lg ring-sky-500/25 dark:border-sky-500/75 dark:ring-sky-500/20"
              : "border-border/80 hover:border-sky-500/40 dark:border-gray-800"
          )}
        >
          <div className="mb-5 flex flex-col items-center gap-4 text-center sm:items-start sm:text-left">
            <motion.div
              className={cn(
                "relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-3xl sm:h-20 sm:w-20",
                "bg-gradient-to-br from-sky-100 to-sky-50 dark:from-sky-950/90 dark:to-sky-900/40"
              )}
              aria-hidden
              animate={
                reduceMotion
                  ? { scale: 1 }
                  : listerActive
                    ? {
                        scale: [1, 1.08, 1.03],
                        boxShadow: [
                          "0 4px 20px -8px rgba(14, 165, 233, 0.25)",
                          "0 0 28px -4px rgba(56, 189, 248, 0.55)",
                          "0 8px 28px -10px rgba(14, 165, 233, 0.4)",
                        ],
                      }
                    : { scale: 1, boxShadow: "0 4px 20px -8px rgba(14, 165, 233, 0.15)" }
              }
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : listerActive
                    ? { duration: 0.38, times: [0, 0.45, 1], ease: EASE }
                    : { duration: tFast, ease: EASE }
              }
            >
              <House className="h-11 w-11 text-sky-600 dark:text-sky-300 sm:h-12 sm:w-12" strokeWidth={1.75} />
            </motion.div>
            <div className="min-w-0 space-y-1.5">
              <h3 className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.65rem]">Lister</h3>
              <p className="text-[0.9375rem] leading-relaxed text-muted-foreground sm:text-base">
                I want to list bond cleans and hire cleaners.
              </p>
            </div>
          </div>

          <ul className="mb-5 space-y-3 text-[0.9375rem] leading-snug text-muted-foreground sm:text-base">
            {listerBullets.map((line) => (
              <li key={line} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>

          <div
            className="mb-5 rounded-2xl border border-sky-500/15 bg-sky-500/[0.06] dark:border-sky-500/20 dark:bg-sky-950/30"
            onClick={(e) => e.stopPropagation()}
          >
            <Accordion type="single" collapsible className="w-full px-1">
              <AccordionItem value="why-lister" className="border-0">
                <AccordionTrigger className="min-h-[3.25rem] rounded-xl px-3 py-3 text-sm font-semibold text-sky-900 hover:no-underline dark:text-sky-100 sm:px-4 sm:text-base">
                  Why choose this role?
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-4 pt-0 text-[0.875rem] leading-relaxed text-muted-foreground sm:px-4 sm:text-sm">
                  <div className="space-y-3 border-t border-sky-500/10 pt-3 dark:border-sky-500/15">
                    {listerWhyParagraphs.map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <div className="mt-auto flex flex-col gap-3">
            <motion.div whileTap={btnTap} className="w-full">
              <Button
                type="button"
                size="lg"
                disabled={submitting}
                onClick={() => {
                  onStartAsLister();
                }}
                className={cn(
                  "inline-flex min-h-14 w-full touch-manipulation items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold shadow-md",
                  "bg-sky-600 text-white hover:bg-sky-600/90 active:bg-sky-700 dark:bg-sky-600 dark:hover:bg-sky-500"
                )}
              >
                {submitting && listerActive ? (
                  <>
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                    Creating account…
                  </>
                ) : (
                  "Start as Lister"
                )}
              </Button>
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          layout={!reduceMotion}
          whileHover={cardHover}
          whileTap={cardTap}
          animate={
            reduceMotion
              ? {}
              : cleanerActive
                ? {
                    boxShadow:
                      "0 14px 44px -18px rgba(16, 185, 129, 0.38), 0 0 0 1px rgba(16, 185, 129, 0.12)",
                  }
                : {
                    boxShadow: "0 6px 28px -16px rgba(0, 0, 0, 0.12)",
                  }
          }
          transition={{ duration: t, ease: EASE }}
          className={cn(
            "flex min-h-[min(28rem,70vh)] flex-col rounded-3xl border-2 bg-card/90 p-6 shadow-md backdrop-blur-sm sm:min-h-0 sm:p-7",
            "dark:bg-gradient-to-b dark:from-gray-900/95 dark:to-gray-950/90 dark:shadow-none",
            "ring-1 ring-black/[0.05] dark:ring-white/[0.08]",
            cleanerActive
              ? "border-emerald-500 shadow-lg ring-emerald-500/25 dark:border-emerald-500/75 dark:ring-emerald-500/20"
              : "border-border/80 hover:border-emerald-500/40 dark:border-gray-800"
          )}
        >
          <div className="mb-5 flex flex-col items-center gap-4 text-center sm:items-start sm:text-left">
            <motion.div
              className={cn(
                "relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-3xl sm:h-20 sm:w-20",
                "bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-950/90 dark:to-emerald-900/40"
              )}
              aria-hidden
              animate={
                reduceMotion
                  ? { scale: 1 }
                  : cleanerActive
                    ? {
                        scale: [1, 1.08, 1.03],
                        boxShadow: [
                          "0 4px 20px -8px rgba(16, 185, 129, 0.22)",
                          "0 0 28px -4px rgba(52, 211, 153, 0.5)",
                          "0 8px 28px -10px rgba(16, 185, 129, 0.38)",
                        ],
                      }
                    : { scale: 1, boxShadow: "0 4px 20px -8px rgba(16, 185, 129, 0.15)" }
              }
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : cleanerActive
                    ? { duration: 0.38, times: [0, 0.45, 1], ease: EASE }
                    : { duration: tFast, ease: EASE }
              }
            >
              {/* Brush + Sparkles: broom-style pairing (Lucide has no `Broom` export). */}
              <Brush className="absolute left-3 top-2.5 h-9 w-9 text-emerald-700 dark:text-emerald-400 sm:h-10 sm:w-10" strokeWidth={1.75} />
              <Sparkles className="absolute bottom-2.5 right-2.5 h-7 w-7 text-emerald-600/95 dark:text-emerald-300 sm:bottom-3 sm:right-3 sm:h-8 sm:w-8" strokeWidth={2} />
            </motion.div>
            <div className="min-w-0 space-y-1.5">
              <h3 className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.65rem]">Cleaner</h3>
              <p className="text-[0.9375rem] leading-relaxed text-muted-foreground sm:text-base">
                I want to find jobs, bid, and get paid.
              </p>
            </div>
          </div>

          <ul className="mb-5 space-y-3 text-[0.9375rem] leading-snug text-muted-foreground sm:text-base">
            {cleanerBullets.map((line) => (
              <li key={line} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>

          <div
            className="mb-5 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.06] dark:border-emerald-500/20 dark:bg-emerald-950/30"
            onClick={(e) => e.stopPropagation()}
          >
            <Accordion type="single" collapsible className="w-full px-1">
              <AccordionItem value="why-cleaner" className="border-0">
                <AccordionTrigger className="min-h-[3.25rem] rounded-xl px-3 py-3 text-sm font-semibold text-emerald-950 hover:no-underline dark:text-emerald-50 sm:px-4 sm:text-base">
                  Why choose this role?
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-4 pt-0 text-[0.875rem] leading-relaxed text-muted-foreground sm:px-4 sm:text-sm">
                  <div className="space-y-3 border-t border-emerald-500/10 pt-3 dark:border-emerald-500/15">
                    {cleanerWhyParagraphs.map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <div className="mt-auto flex flex-col gap-3">
            <motion.div whileTap={btnTap} className="w-full">
              <Button
                type="button"
                size="lg"
                variant="secondary"
                disabled={submitting}
                onClick={() => {
                  onChooseCleaner();
                }}
                className={cn(
                  "inline-flex min-h-14 w-full touch-manipulation items-center justify-center rounded-xl px-5 text-base font-semibold shadow-md",
                  "border border-emerald-600/40 bg-emerald-600 text-white hover:bg-emerald-600/92",
                  "dark:border-emerald-500/45 dark:bg-emerald-700 dark:hover:bg-emerald-600"
                )}
              >
                Start as Cleaner
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {roleError && (
        <p className="text-center text-sm text-destructive" role="alert">
          {roleError}
        </p>
      )}

      <p className="text-center text-xs leading-relaxed text-muted-foreground sm:text-sm">
        You can switch or add the other role anytime in{" "}
        <span className="font-medium text-foreground/90">Settings</span>.
      </p>

      {cleanerActive && (
        <motion.div
          layout={!reduceMotion}
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: tFast, ease: EASE }}
          className="space-y-4 overflow-hidden rounded-2xl border border-border/70 bg-muted/25 p-5 dark:border-gray-700/80 dark:bg-gray-950/50"
        >
          <p className="text-sm font-medium text-foreground">Cleaner details</p>
          <div className="space-y-2">
            <Label htmlFor="p2-abn" className="text-base">
              ABN <span className="text-destructive">*</span>
            </Label>
            <Input
              id="p2-abn"
              className="min-h-12 text-base"
              placeholder="11 digits"
              inputMode="numeric"
              autoComplete="off"
              maxLength={11}
              required
              aria-required
              {...abnInputProps}
              aria-invalid={Boolean(abnError || abnServerError)}
            />
            {(abnServerError || abnError) && (
              <Alert variant="destructive" className="py-3 text-sm">
                <AlertDescription>{abnServerError ?? abnError}</AlertDescription>
              </Alert>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Travel radius</span>
              <span className="tabular-nums text-muted-foreground">{maxTravelKm} km</span>
            </div>
            <Slider
              min={5}
              max={MAX_TRAVEL_KM}
              step={1}
              value={[maxTravelKm]}
              onValueChange={(v) => {
                const n = v[0] ?? 30;
                onMaxTravelChange(n);
              }}
              className="py-2"
            />
          </div>
        </motion.div>
      )}

      {cleanerActive && (
        <motion.div whileTap={btnTap} className="w-full">
          <Button
            type="submit"
            size="lg"
            disabled={submitting}
            className="inline-flex min-h-14 w-full touch-manipulation items-center justify-center gap-2 rounded-xl text-base font-semibold"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                Creating account…
              </>
            ) : (
              "Create account"
            )}
          </Button>
        </motion.div>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary underline underline-offset-2">
          Log in
        </Link>
      </p>
    </div>
  );
}
