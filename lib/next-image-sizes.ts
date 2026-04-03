/**
 * `sizes` hints for next/image so mobile browsers request appropriately narrow widths.
 */

/** ~h-20 w-24 / small grid tiles in job detail & listing flows */
export const NEXT_IMAGE_SIZES_THUMB_GRID =
  "(max-width: 480px) 40vw, (max-width: 768px) 30vw, 120px";

/** 80×80 avatar / portfolio cell */
export const NEXT_IMAGE_SIZES_AVATAR_80 =
  "(max-width: 480px) 30vw, (max-width: 768px) 25vw, 80px";

/** 64×64 upload progress tiles */
export const NEXT_IMAGE_SIZES_UPLOAD_TILE =
  "(max-width: 768px) 20vw, 64px";

/** 96×96 listing cover picker */
export const NEXT_IMAGE_SIZES_LISTING_PREVIEW =
  "(max-width: 768px) 28vw, 96px";

/**
 * My Listings row thumbnail: `h-24 w-24` (96px) below sm, `sm:h-28` (112px) from sm up.
 */
export const NEXT_IMAGE_SIZES_LISTER_LISTING_THUMB =
  "(max-width: 639px) 96px, 112px";

/**
 * Listing card hero on md+ only (grid ~2–3 columns). Omit 100vw — this block is hidden below md.
 */
export const NEXT_IMAGE_SIZES_LISTING_CARD_DESKTOP =
  "(max-width: 1024px) 50vw, 33vw";
