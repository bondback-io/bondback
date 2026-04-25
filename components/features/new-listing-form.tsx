"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ListingCreationProgressModal,
  type ListingCreationStepId,
} from "@/components/listing/listing-creation-progress-modal";
import Link from "next/link";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  buildListingInsertRow,
  computeListingEndTimeIso,
  formatAuctionDurationChoiceLabel,
  getAuctionDurationDayChoices,
} from "@/lib/listings";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar } from "@/components/ui/calendar";
import { FieldHelp } from "@/components/ui/field-help";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CalendarIcon,
  CheckCircle2,
  CircleHelp,
  ImagePlus,
  KeyRound,
  MapPin,
  Hash,
  ChevronRight,
  ChevronLeft,
  ListChecks,
  Repeat2,
  X,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { REMOTE_IMAGE_BLUR_DATA_URL } from "@/lib/remote-image-blur";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { compressImage } from "@/lib/utils/compressImage";
import { NEXT_IMAGE_SIZES_LISTING_PREVIEW, NEXT_IMAGE_SIZES_UPLOAD_TILE } from "@/lib/next-image-sizes";
import { useToast } from "@/components/ui/use-toast";
import { showAppErrorToast } from "@/components/errors/show-app-error-toast";
import { getFriendlyError, type AppErrorFlow } from "@/lib/errors/friendly-messages";
import { logClientError } from "@/lib/errors/log-client-error";
import {
  retryWithBackoff,
  retryWithBackoffResult,
} from "@/lib/errors/retry-with-backoff";
import { logErrorEvent } from "@/lib/actions/error-logs";
import { saveListingDraftLocal } from "@/lib/listing-draft-storage";
import {
  validatePhotoFiles,
  PHOTO_LIMITS,
  PHOTO_VALIDATION,
  checkImageHeader,
} from "@/lib/photo-validation";
import { uploadProcessedPhotos } from "@/lib/actions/upload-photos";
import {
  createListingForPublish,
  updateListingInitialPhotos,
  updateListingCoverPhoto,
  triggerNewListingJobAlerts,
} from "@/lib/actions/listings";
import { notifyListerListingLive } from "@/lib/actions/notifications";
import {
  computeBaseListingPriceAud,
  getListingAddonPriceFromModifiers,
  PROPERTY_CONDITION_OPTIONS,
  PROPERTY_LEVELS_OPTIONS,
  type PricingModifiersConfig,
  type PropertyConditionKey,
  type PropertyLevelsKey,
} from "@/lib/pricing-modifiers";
import {
  LISTING_ADDON_KEYS,
  getListingAddonLabel,
  type ListingAddonKey,
} from "@/lib/listing-addon-prices";
import {
  DEEP_CLEAN_PURPOSES,
  RECURRING_FREQUENCIES,
  SERVICE_TYPES,
  deepCleanPurposeLabel,
  normalizeServiceType,
  recurringFrequencyMultiplier,
  recurringFrequencyShortLabel,
  serviceTypeLabel,
  type ServiceTypeKey,
} from "@/lib/service-types";
import {
  buildListingServiceDetailsPayload,
  DEEP_FOCUS_AREA_KEYS,
  deepFocusAreaLabel,
} from "@/lib/listing-service-details";
import type { Json } from "@/types/supabase";
import {
  allowedServicePricedAddonIds,
  sumSelectedServicePricedAddonsAud,
  type ServiceAddonsChecklistsMerged,
} from "@/lib/service-addons-checklists";

function getDefaultFreeChecklistLinesForForm(
  st: ServiceTypeKey,
  serviceAddonsChecklists: ServiceAddonsChecklistsMerged,
  bondDefaults: string[] | undefined
): string[] {
  if (st === "bond_cleaning") {
    return (bondDefaults ?? []).map((s) => String(s).trim()).filter((s) => s.length > 0);
  }
  if (st === "airbnb_turnover" || st === "recurring_house_cleaning" || st === "deep_clean") {
    return [...serviceAddonsChecklists[st].free];
  }
  return [];
}

const serviceTypeZodEnum = z.enum(SERVICE_TYPES as unknown as [string, ...string[]]);

const SERVICE_TYPE_PICKER_OPTIONS: {
  value: ServiceTypeKey;
  title: string;
  subtitle: string;
  icon: LucideIcon;
}[] = [
  {
    value: "bond_cleaning",
    title: "Bond cleaning",
    subtitle: "End of lease & bond return",
    icon: KeyRound,
  },
  {
    value: "recurring_house_cleaning",
    title: "Recurring clean",
    subtitle: "Weekly, fortnightly, or monthly",
    icon: Repeat2,
  },
  {
    value: "airbnb_turnover",
    title: "Airbnb turnover",
    subtitle: "Short-stay & guest-ready",
    icon: Building2,
  },
  {
    value: "deep_clean",
    title: "Deep / spring clean",
    subtitle: "Deep, spring & inspection-ready cleans",
    icon: Sparkles,
  },
];
const recurringFreqZodEnum = z.enum(
  RECURRING_FREQUENCIES as unknown as [string, ...string[]]
);
const deepCleanPurposeZodEnum = z.enum(
  DEEP_CLEAN_PURPOSES as unknown as [string, ...string[]]
);
const deepFocusZodEnum = z.enum(DEEP_FOCUS_AREA_KEYS as unknown as [string, ...string[]]);
const deepCleanIntensityZodEnum = z.enum(["light", "standard", "heavy"]);

const propertyTypes = ["apartment", "house", "townhouse", "studio"] as const;
type PropertyType = (typeof propertyTypes)[number];

const specialAreaKeys = ["balcony", "garage", "laundry", "patio"] as const;
type SpecialAreaKey = (typeof specialAreaKeys)[number];

const propertyConditionKeys = [
  "excellent_very_good",
  "good",
  "fair_average",
  "poor_bad",
] as const;

/** Default minimum starting price (AUD) for new listings — auction settings. */
const DEFAULT_MIN_LISTING_STARTING_PRICE_AUD = 100;
/** When admin enables low-amount test listings, allow cents-level starting prices. */
const LOW_AMOUNT_MIN_RESERVE_AUD = 0.01;

/** Bond / Airbnb / deep require minimum condition photos; recurring can list with none. */
function minPhotosRequiredToPublish(serviceType: ServiceTypeKey): number {
  return serviceType === "recurring_house_cleaning" ? 0 : PHOTO_LIMITS.LISTING_INITIAL_MIN_PUBLISH;
}

function reservePriceMinMessage(minAud: number): string {
  const label =
    minAud < 1
      ? `$${minAud.toFixed(2)}`
      : `$${Math.round(minAud)}`;
  return `Starting price must be at least ${label} AUD`;
}

function buildListingSchema(
  minReserveAud: number,
  allowTwoMinuteAuction: boolean,
  serviceAddonsMerged: ServiceAddonsChecklistsMerged
) {
  const allowedDurations = getAuctionDurationDayChoices(allowTwoMinuteAuction);
  return z
    .object({
      serviceType: serviceTypeZodEnum,
      recurringFrequency: recurringFreqZodEnum.optional(),
      airbnbGuestCapacity: z.coerce.number().int().min(1).max(99).optional(),
      airbnbTurnaroundHours: z.coerce.number().int().min(1).max(168).optional(),
      deepCleanPurpose: deepCleanPurposeZodEnum.optional(),
      isUrgent: z.boolean().default(false),
      propertyType: z.enum(propertyTypes),
      bedrooms: z.coerce.number().int().min(1).max(6),
      bathrooms: z.coerce.number().int().min(1).max(5),
      propertyCondition: z.enum(propertyConditionKeys),
      propertyLevels: z.enum(["1", "2"]),
      specialAreas: z.array(z.enum(specialAreaKeys)).default([]),
      suburb: z.string().min(1, "Select or enter your suburb"),
      postcode: z
        .string()
        .trim()
        .regex(/^\d{4}$/, "Postcode must be a 4-digit Australian postcode"),
      propertyAddress: z.string().max(200).optional(),
      addons: z.array(z.string()).default([]),
      propertyDescription: z.string().max(4000).optional(),
      instructions: z.string().max(2000).optional(),
      moveOutDate: z.date().optional(),
      reservePrice: z.coerce.number().min(minReserveAud, reservePriceMinMessage(minReserveAud)),
      durationDays: z.coerce
        .number()
        .int()
        .refine((v) => allowedDurations.includes(v), "Select a valid auction duration"),
      buyNowPrice: z.string().optional(),
      accessInstructions: z.string().max(2000).optional(),
      airbnbHostNotes: z.string().max(2000).optional(),
      recurringPreferredSchedule: z.string().max(500).optional(),
      recurringFocusNotes: z.string().max(2000).optional(),
      recurringSeriesStartDate: z.date().optional(),
      recurringSeriesEndDate: z.date().optional(),
      recurringSeriesMaxOccurrences: z.string().max(10).optional(),
      deepCleanIntensity: deepCleanIntensityZodEnum.optional(),
      deepFocusAreas: z.array(deepFocusZodEnum).default([]),
      deepSpecialRequests: z.string().max(2000).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.serviceType === "bond_cleaning" || data.serviceType === "airbnb_turnover") {
        if (!data.moveOutDate) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["moveOutDate"],
            message:
              data.serviceType === "bond_cleaning"
                ? "Select your move-out date"
                : "Select check-out date",
          });
        }
      }
      if (data.serviceType === "recurring_house_cleaning" && !data.recurringFrequency) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recurringFrequency"],
          message: "Select how often you need cleaning",
        });
      }
      if (data.serviceType === "recurring_house_cleaning" && !data.recurringSeriesStartDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recurringSeriesStartDate"],
          message: "Select the first clean date",
        });
      }
      if (
        data.serviceType === "recurring_house_cleaning" &&
        data.recurringSeriesStartDate &&
        data.recurringSeriesEndDate &&
        data.recurringSeriesEndDate < data.recurringSeriesStartDate
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recurringSeriesEndDate"],
          message: "Series end date must be on or after the first clean",
        });
      }
      if (data.serviceType === "recurring_house_cleaning") {
        const rawMax = data.recurringSeriesMaxOccurrences?.trim();
        if (rawMax) {
          const n = parseInt(rawMax, 10);
          if (!Number.isFinite(n) || n < 1 || n > 520) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["recurringSeriesMaxOccurrences"],
              message: "Enter a number of visits between 1 and 520 (or leave blank)",
            });
          }
        }
      }
      if (data.serviceType === "deep_clean") {
        if (!data.deepCleanIntensity) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["deepCleanIntensity"],
            message: "Select clean intensity",
          });
        }
      }
      if (data.buyNowPrice?.trim()) {
        const numeric = Number(data.buyNowPrice);
        if (Number.isNaN(numeric))
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["buyNowPrice"],
            message: "Buy-now price must be a number",
          });
        else if (numeric >= data.reservePrice)
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["buyNowPrice"],
            message: "Buy-now price must be lower than starting price",
          });
      }
      const st = data.serviceType as ServiceTypeKey;
      const addonList = data.addons ?? [];
      if (st === "bond_cleaning") {
        for (let i = 0; i < addonList.length; i++) {
          const a = addonList[i] ?? "";
          if (!(LISTING_ADDON_KEYS as readonly string[]).includes(a)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["addons", i],
              message: "Invalid add-on",
            });
          }
        }
      } else if (
        st === "airbnb_turnover" ||
        st === "recurring_house_cleaning" ||
        st === "deep_clean"
      ) {
        const allowed = allowedServicePricedAddonIds(st, serviceAddonsMerged);
        for (let i = 0; i < addonList.length; i++) {
          const a = addonList[i] ?? "";
          if (!allowed.has(a)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["addons", i],
              message: "Invalid add-on",
            });
          }
        }
      }
    });
}

type ListingFormValues = z.infer<ReturnType<typeof buildListingSchema>>;

function calculatePricingParts(
  values: ListingFormValues,
  pricingModifiers: PricingModifiersConfig,
  serviceAddonsMerged: ServiceAddonsChecklistsMerged
): {
  baseCoreAud: number;
  extrasAud: number;
  recurringMult: number;
  adjustmentAud: number;
  adjustedTotalAud: number;
} {
  const svc = normalizeServiceType(values.serviceType);
  const baseCoreAud = computeBaseListingPriceAud(pricingModifiers, {
    bedrooms: values.bedrooms,
    bathrooms: values.bathrooms,
    condition: values.propertyCondition as PropertyConditionKey,
    levels: values.propertyLevels as PropertyLevelsKey,
    serviceType: svc,
  });
  const beds = values.bedrooms;
  const extrasAud =
    svc === "bond_cleaning"
      ? (values.addons ?? []).reduce(
          (sum, key) =>
            sum +
            getListingAddonPriceFromModifiers(
              pricingModifiers,
              key as ListingAddonKey,
              beds
            ),
          0
        )
      : sumSelectedServicePricedAddonsAud(svc, values.addons ?? [], serviceAddonsMerged);
  const recurringMult =
    values.serviceType === "recurring_house_cleaning"
      ? recurringFrequencyMultiplier(values.recurringFrequency)
      : 1;
  const raw = (baseCoreAud + extrasAud) * recurringMult;
  const adjustedTotalAud = Math.round(raw * 100) / 100;
  const adjustmentAud = Math.round((adjustedTotalAud - baseCoreAud - extrasAud) * 100) / 100;
  return { baseCoreAud, extrasAud, recurringMult, adjustmentAud, adjustedTotalAud };
}

