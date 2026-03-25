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
