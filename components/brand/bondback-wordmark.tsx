import { cn } from "@/lib/utils";

type BondBackWordmarkProps = {
  className?: string;
  /**
   * `decorative` — sticky header usage (hidden from AT, parent provides label).
   * `labeled` — full-screen loaders (exposed wordmark).
   */
  variant?: "decorative" | "labeled";
};

/**
 * Inline Bond Back wordmark — same SVG as `Header` (`/brand/bondback-wordmark.svg`).
 */
export function BondBackWordmark({
  className,
  variant = "decorative",
}: BondBackWordmarkProps) {
  const labeled = variant === "labeled";
  return (
    <img
      src="/brand/bondback-wordmark.svg"
      alt={labeled ? "Bond Back" : ""}
      decoding="async"
      aria-hidden={!labeled}
      className={cn(
        "pointer-events-none h-9 w-auto max-h-10 max-w-[min(13rem,52vw)] shrink-0 object-contain dark:brightness-[1.06] dark:contrast-[1.02] sm:h-10 sm:max-h-11 sm:max-w-[16rem] md:h-11 md:max-h-12 md:max-w-[18rem]",
        variant === "decorative" && "object-left",
        labeled && "mx-auto object-center",
        className
      )}
    />
  );
}