function calculateEstimatedPrice(
  values: ListingFormValues,
  pricingModifiers: PricingModifiersConfig,
  serviceAddonsMerged: ServiceAddonsChecklistsMerged
): number {
  return calculatePricingParts(values, pricingModifiers, serviceAddonsMerged).adjustedTotalAud;
}

function buildAutoListingTitle(values: ListingFormValues): string {
  const pt = values.propertyType.charAt(0).toUpperCase() + values.propertyType.slice(1);
  const sub = values.suburb;
  const beds = values.bedrooms;
  const baths = values.bathrooms;
  const bedLabel = `${beds} ${beds === 1 ? "Bedroom" : "Bedrooms"}`;
  const bathLabel = `${baths} ${baths === 1 ? "Bathroom" : "Bathrooms"}`;
  switch (values.serviceType) {
    case "bond_cleaning":
      return `${bedLabel} + ${bathLabel} ${pt} in ${sub}`;
    case "recurring_house_cleaning": {
      const f = recurringFrequencyShortLabel(values.recurringFrequency);
      return `Recurring clean (${f}) · ${bedLabel} + ${bathLabel} ${pt} in ${sub}`;
    }
    case "airbnb_turnover":
      return `Airbnb turnover · ${bedLabel} ${pt} in ${sub}`;
    case "deep_clean":
      return `${deepCleanPurposeLabel(values.deepCleanPurpose)} · ${bedLabel} + ${bathLabel} ${pt} in ${sub}`;
    default:
      return `${bedLabel} + ${bathLabel} ${pt} in ${sub}`;
  }
}

type SuburbRow = { suburb: string; postcode: string | number; state: string | null };

/** Platform fee % (lister pays on top of job amount at payment). Matches job payment breakdown. */
export type NewListingFormProps = {
  listerId: string;
  listerSuburb: string;
  listerPostcode?: string | null;
  feePercentage?: number;
  /** Optional admin overrides per service type; missing keys use `feePercentage`. */
  feePercentageByService?: Partial<Record<ServiceTypeKey, number>>;
  pricingModifiers: PricingModifiersConfig;
  /** Airbnb / recurring / deep: admin-configured priced add-ons + free checklist templates. */
  serviceAddonsChecklists: ServiceAddonsChecklistsMerged;
  /** Bond cleaning: default checklist lines from global settings (same seed as job creation). */
  defaultBondCleanerChecklistItems?: string[];
  /** When true (admin global setting), starting price may be below $100 for live payment tests. */
  allowLowAmountListings?: boolean;
  /** When true, auction duration may include a 2-minute test option (admin global setting). */
  allowTwoMinuteAuctionTest?: boolean;
};

function platformFeeCents(jobAmountDollars: number, feePct: number): number {
  const jobCents = Math.round(jobAmountDollars * 100);
  if (!Number.isFinite(jobCents) || jobCents <= 0 || !Number.isFinite(feePct) || feePct <= 0) return 0;
  return Math.round((jobCents * feePct) / 100);
}

function formatAudFromCents(cents: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

const STEPS = [
  { id: 1, title: "Property basics" },
  { id: 2, title: "Address & location" },
  { id: 3, title: "Initial condition photos" },
  { id: 4, title: "Add-ons & requirements" },
  { id: 5, title: "Auction settings" },
];

export function NewListingForm({
  listerId,
  listerSuburb,
  listerPostcode = "",
  feePercentage = 12,
  feePercentageByService,
  pricingModifiers,
  serviceAddonsChecklists,
  defaultBondCleanerChecklistItems,
  allowLowAmountListings = false,
  allowTwoMinuteAuctionTest = false,
}: NewListingFormProps) {
  const minReserveAud = allowLowAmountListings
    ? LOW_AMOUNT_MIN_RESERVE_AUD
    : DEFAULT_MIN_LISTING_STARTING_PRICE_AUD;
  const listingSchema = useMemo(
    () => buildListingSchema(minReserveAud, allowTwoMinuteAuctionTest, serviceAddonsChecklists),
    [minReserveAud, allowTwoMinuteAuctionTest, serviceAddonsChecklists]
  );
  const listingResolver = useMemo(
    () => zodResolver(listingSchema),
    [listingSchema]
  );
  const supabase = createBrowserSupabaseClient();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [initialPhotoFiles, setInitialPhotoFiles] = useState<File[]>([]);
  const [initialPhotoPreviews, setInitialPhotoPreviews] = useState<string[]>([]);
  /** Index of the photo to use as cover on job cards. User must select one; default 0. */
  const [coverPhotoIndex, setCoverPhotoIndex] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  type FileStatus = "pending" | "uploading" | "success" | "error";
  const [fileStatuses, setFileStatuses] = useState<
    { status: FileStatus; url?: string; thumbUrl?: string; error?: string }[]
  >([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reserveTouched, setReserveTouched] = useState(false);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishModalPhase, setPublishModalPhase] = useState<
    "running" | "success" | "error"
  >("running");
  const [publishProgress, setPublishProgress] = useState(0);
  const [publishStepId, setPublishStepId] =
    useState<ListingCreationStepId>("calculating");
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishFailureHint, setPublishFailureHint] = useState<string | null>(null);
  const publishRedirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Kept mounted for all steps so listers can add condition photos after step 3 without going back first. */
  const initialPhotosInputRef = useRef<HTMLInputElement>(null);

  // Suburb autocomplete
  const [suburbQuery, setSuburbQuery] = useState("");
  const [suburbOpen, setSuburbOpen] = useState(false);
  const [suburbResults, setSuburbResults] = useState<SuburbRow[]>([]);
  const [isPendingSuburb, startSuburbTransition] = useTransition();
  const [, startSubmitTransition] = useTransition();
  const [photoStagingCount, setPhotoStagingCount] = useState(0);

  const defaultReservePrice = Math.max(
    computeBaseListingPriceAud(pricingModifiers, {
      bedrooms: 2,
      bathrooms: 1,
      condition: "excellent_very_good",
      levels: "1",
      serviceType: "bond_cleaning",
    }),
    minReserveAud
  );

  const durationOptions = useMemo(
    () => getAuctionDurationDayChoices(allowTwoMinuteAuctionTest === true),
    [allowTwoMinuteAuctionTest]
  );

  const form = useForm<ListingFormValues>({
    resolver: listingResolver,
    defaultValues: {
      serviceType: "bond_cleaning",
      recurringFrequency: undefined,
      airbnbGuestCapacity: undefined,
      airbnbTurnaroundHours: undefined,
      deepCleanPurpose: undefined,
      isUrgent: false,
      propertyType: "apartment",
      bedrooms: 2,
      bathrooms: 1,
      propertyCondition: "excellent_very_good",
      propertyLevels: "1",
      specialAreas: [],
      suburb: listerSuburb || "",
      postcode: listerPostcode || "",
      propertyAddress: "",
      addons: [],
      propertyDescription: "",
      instructions: "",
      accessInstructions: "",
      airbnbHostNotes: "",
      recurringPreferredSchedule: "",
      recurringFocusNotes: "",
      recurringSeriesStartDate: undefined,
      recurringSeriesEndDate: undefined,
      recurringSeriesMaxOccurrences: "",
      deepCleanIntensity: undefined,
      deepFocusAreas: [],
      deepSpecialRequests: "",
      moveOutDate: undefined,
      reservePrice: defaultReservePrice,
      durationDays: 3,
      buyNowPrice: "",
    },
  });

  const serviceTypeWatched = form.watch("serviceType");
  const effectiveFeePercent = useMemo(() => {
    const hit = feePercentageByService?.[serviceTypeWatched as ServiceTypeKey];
    if (typeof hit === "number" && Number.isFinite(hit) && hit >= 0 && hit <= 100) {
      return hit;
    }
    return feePercentage;
  }, [feePercentageByService, serviceTypeWatched, feePercentage]);

  useEffect(() => {
    if (serviceTypeWatched !== "recurring_house_cleaning") {
      form.setValue("recurringFrequency", undefined, { shouldValidate: true });
      form.setValue("recurringSeriesStartDate", undefined, { shouldValidate: true });
      form.setValue("recurringSeriesEndDate", undefined, { shouldValidate: true });
      form.setValue("recurringSeriesMaxOccurrences", "", { shouldValidate: true });
    }
    if (serviceTypeWatched !== "airbnb_turnover") {
      form.setValue("airbnbGuestCapacity", undefined, { shouldValidate: true });
      form.setValue("airbnbTurnaroundHours", undefined, { shouldValidate: true });
    }
    if (serviceTypeWatched !== "deep_clean") {
      form.setValue("deepCleanPurpose", undefined, { shouldValidate: true });
      form.setValue("deepCleanIntensity", undefined, { shouldValidate: true });
      form.setValue("deepFocusAreas", [], { shouldValidate: true });
      form.setValue("deepSpecialRequests", "", { shouldValidate: true });
    }
    /** Simplified flows: pricing still uses condition × levels; use neutral defaults when not collected. */
    if (serviceTypeWatched !== "bond_cleaning") {
      form.setValue("propertyCondition", "good", { shouldValidate: false });
      form.setValue("propertyLevels", "1", { shouldValidate: false });
    }
  }, [serviceTypeWatched, form]);

  const watchedValues = form.watch();
  const reservePriceWatched = form.watch("reservePrice");
  const buyNowPriceWatched = form.watch("buyNowPrice");
  const reserveFeeCents = useMemo(
    () =>
      platformFeeCents(
        typeof reservePriceWatched === "number" && reservePriceWatched > 0 ? reservePriceWatched : 0,
        effectiveFeePercent
      ),
    [reservePriceWatched, effectiveFeePercent]
  );
  const buyNowNum =
    typeof buyNowPriceWatched === "string" && buyNowPriceWatched.trim() !== ""
      ? Number(buyNowPriceWatched)
      : typeof buyNowPriceWatched === "number"
        ? buyNowPriceWatched
        : NaN;
  const buyNowFeeCents = useMemo(
    () =>
      platformFeeCents(
        Number.isFinite(buyNowNum) && buyNowNum > 0 ? buyNowNum : 0,
        effectiveFeePercent
      ),
    [buyNowNum, effectiveFeePercent]
  );
  const minPhotosPublish = useMemo(
    () => minPhotosRequiredToPublish(serviceTypeWatched as ServiceTypeKey),
    [serviceTypeWatched]
  );
  const estimatedPrice = useMemo(
    () => calculateEstimatedPrice(watchedValues, pricingModifiers, serviceAddonsChecklists),
    [watchedValues, pricingModifiers, serviceAddonsChecklists]
  );
  const pricingParts = useMemo(
    () => calculatePricingParts(watchedValues, pricingModifiers, serviceAddonsChecklists),
    [watchedValues, pricingModifiers, serviceAddonsChecklists]
  );
  /** True when user set starting price below the live calculated estimate (property + add-ons). */
  const startingPriceBelowSuggested =
    typeof reservePriceWatched === "number" &&
    Number.isFinite(reservePriceWatched) &&
    reservePriceWatched > 0 &&
    reservePriceWatched < estimatedPrice;

  // Bond only: special areas in step 1 sync into addons (auto-add/remove).
  useEffect(() => {
    if (serviceTypeWatched !== "bond_cleaning") return;
    const special = watchedValues.specialAreas ?? [];
    const currentAddons = watchedValues.addons ?? [];
    const nonSpecialAddons = currentAddons.filter(
      (a) => !(specialAreaKeys as readonly string[]).includes(a)
    );
    const merged = [...new Set([...nonSpecialAddons, ...special])];
    if (
      merged.length !== currentAddons.length ||
      merged.some((a, i) => a !== currentAddons[i])
    ) {
      form.setValue("addons", merged, { shouldValidate: true });
    }
  }, [watchedValues.specialAreas, serviceTypeWatched, watchedValues.addons, form]);

  /** Strip add-on ids that do not apply after a service-type change. */
  useEffect(() => {
    const svc = serviceTypeWatched as ServiceTypeKey;
    const addons = watchedValues.addons ?? [];
    if (svc === "bond_cleaning") {
      const allowed = new Set(LISTING_ADDON_KEYS as readonly string[]);
      const next = addons.filter((a) => allowed.has(a));
      if (next.length !== addons.length || next.some((a, i) => a !== addons[i])) {
        form.setValue("addons", next, { shouldValidate: true });
      }
      return;
    }
    if (svc === "airbnb_turnover" || svc === "recurring_house_cleaning" || svc === "deep_clean") {
      const allowed = allowedServicePricedAddonIds(svc, serviceAddonsChecklists);
      const next = addons.filter((a) => allowed.has(a));
      if (next.length !== addons.length || next.some((a, i) => a !== addons[i])) {
        form.setValue("addons", next, { shouldValidate: true });
      }
    }
  }, [serviceTypeWatched, watchedValues.addons, form, serviceAddonsChecklists]);

  const freeRoutineChecklistLines = useMemo(
    () =>
      getDefaultFreeChecklistLinesForForm(
        normalizeServiceType(serviceTypeWatched as ServiceTypeKey),
        serviceAddonsChecklists,
        defaultBondCleanerChecklistItems
      ),
    [serviceTypeWatched, serviceAddonsChecklists, defaultBondCleanerChecklistItems]
  );

  useEffect(() => {
    if (!reserveTouched) {
      form.setValue("reservePrice", Math.max(estimatedPrice, minReserveAud), {
        shouldValidate: true,
      });
    }
  }, [estimatedPrice, form, reserveTouched, minReserveAud]);

  useEffect(() => {
    const sub = form.getValues("suburb");
    if (sub) setSuburbQuery(sub);
  }, []);

  useEffect(() => {
    if (!allowTwoMinuteAuctionTest && form.getValues("durationDays") === 0) {
      form.setValue("durationDays", 3, { shouldValidate: true });
    }
  }, [allowTwoMinuteAuctionTest, form]);

  useEffect(() => {
    return () => {
      if (publishRedirectTimerRef.current) {
        clearTimeout(publishRedirectTimerRef.current);
      }
    };
  }, []);

  // Suburb autocomplete fetch
  useEffect(() => {
    if (suburbQuery.trim().length < 2) {
      setSuburbResults([]);
      return;
    }
    startSuburbTransition(async () => {
      const { data, error } = await supabase
        .from("suburbs")
        .select("suburb, postcode, state")
        .ilike("suburb", `%${suburbQuery.trim()}%`)
        .order("suburb", { ascending: true })
        .limit(10);
      if (!error) setSuburbResults((data ?? []) as SuburbRow[]);
      else setSuburbResults([]);
    });
  }, [suburbQuery, supabase]);

  const handleSuburbSelect = (row: SuburbRow) => {
    form.setValue("suburb", row.suburb, { shouldValidate: true });
    form.setValue("postcode", String(row.postcode ?? ""), { shouldValidate: true });
    setSuburbQuery(row.suburb);
    setSuburbOpen(false);
  };

  const removePhoto = (index: number) => {
    const url = initialPhotoPreviews[index];
    if (url) URL.revokeObjectURL(url);
    setInitialPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setInitialPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
    setCoverPhotoIndex((prev) => {
      if (prev === index) return 0;
      if (index < prev) return Math.max(0, prev - 1);
      return prev;
    });
    setSubmitError(null);
  };

  const handlePhotosChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setSubmitError(null);
    const incoming = Array.from(files);
    const { validFiles, errors } = validatePhotoFiles(incoming, {
      maxFiles: PHOTO_LIMITS.LISTING_INITIAL,
      existingCount: initialPhotoFiles.length,
      minFiles: 1,
    });
    errors.forEach((err) => {
      toast({
        variant: "destructive",
        title: "Photo validation",
        description: err,
      });
    });
    if (validFiles.length > 0) {
      setPhotoStagingCount(validFiles.length);
      const withHeaderCheck: File[] = [];
      try {
        for (const f of validFiles) {
          try {
            const compressed = await compressImage(f);
            const header = await checkImageHeader(compressed);
            if (!header.valid) {
              toast({
                variant: "destructive",
                title: "Photo validation",
                description: `${f.name}: ${header.error}`,
              });
              continue;
            }
            withHeaderCheck.push(compressed);
          } catch {
            toast({
              variant: "destructive",
              title: "Couldn’t prepare photo",
              description: `${f.name}: try another image.`,
            });
          }
        }
        if (withHeaderCheck.length > 0) {
          const previews = withHeaderCheck.map((f) => URL.createObjectURL(f));
          setInitialPhotoFiles((prev) => [...prev, ...withHeaderCheck]);
          setInitialPhotoPreviews((prev) => [...prev, ...previews]);
        }
      } finally {
        setPhotoStagingCount(0);
      }
    }
    e.target.value = "";
  };

  const onSubmit = async (values: ListingFormValues) => {
    startSubmitTransition(() => {
      setSubmitError(null);
      setIsSubmitting(true);
      setPublishModalOpen(true);
      setPublishModalPhase("running");
      setPublishError(null);
      setPublishFailureHint(null);
      setPublishStepId("calculating");
      setPublishProgress(4);
    });

    const failPublish = (
      err: unknown,
      flow: AppErrorFlow = "listing",
      opts?: { failureHint?: string | null; logToServer?: boolean }
    ) => {
      logClientError("newListing.publish", err, { flow });
      const friendly = getFriendlyError(flow, err);
      setPublishModalPhase("error");
      setPublishError(`${friendly.description}\n\n${friendly.nextAction}`);
      setSubmitError(friendly.title);
      if (opts?.failureHint !== undefined) {
        setPublishFailureHint(opts.failureHint);
      } else if (flow === "listing" || flow === "photoUpload") {
        setPublishFailureHint(
          "We automatically retried up to 3 times with short pauses when the connection dropped."
        );
      } else {
        setPublishFailureHint(null);
      }
      if (opts?.logToServer !== false) {
        void logErrorEvent({
          scope: `newListing.${flow}`,
          message:
            err instanceof Error ? err.message : typeof err === "string" ? err : "unknown",
          maxAttempts: 3,
          context: { flow },
        });
      }
    };

    try {
      const reserve = values.reservePrice;
      const buyNow = values.buyNowPrice?.trim()
        ? Number(values.buyNowPrice)
        : null;
      /** Suggested price from property + add-ons (shown in UI as the estimate). */
      const estimatedPriceAud = calculateEstimatedPrice(
        values,
        pricingModifiers,
        serviceAddonsChecklists
      );
      /** Auction starts at the reserve the lister set in step 5 — must match reserve_cents (not the calculator alone). */
      const startingBidAud = reserve;
      if (buyNow != null && buyNow >= reserve) {
        const msg = "Buy-now price must be lower than the starting bid price.";
        failPublish(new Error(msg), "listing", {
          failureHint: null,
          logToServer: false,
        });
        return;
      }

      const durationDays = values.durationDays;
      const recurringStartStr =
        values.serviceType === "recurring_house_cleaning" && values.recurringSeriesStartDate
          ? format(values.recurringSeriesStartDate, "yyyy-MM-dd")
          : null;
      const recurringEndStr =
        values.serviceType === "recurring_house_cleaning" && values.recurringSeriesEndDate
          ? format(values.recurringSeriesEndDate, "yyyy-MM-dd")
          : null;
      const recurringMaxParsed =
        values.serviceType === "recurring_house_cleaning" &&
        values.recurringSeriesMaxOccurrences?.trim()
          ? parseInt(values.recurringSeriesMaxOccurrences.trim(), 10)
          : null;
      const recurringMaxOccurrences =
        recurringMaxParsed != null && Number.isFinite(recurringMaxParsed) && recurringMaxParsed >= 1
          ? recurringMaxParsed
          : null;
      const moveOutDateStr =
        values.serviceType === "recurring_house_cleaning"
          ? recurringStartStr
          : values.moveOutDate
            ? format(values.moveOutDate, "yyyy-MM-dd")
            : null;
      const endTime = computeListingEndTimeIso({ durationDays });

      const metaLines: string[] = [];
      if (values.serviceType === "airbnb_turnover") {
        if (values.airbnbGuestCapacity != null && values.airbnbGuestCapacity >= 1) {
          metaLines.push(`Airbnb turnover — up to ${values.airbnbGuestCapacity} guests`);
        } else {
          metaLines.push("Airbnb turnover");
        }
      }
      if (values.serviceType === "recurring_house_cleaning" && values.recurringFrequency) {
        metaLines.push(
          `Recurring clean — ${recurringFrequencyShortLabel(values.recurringFrequency)}`
        );
      }
      if (values.serviceType === "deep_clean") {
        if (values.deepCleanIntensity) {
          metaLines.push(`Deep clean intensity: ${values.deepCleanIntensity}`);
        }
        if (values.deepCleanPurpose) {
          metaLines.push(`Type: ${deepCleanPurposeLabel(values.deepCleanPurpose)}`);
        }
      }
      const access = values.accessInstructions?.trim();
      const userInstr = values.instructions?.trim();
      const instrHead = metaLines.filter(Boolean).join("\n");
      const instrParts = [instrHead, userInstr].filter(Boolean);
      if (access) instrParts.push(`Access / keys: ${access}`);
      const instructions = instrParts.join("\n\n") || null;

      let propDesc = values.propertyDescription?.trim() || "";
      if (values.serviceType === "airbnb_turnover" && values.airbnbHostNotes?.trim()) {
        const n = values.airbnbHostNotes.trim();
        propDesc = propDesc ? `${propDesc}\n\n${n}` : n;
      }
      if (values.serviceType === "recurring_house_cleaning" && values.recurringFocusNotes?.trim()) {
        const n = `Regular focus: ${values.recurringFocusNotes.trim()}`;
        propDesc = propDesc ? `${propDesc}\n\n${n}` : n;
      }
      if (values.serviceType === "deep_clean" && values.deepSpecialRequests?.trim()) {
        const n = values.deepSpecialRequests.trim();
        propDesc = propDesc ? `${propDesc}\n\n${n}` : n;
      }
      const property_description = propDesc || null;

      const title = buildAutoListingTitle(values);

      const minPublishPhotos = minPhotosRequiredToPublish(values.serviceType as ServiceTypeKey);

      if (initialPhotoFiles.length > PHOTO_LIMITS.LISTING_INITIAL) {
        const msg = `Max ${PHOTO_LIMITS.LISTING_INITIAL} initial condition photos allowed.`;
        failPublish(new Error(msg), "photoUpload", {
          failureHint: null,
          logToServer: false,
        });
        return;
      }
      if (initialPhotoFiles.length < minPublishPhotos) {
        const msg =
          minPublishPhotos === 0
            ? ""
            : `Upload at least ${minPublishPhotos} initial condition photos (step 3) before publishing.`;
        if (minPublishPhotos > 0) {
          failPublish(new Error(msg), "photoUpload", {
            failureHint: null,
            logToServer: false,
          });
          return;
        }
      }

      const serviceDetailsJson = buildListingServiceDetailsPayload({
        access_instructions: values.accessInstructions,
        airbnb_host_notes: values.airbnbHostNotes,
        recurring_preferred_schedule: values.recurringPreferredSchedule,
        recurring_focus_notes: values.recurringFocusNotes,
        deep_clean_intensity: values.deepCleanIntensity,
        deep_focus_areas: values.deepFocusAreas,
        deep_special_requests: values.deepSpecialRequests,
      });

      setPublishStepId("calculating");
      setPublishProgress(12);
      await new Promise((r) => setTimeout(r, 120));

      const svcKey = values.serviceType as ServiceTypeKey;
      const mappedFee = feePercentageByService?.[svcKey];
      const platformFeeSnap =
        typeof mappedFee === "number" &&
        Number.isFinite(mappedFee) &&
        mappedFee >= 0 &&
        mappedFee <= 100
          ? mappedFee
          : feePercentage;

      const row = buildListingInsertRow({
        lister_id: listerId,
        title,
        property_description,
        property_address: values.propertyAddress?.trim() || null,
        suburb: values.suburb,
        postcode: values.postcode,
        property_type: values.propertyType,
        bedrooms: values.bedrooms,
        bathrooms: values.bathrooms,
        addons: [...new Set(values.addons)],
        special_areas:
          values.specialAreas.length > 0 ? [...new Set(values.specialAreas)] : null,
        special_instructions: instructions,
        move_out_date: moveOutDateStr,
        photo_urls: null,
        reserve_cents: Math.round(reserve * 100),
        reserve_price: Math.round(reserve * 100),
        buy_now_cents: buyNow ? Math.round(buyNow * 100) : null,
        base_price: Math.round(estimatedPriceAud * 100),
        starting_price_cents: Math.round(startingBidAud * 100),
        current_lowest_bid_cents: Math.round(startingBidAud * 100),
        duration_days: durationDays,
        status: "live",
        end_time: endTime,
        end_date: endTime.slice(0, 10),
        platform_fee_percentage: Math.max(0, Math.min(30, platformFeeSnap)),
        preferred_dates: moveOutDateStr ? [moveOutDateStr] : null,
        recurring_series_start_date: recurringStartStr,
        recurring_series_end_date: recurringEndStr,
        recurring_series_max_occurrences: recurringMaxOccurrences,
        property_condition: values.propertyCondition,
        property_levels: values.propertyLevels,
        service_type: values.serviceType,
        recurring_frequency:
          values.serviceType === "recurring_house_cleaning"
            ? values.recurringFrequency ?? null
            : null,
        airbnb_guest_capacity:
          values.serviceType === "airbnb_turnover" ? values.airbnbGuestCapacity ?? null : null,
        airbnb_turnaround_hours:
          values.serviceType === "airbnb_turnover" ? values.airbnbTurnaroundHours ?? null : null,
        deep_clean_purpose:
          values.serviceType === "deep_clean" ? values.deepCleanPurpose ?? null : null,
        is_urgent: values.isUrgent === true,
        service_details: serviceDetailsJson as Json,
      });

      setPublishProgress(20);
      setPublishStepId("creating");

      type InsertResult =
        | { ok: true; data: { id: string } }
        | { ok: false; error: string };

      const insertResult = await retryWithBackoffResult<InsertResult>(
        async () => {
          const r = await createListingForPublish(row);
          if (!r.ok) {
            return { ok: false as const, error: r.error };
          }
          return { ok: true as const, data: { id: r.id } };
        },
        { scope: "newListing.insert", maxAttempts: 3 }
      );

      if (!insertResult.ok) {
        failPublish(new Error(insertResult.error), "listing");
        return;
      }

      const listingId = String(insertResult.data.id);
      const total = initialPhotoFiles.length;
      const uploadedUrls: string[] = [];

      setPublishStepId("uploading");
      setPublishProgress(28);
      setFileStatuses(initialPhotoFiles.map(() => ({ status: "pending" as const })));
      setUploading(true);
      try {
        for (let i = 0; i < initialPhotoFiles.length; i++) {
          setFileStatuses((prev) =>
            prev.map((s, j) => (j === i ? { ...s, status: "uploading" as const } : s))
          );
          const uploadPct =
            total > 0 ? 28 + Math.round(((i + 0.35) / total) * 44) : 28;
          setPublishProgress(uploadPct);
          setUploadProgress(total > 0 ? Math.round(((i + 1) / total) * 100) : 0);
          const file = initialPhotoFiles[i];
          if (!file) continue;
          const fd = new FormData();
          fd.append("file", file);
          let pack: Awaited<ReturnType<typeof uploadProcessedPhotos>>;
          try {
            pack = await retryWithBackoff(
              async () => {
                const r = await uploadProcessedPhotos(fd, {
                  bucket: "condition-photos",
                  pathPrefix: `listings/${listingId}/initial`,
                  maxFiles: 1,
                  generateThumb: true,
                });
                const res = r.results[0];
                if (r.error || !res?.url) {
                  const err = res?.error ?? r.error ?? "Upload failed";
                  throw new Error(String(err));
                }
                return r;
              },
              { scope: `newListing.uploadPhoto:${file.name}`, maxAttempts: 3 }
            );
          } catch (e) {
            const errText = e instanceof Error ? e.message : String(e);
            setFileStatuses((prev) =>
              prev.map((s, j) =>
                j === i ? { ...s, status: "error" as const, error: errText } : s
              )
            );
            failPublish(new Error(`${file.name}: ${errText}`), "photoUpload");
            return;
          }
          const res = pack.results[0];
          if (!res?.url) {
            const err = "Upload failed";
            setFileStatuses((prev) =>
              prev.map((s, j) => (j === i ? { ...s, status: "error" as const, error: err } : s))
            );
            failPublish(new Error(`${file.name}: ${err}`), "photoUpload");
            return;
          }
          uploadedUrls.push(res.url);
          setPublishProgress(28 + Math.round(((i + 1) / total) * 44));
          setFileStatuses((prev) =>
            prev.map((s, j) =>
              j === i
                ? { ...s, status: "success" as const, url: res.url, thumbUrl: res.thumbnailUrl }
                : s
            )
          );
        }
      } finally {
        setUploadProgress(100);
        setUploading(false);
      }

      setPublishProgress(74);
      setPublishStepId("notifications");

      if (uploadedUrls.length > 0) {
        const updateResult = await retryWithBackoffResult(
          async () => updateListingInitialPhotos(listingId, uploadedUrls),
          { scope: "newListing.updateListingPhotos", maxAttempts: 3 }
        );
        if (!updateResult.ok) {
          failPublish(new Error(updateResult.error ?? "Save failed"), "listing");
          return;
        }
        setPublishProgress(84);
        const coverUrl =
          uploadedUrls[Math.min(coverPhotoIndex, uploadedUrls.length - 1)] ?? uploadedUrls[0];
        const coverRes = await updateListingCoverPhoto(listingId, coverUrl ?? null);
        if (!coverRes.ok) {
          showAppErrorToast(toast, {
            flow: "photoUpload",
            error: new Error(coverRes.error ?? ""),
            context: "newListing.coverPhoto",
          });
        }
      }

      setPublishProgress(90);
      setPublishStepId("finalizing");

      // SMS (Twilio) + push (Expo) to cleaners within max_travel_km — fire-and-forget
      void triggerNewListingJobAlerts(listingId).catch(() => {
        /* non-blocking */
      });
      void notifyListerListingLive(listingId).catch(() => {
        /* non-blocking */
      });
      try {
        const { notifyAdminNewListing } = await import("@/lib/actions/admin-notify-email");
        await notifyAdminNewListing(listingId).catch(() => {});
      } catch {
        /* non-blocking */
      }

      setPublishProgress(100);
      setPublishModalPhase("success");

      if (publishRedirectTimerRef.current) {
        clearTimeout(publishRedirectTimerRef.current);
      }
      publishRedirectTimerRef.current = setTimeout(() => {
        publishRedirectTimerRef.current = null;
        /** Full navigation avoids soft-nav edge cases and stuck modal on mobile after publish.
         * Open the live listing so the lister can review bids and Q&A immediately. */
        window.location.assign(
          `/listings/${encodeURIComponent(listingId)}?published=1`
        );
      }, 1800);
    } catch (err) {
      failPublish(err, "listing");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page-inner relative space-y-6 pb-12 md:space-y-6">
        <ListingCreationProgressModal
          open={publishModalOpen}
          onOpenChange={(next) => {
            /** Modal already blocks dismiss while running/success; only ignore duplicate close while working. */
            if (!next && publishModalPhase === "running") {
              return;
            }
            setPublishModalOpen(next);
            if (!next) {
              setPublishError(null);
              setPublishFailureHint(null);
              setPublishProgress(0);
            }
          }}
          phase={publishModalPhase}
          progress={publishProgress}
          activeStepId={publishStepId}
          errorMessage={publishError}
          failureHint={publishFailureHint}
          onSaveDraft={() => {
            const v = form.getValues();
            saveListingDraftLocal({
              savedAt: new Date().toISOString(),
              step,
              values: {
                ...v,
                moveOutDate:
                  v.moveOutDate instanceof Date
                    ? v.moveOutDate.toISOString()
                    : v.moveOutDate,
                recurringSeriesStartDate:
                  v.recurringSeriesStartDate instanceof Date
                    ? v.recurringSeriesStartDate.toISOString()
                    : v.recurringSeriesStartDate,
                recurringSeriesEndDate:
                  v.recurringSeriesEndDate instanceof Date
                    ? v.recurringSeriesEndDate.toISOString()
                    : v.recurringSeriesEndDate,
              } as Record<string, unknown>,
            });
            toast({
              title: "Draft saved on this device",
              description:
                "Your answers are stored in this browser only. Add photos again when you publish.",
            });
          }}
          onRetry={() => {
            setPublishFailureHint(null);
            setPublishModalPhase("running");
            setPublishError(null);
            setPublishStepId("calculating");
            setPublishProgress(4);
            void form.handleSubmit(onSubmit)();
          }}
        />
        <header className="relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-background to-sky-50/40 px-4 py-5 shadow-sm ring-1 ring-emerald-500/10 dark:border-emerald-800/60 dark:from-emerald-950/45 dark:via-gray-950 dark:to-sky-950/25 dark:ring-emerald-400/10 sm:px-6 sm:py-6">
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-400/20 blur-2xl dark:bg-emerald-500/15"
            aria-hidden
          />
          <div className="relative flex flex-col gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-900/20 dark:bg-emerald-600 dark:shadow-emerald-950/40">
                <Sparkles className="h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem]" aria-hidden />
              </span>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 sm:text-sm">
                New cleaning job
              </p>
            </div>
            <h1 className="text-2xl font-bold leading-[1.15] tracking-tight text-foreground dark:text-gray-50 sm:text-3xl">
              Post your job and get cleaner bids
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground dark:text-gray-400 sm:text-base">
              List bond cleans, recurring house cleaning, Airbnb turnovers, or deep / move-in cleans.
              Add your property, schedule, photos, and pricing — cleaners bid so you can pick the best offer.
            </p>
          </div>
        </header>

        {step === 1 && (
          <Card className="border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-background shadow-sm dark:border-emerald-900/50 dark:from-emerald-950/40 dark:to-gray-900/80">
            <CardHeader className="pb-3 pt-5 sm:pt-6">
              <CardTitle className="text-lg text-foreground dark:text-gray-100">Service type</CardTitle>
              <CardDescription className="dark:text-gray-400">
                Bond cleaning works exactly as before. Other types unlock tailored fields and pricing adjustments.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pb-5 sm:pb-6">
              <Label htmlFor="serviceType" className="text-sm font-medium">
                What kind of clean is this?
              </Label>
              <Controller
                control={form.control}
                name="serviceType"
                render={({ field }) => (
                  <>
                    <div className="md:hidden">
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger
                          id="serviceType"
                          className="h-12 text-base dark:bg-gray-800 dark:border-gray-700"
                        >
                          <SelectValue placeholder="Select service type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bond_cleaning">
                            Bond cleaning (end of lease)
                          </SelectItem>
                          <SelectItem value="recurring_house_cleaning">
                            Recurring house cleaning
                          </SelectItem>
                          <SelectItem value="airbnb_turnover">
                            Airbnb / short-stay turnover
                          </SelectItem>
                          <SelectItem value="deep_clean">
                            Deep / spring / move-in cleaning
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div
                      className="hidden md:grid md:grid-cols-2 md:gap-3 lg:grid-cols-4 lg:gap-4"
                      role="radiogroup"
                      aria-label="Service type"
                    >
                      {SERVICE_TYPE_PICKER_OPTIONS.map((opt) => {
                        const selected = field.value === opt.value;
                        const Icon = opt.icon;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => field.onChange(opt.value)}
                            className={cn(
                              "group flex flex-col items-center rounded-2xl border-2 bg-card p-4 text-center shadow-sm transition-all duration-200",
                              "hover:border-emerald-400/70 hover:bg-emerald-50/50 hover:shadow-md",
                              "dark:bg-gray-900/60 dark:hover:bg-emerald-950/35 dark:hover:border-emerald-600/50",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950",
                              selected
                                ? "border-emerald-500 bg-emerald-50/90 shadow-md ring-2 ring-emerald-500/25 dark:border-emerald-500 dark:bg-emerald-950/45 dark:ring-emerald-400/20"
                                : "border-border dark:border-gray-700"
                            )}
                          >
                            <span
                              className={cn(
                                "mb-3 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl transition-colors",
                                "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
                                selected &&
                                  "bg-emerald-600 text-white dark:bg-emerald-600 dark:text-white"
                              )}
                            >
                              <Icon className="h-8 w-8" strokeWidth={1.75} aria-hidden />
                            </span>
                            <span className="text-sm font-semibold leading-snug text-foreground dark:text-gray-100">
                              {opt.title}
                            </span>
                            <span className="mt-1 text-xs leading-snug text-muted-foreground dark:text-gray-400">
                              {opt.subtitle}
                            </span>
                            {selected ? (
                              <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                                Selected
                              </span>
                            ) : (
                              <span className="mt-2 text-[11px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 dark:text-gray-500">
                                Choose
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              />
              {form.formState.errors.serviceType && (
                <p className="text-xs text-destructive">{form.formState.errors.serviceType.message}</p>
              )}
              <p className="text-xs text-muted-foreground dark:text-gray-500 md:hidden">
                Selected:{" "}
                <span className="font-medium text-foreground dark:text-gray-300">
                  {serviceTypeLabel(serviceTypeWatched)}
                </span>
              </p>
            </CardContent>
          </Card>
        )}

        {/* Stepper */}
        <Card className="border-border shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
          <CardContent className="p-5 sm:p-6 md:p-6">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <p className="text-lg font-semibold tabular-nums text-muted-foreground dark:text-gray-400 md:text-sm md:font-medium">
                Step {step} of 5
              </p>
              <p className="text-lg font-semibold text-foreground dark:text-gray-100 md:text-sm">
                {STEPS[step - 1]?.title}
              </p>
            </div>
            <Progress value={(step / 5) * 100} className="h-4 md:h-2" />
            <div className="mt-4 flex flex-col gap-2 text-base font-medium text-muted-foreground dark:text-gray-500 md:mt-3 md:flex-row md:justify-between md:gap-0 md:text-xs md:font-normal">
              {STEPS.map((s) => (
                <span
                  key={s.id}
                  className={cn(
                    "max-md:rounded-md max-md:border max-md:border-transparent max-md:px-2 max-md:py-2.5",
                    step === s.id &&
                      "max-md:border-primary/30 max-md:bg-primary/10 max-md:text-foreground dark:max-md:bg-primary/20 dark:max-md:text-gray-100",
                    step >= s.id &&
                      "font-medium text-foreground dark:text-gray-300"
                  )}
                >
                  <span className="tabular-nums font-bold md:font-medium">{s.id}.</span> {s.title}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            // Never submit from Enter key or native form submit — only via "Publish listing" button click.
            // This gives the user time to review step 5 (reserve, duration, buy now) before creating.
          }}
          noValidate
          className="space-y-8 md:space-y-6"
        >
          <input
            ref={initialPhotosInputRef}
            id="listing-initial-condition-photos"
            type="file"
            accept={PHOTO_VALIDATION.ACCEPT}
            multiple
            onChange={handlePhotosChange}
            className="sr-only"
            tabIndex={-1}
          />

          {/* Step 1: Property basics */}
          {step === 1 && (
            <Card className="border-border shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <CardHeader>
                <CardTitle className="text-lg dark:text-gray-100">
                  Property basics
                </CardTitle>
                <CardDescription className="dark:text-gray-400">
                  Tell us about your property so we can suggest a fair starting price.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 p-5 pt-0 md:p-6 md:pt-0">
                {serviceTypeWatched === "bond_cleaning" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="propertyType">Property type</Label>
                    <FieldHelp label="Property type help">
                      Shown on your listing and in the job title. Base price uses bedrooms, condition, and levels (set below).
                    </FieldHelp>
                  </div>
                  <Controller
                    control={form.control}
                    name="propertyType"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger id="propertyType" className="dark:bg-gray-800 dark:border-gray-700">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="apartment">Apartment</SelectItem>
                          <SelectItem value="house">House</SelectItem>
                          <SelectItem value="townhouse">Townhouse</SelectItem>
                          <SelectItem value="studio">Studio</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {form.formState.errors.propertyType && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.propertyType.message}
                    </p>
                  )}
                </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="bedrooms">Bedrooms</Label>
                      <FieldHelp label="Bedrooms help">
                        More bedrooms usually mean a higher base price for the bond clean.
                      </FieldHelp>
                    </div>
                    <Input
                      id="bedrooms"
                      type="number"
                      min={1}
                      max={6}
                      className="dark:bg-gray-800 dark:border-gray-700"
                      {...form.register("bedrooms", { valueAsNumber: true })}
                    />
                    {form.formState.errors.bedrooms && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.bedrooms.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="bathrooms">Bathrooms</Label>
                      <FieldHelp label="Bathrooms help">
                        Bathroom count is used in our pricing calculator.
                      </FieldHelp>
                    </div>
                    <Input
                      id="bathrooms"
                      type="number"
                      min={1}
                      max={5}
                      className="dark:bg-gray-800 dark:border-gray-700"
                      {...form.register("bathrooms", { valueAsNumber: true })}
                    />
                    {form.formState.errors.bathrooms && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.bathrooms.message}
                      </p>
                    )}
                  </div>
                </div>

                {serviceTypeWatched === "airbnb_turnover" && (
                  <div className="space-y-4 rounded-lg border border-teal-200/70 bg-teal-50/40 p-4 dark:border-teal-900/45 dark:bg-teal-950/25">
                    <div className="space-y-2">
                      <Label>Check-out date</Label>
                      <p className="text-[11px] text-muted-foreground dark:text-gray-500">
                        When guests leave — cleaners use this to plan turnover.
                      </p>
                      <Controller
                        control={form.control}
                        name="moveOutDate"
                        render={({ field }) => (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                type="button"
                                className={cn(
                                  "w-full justify-start text-left font-normal dark:bg-gray-800 dark:border-gray-700",
                                  !field.value && "text-muted-foreground dark:text-gray-400"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "d MMM yyyy") : "Select check-out date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={(d) => field.onChange(d ?? undefined)}
                                fromDate={new Date()}
                              />
                            </PopoverContent>
                          </Popover>
                        )}
                      />
                      {form.formState.errors.moveOutDate && (
                        <p className="text-xs text-destructive">{form.formState.errors.moveOutDate.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="airbnbGuestCapacity">Number of guests (optional)</Label>
                      <Input
                        id="airbnbGuestCapacity"
                        type="number"
                        min={1}
                        max={99}
                        placeholder="e.g. 4"
                        className="dark:bg-gray-800 dark:border-gray-700"
                        {...form.register("airbnbGuestCapacity", { valueAsNumber: true })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="airbnbHostNotes">Turnover notes</Label>
                      <p className="text-[11px] text-muted-foreground dark:text-gray-500">
                        Linens/towels, fridge, bins, restocking, staging, etc.
                      </p>
                      <Textarea
                        id="airbnbHostNotes"
                        rows={4}
                        placeholder="e.g. Fresh linen in closet; empty bins; quick fridge wipe…"
                        className="dark:bg-gray-800 dark:border-gray-700"
                        {...form.register("airbnbHostNotes")}
                      />
                    </div>
                  </div>
                )}

                {serviceTypeWatched === "bond_cleaning" && (
                <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2 md:col-span-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="propertyCondition">Condition</Label>
                      <FieldHelp label="Condition help">
                        Rough overall state of the property. Adjusts the suggested base before add-ons.
                      </FieldHelp>
                    </div>
                    <Controller
                      control={form.control}
                      name="propertyCondition"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger
                            id="propertyCondition"
                            className="w-full dark:bg-gray-800 dark:border-gray-700"
                          >
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                          <SelectContent>
                            {PROPERTY_CONDITION_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {form.formState.errors.propertyCondition && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.propertyCondition.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2 sm:col-span-2 md:col-span-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="propertyLevels">Number of levels</Label>
                      <FieldHelp label="Levels help">
                        Single-storey vs two-storey. Two levels add a surcharge to the base (before add-ons).
                      </FieldHelp>
                    </div>
                    <Controller
                      control={form.control}
                      name="propertyLevels"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger
                            id="propertyLevels"
                            className="w-full dark:bg-gray-800 dark:border-gray-700"
                          >
                            <SelectValue placeholder="Select levels" />
                          </SelectTrigger>
                          <SelectContent>
                            {PROPERTY_LEVELS_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {form.formState.errors.propertyLevels && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.propertyLevels.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Special areas</Label>
                    <FieldHelp label="Special areas help">
                      Tick areas that apply. Selected areas are automatically added to Add-ons in step 4 where you can set a price for each.
                    </FieldHelp>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {specialAreaKeys.map((key) => (
                      <label
                        key={key}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-muted/50 dark:border-gray-700 dark:hover:bg-gray-800"
                      >
                        <Checkbox
                          checked={watchedValues.specialAreas.includes(key)}
                          onCheckedChange={(checked) => {
                            const next = checked
                              ? [...watchedValues.specialAreas, key]
                              : watchedValues.specialAreas.filter((a) => a !== key);
                            form.setValue("specialAreas", next, { shouldValidate: true });
                          }}
                        />
                        <span className="capitalize dark:text-gray-200">{key}</span>
                      </label>
                    ))}
                  </div>
                </div>
                </>
                )}

                {serviceTypeWatched === "recurring_house_cleaning" && (
                  <div className="space-y-4 rounded-lg border border-sky-200/70 bg-sky-50/40 p-4 dark:border-sky-900/50 dark:bg-sky-950/25">
                    <div className="space-y-2">
                      <Label>How often?</Label>
                      <Controller
                        control={form.control}
                        name="recurringFrequency"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="dark:bg-gray-800 dark:border-gray-700">
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="fortnightly">Fortnightly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {form.formState.errors.recurringFrequency && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.recurringFrequency.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>First clean date</Label>
                      <p className="text-[11px] text-muted-foreground dark:text-gray-500">
                        This starts your recurring series and is shown as the next visit until a contract is active.
                      </p>
                      <Controller
                        control={form.control}
                        name="recurringSeriesStartDate"
                        render={({ field }) => (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                type="button"
                                className={cn(
                                  "w-full justify-start text-left font-normal dark:bg-gray-800 dark:border-gray-700",
                                  !field.value && "text-muted-foreground dark:text-gray-400"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value
                                  ? format(field.value, "d MMM yyyy")
                                  : "Select first clean date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={(d) => field.onChange(d ?? undefined)}
                                fromDate={new Date()}
                              />
                            </PopoverContent>
                          </Popover>
                        )}
                      />
                      {form.formState.errors.recurringSeriesStartDate && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.recurringSeriesStartDate.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Series end date (optional)</Label>
                      <Controller
                        control={form.control}
                        name="recurringSeriesEndDate"
                        render={({ field }) => (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                type="button"
                                className={cn(
                                  "w-full justify-start text-left font-normal dark:bg-gray-800 dark:border-gray-700",
                                  !field.value && "text-muted-foreground dark:text-gray-400"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value
                                  ? format(field.value, "d MMM yyyy")
                                  : "No end date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={(d) => field.onChange(d ?? undefined)}
                                fromDate={form.watch("recurringSeriesStartDate") ?? new Date()}
                              />
                            </PopoverContent>
                          </Popover>
                        )}
                      />
                      {form.formState.errors.recurringSeriesEndDate && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.recurringSeriesEndDate.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="recurringSeriesMaxOccurrences">Max paid visits (optional)</Label>
                      <Input
                        id="recurringSeriesMaxOccurrences"
                        type="text"
                        inputMode="numeric"
                        placeholder="e.g. 12 — leave blank for no cap"
                        className="dark:bg-gray-800 dark:border-gray-700"
                        {...form.register("recurringSeriesMaxOccurrences")}
                      />
                      {form.formState.errors.recurringSeriesMaxOccurrences && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.recurringSeriesMaxOccurrences.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="recurringPreferredSchedule">Preferred day(s) &amp; time window (optional)</Label>
                      <Input
                        id="recurringPreferredSchedule"
                        placeholder="e.g. Tuesday mornings, after 9am"
                        className="dark:bg-gray-800 dark:border-gray-700"
                        {...form.register("recurringPreferredSchedule")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="recurringFocusNotes">Regular focus areas or notes</Label>
                      <Textarea
                        id="recurringFocusNotes"
                        rows={3}
                        placeholder="e.g. Kitchen and bathrooms each visit; pets in backyard…"
                        className="dark:bg-gray-800 dark:border-gray-700"
                        {...form.register("recurringFocusNotes")}
                      />
                    </div>
                  </div>
                )}

                {serviceTypeWatched === "deep_clean" && (
                  <div className="space-y-4 rounded-lg border border-violet-200/70 bg-violet-50/40 p-4 dark:border-violet-900/45 dark:bg-violet-950/25">
                    <div className="space-y-2">
                      <Label>Clean intensity</Label>
                      <Controller
                        control={form.control}
                        name="deepCleanIntensity"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="dark:bg-gray-800 dark:border-gray-700">
                              <SelectValue placeholder="Select intensity" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="light">Light deep clean</SelectItem>
                              <SelectItem value="standard">Standard deep clean</SelectItem>
                              <SelectItem value="heavy">Heavy deep clean</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {form.formState.errors.deepCleanIntensity && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.deepCleanIntensity.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Clean type (optional)</Label>
                      <Controller
                        control={form.control}
                        name="deepCleanPurpose"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="dark:bg-gray-800 dark:border-gray-700">
                              <SelectValue placeholder="General deep clean" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="deep_clean">Deep clean</SelectItem>
                              <SelectItem value="spring_clean">Spring clean</SelectItem>
                              <SelectItem value="move_in_clean">Move-in clean</SelectItem>
                              <SelectItem value="inspection_clean">Inspection clean</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Focus areas</Label>
                      <p className="text-[11px] text-muted-foreground dark:text-gray-500">
                        Select any that need extra attention.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {DEEP_FOCUS_AREA_KEYS.map((key) => {
                          const checked = watchedValues.deepFocusAreas.includes(key);
                          return (
                            <label
                              key={key}
                              className={cn(
                                "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors dark:border-gray-700",
                                checked
                                  ? "border-violet-400 bg-violet-100/80 dark:bg-violet-950/50"
                                  : "border-border hover:bg-muted/50 dark:hover:bg-gray-800"
                              )}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(c) => {
                                  const next = c
                                    ? [...watchedValues.deepFocusAreas, key]
                                    : watchedValues.deepFocusAreas.filter((a) => a !== key);
                                  form.setValue("deepFocusAreas", next, { shouldValidate: true });
                                }}
                              />
                              {deepFocusAreaLabel(key)}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 2: Address & location */}
          {step === 2 && (
            <Card className="border-border shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <CardHeader>
                <CardTitle className="text-lg dark:text-gray-100">
                  Address & location
                </CardTitle>
                <CardDescription className="dark:text-gray-400">
                  This helps cleaners find your property and give accurate bids.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 p-5 pt-0 md:p-6 md:pt-0">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="suburb">Suburb</Label>
                    <FieldHelp label="Suburb help">
                      Start typing to search Australian suburbs. Postcode will auto-fill when you select one.
                    </FieldHelp>
                  </div>
                  <div className="relative">
                    <MapPin
                      className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground dark:text-gray-500 md:h-4 md:w-4"
                      aria-hidden
                    />
                    <Input
                      id="suburb"
                      className="pl-10 pr-4 md:pl-10 md:pr-3 dark:bg-gray-800 dark:border-gray-700"
                      placeholder="e.g. LITTLE MOUNTAIN"
                      value={suburbQuery || form.watch("suburb")}
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="search"
                      onChange={(e) => {
                        const v = e.target.value;
                        setSuburbQuery(v);
                        form.setValue("suburb", v, { shouldValidate: true });
                        if (!v.trim()) form.setValue("postcode", "", { shouldValidate: true });
                        else setSuburbOpen(true);
                      }}
                      onFocus={() => suburbQuery.length >= 2 && setSuburbOpen(true)}
                      onBlur={() =>
                        setTimeout(() => setSuburbOpen(false), 200)
                      }
                    />
                    {suburbOpen && (suburbQuery.trim().length >= 2 || suburbResults.length > 0) && (
                      <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-background shadow-xl dark:border-gray-700 dark:bg-gray-900">
                        {isPendingSuburb && (
                          <div className="px-3 py-2 text-xs text-muted-foreground dark:text-gray-400">
                            Searching…
                          </div>
                        )}
                        {!isPendingSuburb && suburbResults.length === 0 && suburbQuery.trim().length >= 2 && (
                          <div className="px-3 py-2 text-xs text-muted-foreground dark:text-gray-400">
                            No suburbs found
                          </div>
                        )}
                        {!isPendingSuburb &&
                          suburbResults.map((row) => (
                            <button
                              key={`${row.suburb}-${row.postcode}`}
                              type="button"
                              className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted dark:hover:bg-gray-800 dark:text-gray-100"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSuburbSelect(row);
                              }}
                            >
                              <span className="font-medium">{row.suburb}</span>
                              <span className="text-xs text-muted-foreground dark:text-gray-400">
                                {row.postcode}
                                {row.state ? `, ${row.state}` : ""}
                              </span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                  {form.formState.errors.suburb && (
                    <p className="text-base text-destructive md:text-xs">
                      {form.formState.errors.suburb.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postcode">Postcode</Label>
                  <div className="relative">
                    <Hash
                      className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground dark:text-gray-500 md:h-4 md:w-4"
                      aria-hidden
                    />
                    <Input
                      id="postcode"
                      className="pl-10 pr-4 md:pl-10 md:pr-3 dark:bg-gray-800 dark:border-gray-700"
                      placeholder="e.g. 4551"
                      maxLength={4}
                      inputMode="numeric"
                      {...form.register("postcode")}
                    />
                  </div>
                  {form.formState.errors.postcode && (
                    <p className="text-base text-destructive md:text-xs">
                      {form.formState.errors.postcode.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="propertyAddress">Full address (optional)</Label>
                  <Textarea
                    id="propertyAddress"
                    placeholder="Street number and name — kept private until you accept a cleaner"
                    rows={2}
                    className="dark:bg-gray-800 dark:border-gray-700"
                    {...form.register("propertyAddress")}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Initial condition photos */}
          {step === 3 && (
            <Card className="border-border shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <CardHeader>
                <CardTitle className="text-lg dark:text-gray-100">
                  Initial condition photos
                </CardTitle>
                <CardDescription className="dark:text-gray-400">
                  {minPhotosPublish === 0 ? (
                    <>
                      Photos are optional for recurring cleans. Add some if you like — they help cleaners bid accurately.
                      You can still publish without photos.
                    </>
                  ) : (
                    <>
                      Upload clear before photos of the entire property. You need at least {minPhotosPublish} photos to
                      publish; you can move on and add more from the next steps before you publish. Select one photo as
                      the cover—it will be shown on job cards.
                    </>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-5 pt-0 md:p-6 md:pt-0">
                {minPhotosPublish > 0 && initialPhotoFiles.length < minPhotosPublish && (
                  <Alert variant="warning" className="px-4 py-3">
                    <AlertDescription className="space-y-1.5 text-xs leading-relaxed sm:text-sm">
                      <span className="block font-semibold text-amber-950 dark:text-amber-50">
                        {minPhotosPublish} photos required to publish
                      </span>
                      <span className="block text-amber-900/95 dark:text-amber-100/95">
                        You have {initialPhotoFiles.length} of {minPhotosPublish}. Add enough photos here before you can
                        publish. You can still use <strong className="font-medium">Next</strong> to continue the form and
                        return to this step later.
                      </span>
                    </AlertDescription>
                  </Alert>
                )}
                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" variant="outline" size="lg" className="min-h-12 w-full gap-2 sm:w-auto md:min-h-0" asChild>
                      <label htmlFor="listing-initial-condition-photos" className="cursor-pointer">
                        <ImagePlus className="h-5 w-5 md:h-4 md:w-4" />
                        Upload photos (
                        {minPhotosPublish > 0
                          ? `${minPhotosPublish} min to publish`
                          : "optional"}
                        , max {PHOTO_LIMITS.LISTING_INITIAL})
                      </label>
                    </Button>
                    <span className="text-xs text-muted-foreground dark:text-gray-400">
                      {initialPhotoFiles.length}/{PHOTO_LIMITS.LISTING_INITIAL} photos · JPG, PNG or WebP, max {PHOTO_VALIDATION.MAX_FILE_LABEL} each
                    </span>
                  </div>
                  {photoStagingCount > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-medium text-muted-foreground dark:text-gray-400">
                        Adding photos…
                      </p>
                      <div className="flex flex-wrap gap-3" aria-busy="true">
                        {Array.from({ length: photoStagingCount }).map((_, i) => (
                          <Skeleton
                            key={`staging-${i}`}
                            className="h-24 w-24 shrink-0 rounded-lg sm:h-28 sm:w-28"
                            aria-hidden
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {uploading && (
                    <div className="mt-4 space-y-2">
                      <Progress value={uploadProgress} className="h-4 md:h-2" />
                      <p className="text-xs text-muted-foreground dark:text-gray-400">
                        Uploading… {uploadProgress}%
                      </p>
                      {fileStatuses.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {fileStatuses.map((fs, index) => (
                            <div
                              key={index}
                              className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border bg-muted"
                            >
                              {fs.status === "success" && (fs.thumbUrl ?? fs.url) ? (
                                <div className="relative h-full w-full">
                                  <CheckCircle2 className="absolute right-0.5 top-0.5 z-10 h-4 w-4 text-green-600" />
                                  {(() => {
                                    const thumbSrc = fs.thumbUrl ?? fs.url!;
                                    const isBlob =
                                      thumbSrc.startsWith("blob:") ||
                                      thumbSrc.startsWith("data:");
                                    return (
                                      <Image
                                        src={thumbSrc}
                                        alt={`Uploaded ${index + 1}`}
                                        fill
                                        className="object-cover"
                                        sizes={NEXT_IMAGE_SIZES_UPLOAD_TILE}
                                        unoptimized={isBlob}
                                        quality={75}
                                        {...(isBlob
                                          ? {}
                                          : {
                                              placeholder: "blur" as const,
                                              blurDataURL: REMOTE_IMAGE_BLUR_DATA_URL,
                                            })}
                                      />
                                    );
                                  })()}
                                </div>
                              ) : fs.status === "error" ? (
                                <div className="flex flex-col items-center gap-0.5 p-1 text-center">
                                  <span className="text-red-600" aria-hidden>✕</span>
                                  <span className="text-[10px] text-red-600 line-clamp-2">
                                    {fs.error ?? "Failed"}
                                  </span>
                                </div>
                              ) : fs.status === "uploading" ? (
                                <div className="flex w-full flex-col items-center gap-1 p-1">
                                  <span className="text-xs text-muted-foreground">Uploading…</span>
                                  <div className="h-1 w-full max-w-[48px] overflow-hidden rounded-full bg-muted">
                                    <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground">pending</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {!uploading && initialPhotoPreviews.length > 0 && (
                    <>
                      <p className="mt-4 text-sm font-medium text-foreground dark:text-gray-200">
                        Select cover photo (shown on job cards)
                      </p>
                      <p className="text-xs text-muted-foreground dark:text-gray-400">
                        Tap a photo to set it as the default cover. Every listing needs a cover photo.
                      </p>
                      <div className="mt-2 flex flex-wrap gap-3">
                        {initialPhotoPreviews.map((url, index) => (
                          <div
                            key={`${url}-${index}`}
                            className={cn(
                              "relative h-24 w-24 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 bg-muted transition-colors dark:border-gray-700",
                              coverPhotoIndex === index
                                ? "border-primary ring-2 ring-primary/30 dark:border-primary dark:ring-primary/40"
                                : "border-border hover:border-muted-foreground/50"
                            )}
                            onClick={() => setCoverPhotoIndex(index)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setCoverPhotoIndex(index);
                              }
                            }}
                            aria-label={
                              coverPhotoIndex === index
                                ? `Photo ${index + 1}, set as cover. Tap to change.`
                                : `Set photo ${index + 1} as cover`
                            }
                          >
                            <Image
                              src={url}
                              alt={`Preview ${index + 1}`}
                              fill
                              className="object-cover"
                              sizes={NEXT_IMAGE_SIZES_LISTING_PREVIEW}
                              unoptimized
                              loading="lazy"
                            />
                            {coverPhotoIndex === index && (
                              <span className="absolute bottom-0 left-0 right-0 bg-primary/90 px-1 py-0.5 text-center text-[10px] font-medium text-primary-foreground">
                                Cover
                              </span>
                            )}
                            <button
                              type="button"
                              aria-label="Remove photo"
                              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
                              onClick={(e) => {
                                e.stopPropagation();
                                removePhoto(index);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {minPhotosPublish > 0 &&
                    initialPhotoPreviews.length > 0 &&
                    initialPhotoPreviews.length < minPhotosPublish && (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                      Add {minPhotosPublish - initialPhotoPreviews.length} more photo
                      {minPhotosPublish - initialPhotoPreviews.length === 1 ? "" : "s"} to meet the minimum for publishing.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Add-ons & requirements */}
          {step === 4 && (
            <Card className="border-border shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <CardHeader>
                <CardTitle className="text-lg dark:text-gray-100">
                  Add-ons & requirements
                </CardTitle>
                <CardDescription className="dark:text-gray-400">
                  Select extra services. The estimated price updates in real time.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 p-5 pt-0 md:p-6 md:pt-0">
                <div className="rounded-lg border border-border bg-muted/25 p-4 dark:border-gray-700 dark:bg-gray-800/40">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-foreground dark:text-gray-100">
                        Initial condition photos
                      </p>
                      <p className="text-xs text-muted-foreground dark:text-gray-400">
                        {initialPhotoFiles.length}/{PHOTO_LIMITS.LISTING_INITIAL} photos
                        {minPhotosPublish > 0 && initialPhotoFiles.length < minPhotosPublish
                          ? ` · at least ${minPhotosPublish} required to publish`
                          : minPhotosPublish === 0
                            ? " · photos optional for recurring"
                            : ""}
                        . Add any you missed here, or go back to step 3 to remove photos or change the cover.
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="gap-1.5"
                        disabled={
                          uploading ||
                          photoStagingCount > 0 ||
                          initialPhotoFiles.length >= PHOTO_LIMITS.LISTING_INITIAL
                        }
                        onClick={() => initialPhotosInputRef.current?.click()}
                      >
                        <ImagePlus className="h-4 w-4" />
                        Add more photos
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setStep(3)}>
                        Step 3 — cover &amp; remove
                      </Button>
                    </div>
                  </div>
                  {initialPhotoPreviews.length > 0 && (
                    <div className="mt-3 flex max-w-full gap-2 overflow-x-auto pb-1">
                      {initialPhotoPreviews.map((url, i) => (
                        <div
                          key={`${url}-${i}`}
                          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted dark:border-gray-600"
                        >
                          <Image
                            src={url}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="56px"
                            unoptimized
                          />
                          {coverPhotoIndex === i && (
                            <span className="absolute bottom-0 left-0 right-0 bg-primary/90 py-0.5 text-center text-[9px] font-medium text-primary-foreground">
                              Cover
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-800 dark:bg-emerald-950/40">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-200 max-md:text-sm">
                    Estimated price
                  </p>
                  <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">
                    ${estimatedPrice} AUD
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    {normalizeServiceType(serviceTypeWatched as ServiceTypeKey) === "bond_cleaning" ? (
                      <>
                        Base from (rate × bedrooms × condition × levels × service multiplier) plus (bathroom rate ×
                        bathrooms); then selected add-ons (carpet steam, walls, and windows scale per bedroom).{" "}
                        {PROPERTY_CONDITION_OPTIONS.find((o) => o.value === watchedValues.propertyCondition)?.label ?? ""}
                        {", "}
                        {PROPERTY_LEVELS_OPTIONS.find((o) => o.value === watchedValues.propertyLevels)?.label ?? ""}.
                      </>
                    ) : (
                      <>
                        Base from bedroom/bathroom rates and service settings, plus any{" "}
                        <strong className="font-semibold">priced add-ons</strong> you select below (flat AUD amounts set
                        by the platform). Free cleaner checklist items are added automatically on the job — they do not
                        change this estimate.
                      </>
                    )}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Priced add-ons</Label>
                  <p className="text-xs text-muted-foreground dark:text-gray-400">
                    {normalizeServiceType(serviceTypeWatched as ServiceTypeKey) === "bond_cleaning" ? (
                      <>
                        Special areas selected in step 1 are included here. Amounts follow bond add-on pricing in Global
                        Settings. Use property description for context; special instructions for access notes.
                      </>
                    ) : (
                      <>
                        Optional extras for this service type. Amounts are flat AUD (2026 market-style defaults; admin
                        can adjust). They increase your suggested starting price.
                      </>
                    )}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {normalizeServiceType(serviceTypeWatched as ServiceTypeKey) === "bond_cleaning"
                      ? LISTING_ADDON_KEYS.map((key) => {
                          const isChecked = watchedValues.addons.includes(key);
                          const beds = watchedValues.bedrooms ?? 1;
                          const lineAud = getListingAddonPriceFromModifiers(
                            pricingModifiers,
                            key,
                            beds
                          );
                          return (
                            <div
                              key={key}
                              className="flex min-w-0 flex-col gap-1 rounded-lg border border-border px-4 py-3 text-sm transition-colors hover:bg-muted/30 dark:border-gray-700 dark:hover:bg-gray-800 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                            >
                              <div className="flex min-w-0 items-start gap-2 sm:items-center">
                                <Checkbox
                                  id={`addon-${key}`}
                                  checked={isChecked}
                                  className="mt-0.5 sm:mt-0"
                                  onCheckedChange={(checked) => {
                                    const next = checked
                                      ? [...watchedValues.addons, key]
                                      : watchedValues.addons.filter((a) => a !== key);
                                    form.setValue("addons", next, { shouldValidate: true });
                                  }}
                                />
                                <div className="min-w-0 flex-1">
                                  <label
                                    htmlFor={`addon-${key}`}
                                    className="cursor-pointer font-medium text-foreground dark:text-gray-200"
                                  >
                                    {getListingAddonLabel(key)}
                                  </label>
                                  {(key === "windows" ||
                                    key === "carpet_steam" ||
                                    key === "walls") && (
                                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground dark:text-gray-500">
                                      {key === "windows"
                                        ? "Per-bedroom rate × bedrooms (set in Global Settings)."
                                        : "Per-bedroom rate × bedrooms."}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <span className="shrink-0 pl-7 text-sm font-medium tabular-nums text-muted-foreground dark:text-gray-300 sm:pl-0">
                                +${lineAud}
                              </span>
                            </div>
                          );
                        })
                      : (() => {
                          const st = normalizeServiceType(serviceTypeWatched as ServiceTypeKey);
                          if (
                            st !== "airbnb_turnover" &&
                            st !== "recurring_house_cleaning" &&
                            st !== "deep_clean"
                          ) {
                            return null;
                          }
                          const priced = serviceAddonsChecklists[st].priced;
                          return priced.map((p) => {
                            const isChecked = watchedValues.addons.includes(p.id);
                            return (
                              <div
                                key={p.id}
                                className="flex min-w-0 flex-col gap-1 rounded-lg border border-border px-4 py-3 text-sm transition-colors hover:bg-muted/30 dark:border-gray-700 dark:hover:bg-gray-800 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                              >
                                <div className="flex min-w-0 items-start gap-2 sm:items-center">
                                  <Checkbox
                                    id={`addon-${p.id}`}
                                    checked={isChecked}
                                    className="mt-0.5 sm:mt-0"
                                    onCheckedChange={(checked) => {
                                      const next = checked
                                        ? [...watchedValues.addons, p.id]
                                        : watchedValues.addons.filter((a) => a !== p.id);
                                      form.setValue("addons", next, { shouldValidate: true });
                                    }}
                                  />
                                  <label
                                    htmlFor={`addon-${p.id}`}
                                    className="min-w-0 flex-1 cursor-pointer font-medium text-foreground dark:text-gray-200"
                                  >
                                    {p.name}
                                  </label>
                                </div>
                                <span className="shrink-0 pl-7 text-sm font-medium tabular-nums text-muted-foreground dark:text-gray-300 sm:pl-0">
                                  +${p.priceAud}
                                </span>
                              </div>
                            );
                          });
                        })()}
                  </div>
                </div>

                <TooltipProvider delayDuration={200}>
                  <div className="rounded-lg border border-border/90 bg-muted/20 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                    <div className="flex gap-3">
                      <ListChecks
                        className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground dark:text-gray-100">
                            Cleaner routine job checklist
                          </p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground ring-offset-background transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label="What is the routine job checklist?"
                              >
                                <CircleHelp className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="max-w-sm border-border/80 bg-popover p-3 text-left text-xs text-popover-foreground shadow-md"
                            >
                              <p className="mb-1.5 font-semibold text-foreground">Preview</p>
                              <p className="leading-relaxed text-muted-foreground">
                                When a job starts, these free tasks are added to the cleaner&apos;s
                                in-app checklist (alongside any top-ups from priced add-ons). They are
                                guidance only and do <span className="font-medium text-foreground">not</span> change
                                your suggested price. Tasks can be adjusted on the job if you and the
                                cleaner agree.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <p className="text-xs text-muted-foreground dark:text-gray-400">
                          Default free items for <strong className="font-medium text-foreground dark:text-gray-200">{serviceTypeLabel(serviceTypeWatched as ServiceTypeKey)}</strong>
                          {normalizeServiceType(serviceTypeWatched as ServiceTypeKey) === "bond_cleaning"
                            ? " — same defaults admins configure under Global Settings."
                            : " — from platform service settings (admin can adjust)."}
                        </p>
                        {freeRoutineChecklistLines.length > 0 ? (
                          <ul className="list-none space-y-1.5 border-t border-border/60 pt-2 dark:border-gray-700">
                            {freeRoutineChecklistLines.map((line, i) => (
                              <li
                                key={`${i}-${line.slice(0, 32)}`}
                                className="flex gap-2 text-sm leading-snug text-foreground dark:text-gray-200"
                              >
                                <span className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-500">✓</span>
                                <span>{line}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="border-t border-border/60 pt-2 text-xs text-muted-foreground dark:text-gray-500">
                            Standard platform tasks are applied when the job checklist is first created
                            (your admin can customize defaults in Global Settings).
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </TooltipProvider>

                <div className="space-y-2">
                  <Label htmlFor="propertyDescription">Property description</Label>
                  <Textarea
                    id="propertyDescription"
                    rows={4}
                    placeholder="e.g. Recently renovated kitchen, small second bathroom, focus on oven and rangehood..."
                    className="dark:bg-gray-800 dark:border-gray-700"
                    {...form.register("propertyDescription")}
                  />
                  <p className="text-[11px] text-muted-foreground dark:text-gray-500">
                    Optional — context about the property and clean for bidders. Separate from special
                    instructions; your street address is not repeated here.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instructions">Special instructions</Label>
                  <Textarea
                    id="instructions"
                    rows={4}
                    placeholder="e.g. Keys with agent, pet hair on carpets, walls need spot cleaning..."
                    className="dark:bg-gray-800 dark:border-gray-700"
                    {...form.register("instructions")}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="accessInstructions">Access &amp; keys</Label>
                    <FieldHelp label="Access help">
                      Lockbox codes, building entry, where to collect keys, parking — helps cleaners quote and plan.
                    </FieldHelp>
                  </div>
                  <Textarea
                    id="accessInstructions"
                    rows={3}
                    placeholder="e.g. Lockbox 1234 on front porch; visitor parking level B2…"
                    className="dark:bg-gray-800 dark:border-gray-700"
                    {...form.register("accessInstructions")}
                  />
                </div>

                {serviceTypeWatched === "deep_clean" && (
                  <div className="space-y-2">
                    <Label htmlFor="deepSpecialRequestsStep4">Special requests</Label>
                    <Textarea
                      id="deepSpecialRequestsStep4"
                      rows={3}
                      placeholder="Anything else we should know for this deep clean…"
                      className="dark:bg-gray-800 dark:border-gray-700"
                      {...form.register("deepSpecialRequests")}
                    />
                  </div>
                )}

                {serviceTypeWatched !== "airbnb_turnover" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>
                      {serviceTypeWatched === "bond_cleaning"
                        ? "Move-out date"
                        : serviceTypeWatched === "recurring_house_cleaning"
                          ? "Preferred first clean date"
                          : "Preferred service date"}
                      {serviceTypeWatched !== "bond_cleaning" && (
                        <span className="ml-1 font-normal text-muted-foreground dark:text-gray-500">
                          (optional)
                        </span>
                      )}
                    </Label>
                    <FieldHelp
                      label={
                        serviceTypeWatched === "bond_cleaning"
                          ? "Move-out date help"
                          : "Service date help"
                      }
                    >
                      {serviceTypeWatched === "bond_cleaning"
                        ? "When do you need the bond clean completed? Cleaners will use this to plan."
                        : serviceTypeWatched === "recurring_house_cleaning"
                          ? "If you have a target first visit, pick it here. You can fine-tune timing with your cleaner."
                          : "When would you like this clean done? You can coordinate exact timing with your cleaner after booking."}
                    </FieldHelp>
                  </div>
                  <Controller
                    control={form.control}
                    name="moveOutDate"
                    render={({ field }) => (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            type="button"
                            className={cn(
                              "w-full justify-start text-left font-normal dark:bg-gray-800 dark:border-gray-700",
                              !field.value && "text-muted-foreground dark:text-gray-400"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value
                              ? format(field.value, "d MMM yyyy")
                              : serviceTypeWatched === "bond_cleaning"
                                ? "Select move-out date"
                                : serviceTypeWatched === "recurring_house_cleaning"
                                  ? "Select preferred first clean"
                                  : "Select preferred date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(d) => field.onChange(d ?? undefined)}
                            fromDate={new Date()}
                          />
                        </PopoverContent>
                      </Popover>
                    )}
                  />
                  {form.formState.errors.moveOutDate && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.moveOutDate.message}
                    </p>
                  )}
                </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 5: Auction settings */}
          {step === 5 && (
            <TooltipProvider delayDuration={300}>
              <Card className="border-border shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <CardHeader>
                  <CardTitle className="text-lg dark:text-gray-100">
                    Auction settings
                  </CardTitle>
                  <CardDescription className="dark:text-gray-400">
                    Set your starting price and how long cleaners can bid.
                  </CardDescription>
                  {minPhotosPublish > 0 && initialPhotoFiles.length < minPhotosPublish && (
                    <p className="mt-2 text-base text-amber-600 dark:text-amber-400 md:text-sm">
                      Add at least {minPhotosPublish} initial condition photos in step 3 to publish (
                      {initialPhotoFiles.length} of {minPhotosPublish} so far).
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-6 p-5 pt-0 md:p-6 md:pt-0">
                <div className="rounded-lg border border-border bg-muted/25 p-4 dark:border-gray-700 dark:bg-gray-800/40">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-foreground dark:text-gray-100">
                        Initial condition photos
                      </p>
                      <p className="text-xs text-muted-foreground dark:text-gray-400">
                        {initialPhotoFiles.length}/{PHOTO_LIMITS.LISTING_INITIAL} photos
                        {minPhotosPublish > 0 && initialPhotoFiles.length < minPhotosPublish
                          ? ` · at least ${minPhotosPublish} required to publish`
                          : minPhotosPublish === 0
                            ? " · photos optional for recurring"
                            : ""}
                        . Add more before you publish if you forgot any angles.
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="gap-1.5"
                        disabled={
                          uploading ||
                          photoStagingCount > 0 ||
                          initialPhotoFiles.length >= PHOTO_LIMITS.LISTING_INITIAL
                        }
                        onClick={() => initialPhotosInputRef.current?.click()}
                      >
                        <ImagePlus className="h-4 w-4" />
                        Add more photos
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setStep(3)}>
                        Step 3 — cover &amp; remove
                      </Button>
                    </div>
                  </div>
                  {initialPhotoPreviews.length > 0 && (
                    <div className="mt-3 flex max-w-full gap-2 overflow-x-auto pb-1">
                      {initialPhotoPreviews.map((url, i) => (
                        <div
                          key={`quick-${url}-${i}`}
                          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted dark:border-gray-600"
                        >
                          <Image
                            src={url}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="56px"
                            unoptimized
                          />
                          {coverPhotoIndex === i && (
                            <span className="absolute bottom-0 left-0 right-0 bg-primary/90 py-0.5 text-center text-[9px] font-medium text-primary-foreground">
                              Cover
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {allowLowAmountListings && (
                  <Alert className="border-sky-200 bg-sky-50/90 text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
                    <AlertDescription className="text-xs sm:text-sm">
                      <strong className="font-semibold">Low starting prices enabled</strong> — Admin has allowed
                      starting amounts below the usual ${DEFAULT_MIN_LISTING_STARTING_PRICE_AUD} minimum (for payment
                      testing). Stripe and card networks may still reject very small charges.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="rounded-lg border border-border bg-muted/30 px-3 py-3 text-sm dark:border-gray-700 dark:bg-gray-800/50">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-400">
                    Price calculator (before your starting bid)
                  </p>
                  <dl className="mt-2 space-y-1.5">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground dark:text-gray-400">Base (property)</dt>
                      <dd className="tabular-nums font-medium">
                        {formatAudFromCents(Math.round(pricingParts.baseCoreAud * 100))}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground dark:text-gray-400">Add-ons (extras)</dt>
                      <dd className="tabular-nums font-medium">
                        {formatAudFromCents(Math.round(pricingParts.extrasAud * 100))}
                      </dd>
                    </div>
                    {pricingParts.adjustmentAud !== 0 ? (
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground dark:text-gray-400">
                          Recurring adjustment (×{pricingParts.recurringMult.toFixed(2)})
                        </dt>
                        <dd
                          className={cn(
                            "tabular-nums font-medium",
                            pricingParts.adjustmentAud < 0
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-amber-800 dark:text-amber-300"
                          )}
                        >
                          {pricingParts.adjustmentAud > 0 ? "+" : ""}
                          {formatAudFromCents(Math.round(pricingParts.adjustmentAud * 100))}
                        </dd>
                      </div>
                    ) : null}
                    <div className="flex justify-between gap-2 border-t border-border pt-1.5 dark:border-gray-600">
                      <dt className="font-medium text-foreground dark:text-gray-200">Suggested subtotal</dt>
                      <dd className="tabular-nums font-semibold text-foreground dark:text-gray-100">
                        {formatAudFromCents(Math.round(pricingParts.adjustedTotalAud * 100))}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-[11px] text-muted-foreground dark:text-gray-500">
                    Service Fee for this job type is {effectiveFeePercent}% (admin default or per-type override). Your
                    starting price below may match or differ from this suggestion.
                  </p>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-red-200/80 bg-red-50/50 px-3 py-3 dark:border-red-900/50 dark:bg-red-950/30">
                  <Checkbox
                    id="isUrgent"
                    checked={form.watch("isUrgent")}
                    onCheckedChange={(c) =>
                      form.setValue("isUrgent", c === true, { shouldValidate: true })
                    }
                    className="mt-0.5"
                  />
                  <div className="min-w-0 space-y-0.5">
                    <Label htmlFor="isUrgent" className="cursor-pointer text-sm font-semibold text-foreground">
                      Mark as urgent
                    </Label>
                    <p className="text-xs text-muted-foreground dark:text-gray-400">
                      Highlights your job to cleaners (red urgency on the map and in search). Use when you&apos;re
                      on a tight deadline.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between md:gap-3">
                    <Label htmlFor="reservePrice" className="shrink-0 text-sm">
                      Starting price (AUD)
                    </Label>
                    {startingPriceBelowSuggested && (
                      <p
                        className="text-[11px] font-medium leading-tight text-destructive max-md:max-w-[min(100%,22rem)] md:shrink-0 md:text-right md:text-xs md:leading-snug md:whitespace-nowrap"
                        role="status"
                        aria-live="polite"
                      >
                        Lower amount less than{" "}
                        <span className="tabular-nums">
                          {formatAudFromCents(Math.round(estimatedPrice * 100))}
                        </span>{" "}
                        AUD may receive less bids…
                      </p>
                    )}
                  </div>
                  <Input
                    id="reservePrice"
                    type="number"
                    min={minReserveAud}
                    step={allowLowAmountListings ? "0.01" : "1"}
                    inputMode="decimal"
                    className="dark:bg-gray-800 dark:border-gray-700"
                    {...form.register("reservePrice", {
                      valueAsNumber: true,
                      onChange: (e) => {
                        setReserveTouched(true);
                        form.setValue("reservePrice", Number(e.target.value), { shouldValidate: true });
                      },
                    })}
                  />
                  {form.formState.errors.reservePrice && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.reservePrice.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground dark:text-gray-400">
                    Cleaners bid down from the starting price. Your bond is most likely returned if the final price covers this amount.
                  </p>
                  {typeof reservePriceWatched === "number" &&
                    reservePriceWatched > 0 &&
                    reserveFeeCents > 0 && (
                      <div
                        className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm dark:border-gray-700 dark:bg-gray-800/60"
                        role="status"
                        aria-live="polite"
                      >
                        <p className="border-l-2 border-emerald-500/45 pl-2.5 text-sm font-semibold uppercase tracking-wide text-foreground dark:border-emerald-400/40 dark:text-gray-100">
                          Payment breakdown
                        </p>
                        <dl className="mt-2 space-y-2 text-sm">
                          <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                            <dt className="text-muted-foreground dark:text-gray-400">Starting bid amount</dt>
                            <dd className="text-base font-medium tabular-nums text-foreground dark:text-gray-100 sm:text-lg">
                              {formatAudFromCents(Math.round(reservePriceWatched * 100))}
                            </dd>
                          </div>
                          <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                            <dt className="text-muted-foreground dark:text-gray-400">
                              Service Fee ({effectiveFeePercent}%)
                            </dt>
                            <dd className="text-base font-medium tabular-nums text-foreground dark:text-gray-100 sm:text-lg">
                              {formatAudFromCents(reserveFeeCents)}
                            </dd>
                          </div>
                          <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                            <dt className="text-muted-foreground dark:text-gray-400">
                              Net to cleaner (at this starting bid)
                            </dt>
                            <dd className="text-base font-semibold tabular-nums text-emerald-800 dark:text-emerald-300 sm:text-lg">
                              {formatAudFromCents(Math.round(reservePriceWatched * 100))}
                            </dd>
                          </div>
                          <div className="border-t border-border pt-2 dark:border-gray-600">
                            <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                              <dt className="font-semibold text-foreground dark:text-gray-100 sm:max-w-[min(100%,20rem)]">
                                <span className="inline-flex items-center gap-1">
                                  Amount paid to cleaner + fee
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-offset-2 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                                        aria-label="How fee and total price change with bids"
                                      >
                                        <CircleHelp className="h-3.5 w-3.5" aria-hidden />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[260px] text-left">
                                      {"Fee & total price will be less with more bids"}
                                    </TooltipContent>
                                  </Tooltip>
                                </span>
                              </dt>
                              <dd className="text-xl font-semibold tabular-nums text-primary dark:text-blue-300 sm:text-2xl">
                                {formatAudFromCents(
                                  Math.round(reservePriceWatched * 100) + reserveFeeCents
                                )}
                              </dd>
                            </div>
                          </div>
                        </dl>
                        <p className="mt-2 text-[11px] leading-snug text-muted-foreground dark:text-gray-500 sm:text-xs">
                          The fee covers secure payments, escrow, and support. Shown again at checkout.
                        </p>
                      </div>
                    )}
                </div>

                <div className="space-y-2">
                  <Label>Auction duration</Label>
                  <Controller
                    control={form.control}
                    name="durationDays"
                    render={({ field }) => (
                      <RadioGroup
                        value={String(field.value)}
                        onValueChange={(v) => field.onChange(Number(v))}
                        className={cn(
                          "grid grid-cols-2 gap-2",
                          durationOptions.length >= 5 ? "sm:grid-cols-5" : "sm:grid-cols-4"
                        )}
                      >
                        {durationOptions.map((days) => (
                          <label
                            key={days}
                            className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-3 text-sm dark:border-gray-700 dark:hover:bg-gray-800"
                          >
                            <RadioGroupItem value={String(days)} />
                            <span className="dark:text-gray-200">
                              {formatAuctionDurationChoiceLabel(days)}
                            </span>
                          </label>
                        ))}
                      </RadioGroup>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="buyNowPrice">Buy now price (optional)</Label>
                  <Input
                    id="buyNowPrice"
                    type="number"
                    min={0}
                    inputMode="decimal"
                    placeholder="Leave blank for auction only"
                    className="dark:bg-gray-800 dark:border-gray-700"
                    {...form.register("buyNowPrice")}
                  />
                  {form.formState.errors.buyNowPrice && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.buyNowPrice.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground dark:text-gray-400">
                    Cleaners can accept this price instantly. Must be lower than starting price.
                  </p>
                  {Number.isFinite(buyNowNum) && buyNowNum > 0 && buyNowFeeCents > 0 && (
                    <div
                      className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm dark:border-gray-700 dark:bg-gray-800/60"
                      role="status"
                      aria-live="polite"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-400">
                        Payment transparency (buy now)
                      </p>
                      <dl className="mt-2 space-y-2 text-sm">
                        <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                          <dt className="text-muted-foreground dark:text-gray-400">Job amount (buy now)</dt>
                          <dd className="text-base font-medium tabular-nums text-foreground dark:text-gray-100 sm:text-lg">
                            {formatAudFromCents(Math.round(buyNowNum * 100))}
                          </dd>
                        </div>
                        <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                          <dt className="text-muted-foreground dark:text-gray-400">
                            Service Fee ({effectiveFeePercent}%)
                          </dt>
                          <dd className="text-base font-medium tabular-nums text-foreground dark:text-gray-100 sm:text-lg">
                            {formatAudFromCents(buyNowFeeCents)}
                          </dd>
                        </div>
                        <div className="border-t border-border pt-2 dark:border-gray-600">
                          <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                            <dt className="font-semibold text-foreground dark:text-gray-100 sm:max-w-[min(100%,20rem)]">
                              <span className="inline-flex items-center gap-1">
                                Amount paid to cleaner + fee
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-offset-2 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                                      aria-label="How fee and total price change with bids"
                                    >
                                      <CircleHelp className="h-3.5 w-3.5" aria-hidden />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[260px] text-left">
                                    {"Fee & total price will be less with more bids"}
                                  </TooltipContent>
                                </Tooltip>
                              </span>
                            </dt>
                            <dd className="text-xl font-semibold tabular-nums text-primary dark:text-blue-300 sm:text-2xl">
                              {formatAudFromCents(Math.round(buyNowNum * 100) + buyNowFeeCents)}
                            </dd>
                          </div>
                        </div>
                      </dl>
                      <p className="mt-2 text-[11px] leading-snug text-muted-foreground dark:text-gray-500 sm:text-xs">
                        Applies if a cleaner secures the job at this buy-now price.
                      </p>
                    </div>
                  )}
                </div>
                </CardContent>
              </Card>
            </TooltipProvider>
          )}

          {submitError && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-base font-medium text-destructive md:border-0 md:bg-transparent md:p-0 md:text-sm md:font-normal"
            >
              {submitError}
            </p>
          )}

          {/* Navigation */}
          <div className="flex flex-col-reverse gap-3 pt-2 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-4 md:pt-0">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="h-12 min-h-[48px] w-full gap-2 md:h-10 md:min-h-0 md:w-auto"
            >
              <ChevronLeft className="h-5 w-5 md:h-4 md:w-4" />
              Back
            </Button>
            {step < 5 ? (
              <Button
                type="button"
                size="lg"
                onClick={async () => {
                  let ok = true;
                  if (step === 1) {
                    const st = serviceTypeWatched as ServiceTypeKey;
                    const fields: (
                      | "propertyType"
                      | "bedrooms"
                      | "bathrooms"
                      | "propertyCondition"
                      | "propertyLevels"
                      | "moveOutDate"
                      | "recurringFrequency"
                      | "recurringSeriesStartDate"
                      | "deepCleanIntensity"
                    )[] = ["bedrooms", "bathrooms"];
                    if (st === "bond_cleaning") {
                      fields.push(
                        "propertyType",
                        "propertyCondition",
                        "propertyLevels"
                      );
                    }
                    if (st === "airbnb_turnover") {
                      fields.push("moveOutDate");
                    }
                    if (st === "recurring_house_cleaning") {
                      fields.push("recurringFrequency", "recurringSeriesStartDate");
                    }
                    if (st === "deep_clean") {
                      fields.push("deepCleanIntensity");
                    }
                    ok = await form.trigger(fields);
                  } else if (step === 2) {
                    ok = await form.trigger(["suburb", "postcode"]);
                  } else if (step === 4) {
                    if (serviceTypeWatched === "bond_cleaning") {
                      ok = await form.trigger(["moveOutDate"]);
                    } else {
                      ok = true;
                    }
                  }
                  if (ok) setStep((s) => s + 1);
                }}
                className="h-12 min-h-[48px] w-full gap-2 md:h-10 md:min-h-0 md:w-auto"
              >
                Next
                <ChevronRight className="h-5 w-5 md:h-4 md:w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                disabled={
                  isSubmitting ||
                  uploading ||
                  initialPhotoFiles.length < minPhotosPublish ||
                  initialPhotoFiles.length > PHOTO_LIMITS.LISTING_INITIAL
                }
                className="h-12 min-h-[48px] w-full bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 md:h-10 md:min-h-0 md:w-auto"
                onClick={async () => {
                  const ok = await form.trigger();
                  if (!ok) return;
                  setPublishConfirmOpen(true);
                }}
              >
                {isSubmitting || uploading
                  ? "Creating listing…"
                  : "Publish listing"}
              </Button>
            )}
          </div>

          <Dialog open={publishConfirmOpen} onOpenChange={setPublishConfirmOpen}>
            <DialogContent className="max-w-md border-emerald-200 bg-emerald-50 text-emerald-950 shadow-xl dark:border-emerald-800 dark:bg-emerald-950/95 dark:text-emerald-50">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                  Publish listing
                </DialogTitle>
                <DialogDescription className="text-left text-base text-emerald-800/95 dark:text-emerald-50/90">
                  Are you sure you want to list? No payment required yet.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-100 dark:hover:bg-emerald-900"
                  onClick={() => setPublishConfirmOpen(false)}
                >
                  Not now
                </Button>
                <Button
                  type="button"
                  className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  disabled={
                    isSubmitting ||
                    uploading ||
                    initialPhotoFiles.length < minPhotosPublish
                  }
                  onClick={() => {
                    setPublishConfirmOpen(false);
                    void form.handleSubmit(onSubmit)();
                  }}
                >
                  Yes, list it
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </form>
      </section>
  );
}
