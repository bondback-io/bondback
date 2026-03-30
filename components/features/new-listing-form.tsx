"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { FormSavingOverlay } from "@/components/ui/form-saving-overlay";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { buildListingInsertRow } from "@/lib/listings";
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
import {
  CalendarIcon,
  CheckCircle2,
  CircleHelp,
  ImagePlus,
  MapPin,
  Hash,
  ChevronRight,
  ChevronLeft,
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
import {
  validatePhotoFiles,
  PHOTO_LIMITS,
  PHOTO_VALIDATION,
  checkImageHeader,
} from "@/lib/photo-validation";
import { uploadProcessedPhotos } from "@/lib/actions/upload-photos";
import {
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

const listingAddonZodEnum = z.enum(
  LISTING_ADDON_KEYS as unknown as [string, ...string[]]
);

const propertyTypes = ["apartment", "house", "townhouse", "studio"] as const;
type PropertyType = (typeof propertyTypes)[number];

const specialAreaKeys = ["balcony", "garage", "laundry", "patio"] as const;
type SpecialAreaKey = (typeof specialAreaKeys)[number];

const durationOptions = [1, 3, 5, 7] as const;

const propertyConditionKeys = [
  "excellent_very_good",
  "good",
  "fair_average",
  "poor_bad",
] as const;

/** Minimum starting price (AUD) for new listings — auction settings. */
const MIN_LISTING_STARTING_PRICE_AUD = 100;

const listingSchema = z
  .object({
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
    addons: z.array(listingAddonZodEnum).default([]),
    instructions: z.string().max(2000).optional(),
    moveOutDate: z.date({ required_error: "Select your move-out date" }),
    reservePrice: z.coerce.number().min(
      MIN_LISTING_STARTING_PRICE_AUD,
      `Starting price must be at least $${MIN_LISTING_STARTING_PRICE_AUD} AUD`
    ),
    durationDays: z.coerce.number().int().min(1),
    buyNowPrice: z.string().optional(),
  })
  .superRefine((data, ctx) => {
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
  });

type ListingFormValues = z.infer<typeof listingSchema>;

function calculateEstimatedPrice(
  values: ListingFormValues,
  pricingModifiers: PricingModifiersConfig
): number {
  const baseAud = computeBaseListingPriceAud(pricingModifiers, {
    bedrooms: values.bedrooms,
    condition: values.propertyCondition as PropertyConditionKey,
    levels: values.propertyLevels as PropertyLevelsKey,
  });
  const beds = values.bedrooms;
  const addonsTotal = (values.addons ?? []).reduce(
    (sum, key) =>
      sum +
      getListingAddonPriceFromModifiers(
        pricingModifiers,
        key as ListingAddonKey,
        beds
      ),
    0
  );
  return baseAud + addonsTotal;
}

type SuburbRow = { suburb: string; postcode: string | number; state: string | null };

/** Platform fee % (lister pays on top of job amount at payment). Matches job payment breakdown. */
export type NewListingFormProps = {
  listerId: string;
  listerSuburb: string;
  listerPostcode?: string | null;
  feePercentage?: number;
  pricingModifiers: PricingModifiersConfig;
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
  pricingModifiers,
}: NewListingFormProps) {
  const router = useRouter();
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
  const [created, setCreated] = useState(false);
  const [createdListingId, setCreatedListingId] = useState<string | null>(null);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);

  // Suburb autocomplete
  const [suburbQuery, setSuburbQuery] = useState("");
  const [suburbOpen, setSuburbOpen] = useState(false);
  const [suburbResults, setSuburbResults] = useState<SuburbRow[]>([]);
  const [isPendingSuburb, startSuburbTransition] = useTransition();
  const [, startSubmitTransition] = useTransition();
  const [submitPhase, setSubmitPhase] = useState<"idle" | "creating" | "uploading">("idle");
  const [photoStagingCount, setPhotoStagingCount] = useState(0);

  const form = useForm<ListingFormValues>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
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
      instructions: "",
      moveOutDate: undefined as unknown as Date,
      reservePrice: computeBaseListingPriceAud(pricingModifiers, {
        bedrooms: 2,
        condition: "excellent_very_good",
        levels: "1",
      }),
      durationDays: 3,
      buyNowPrice: "",
    },
  });

  const watchedValues = form.watch();
  const reservePriceWatched = form.watch("reservePrice");
  const buyNowPriceWatched = form.watch("buyNowPrice");
  const reserveFeeCents = useMemo(
    () =>
      platformFeeCents(
        typeof reservePriceWatched === "number" && reservePriceWatched > 0 ? reservePriceWatched : 0,
        feePercentage
      ),
    [reservePriceWatched, feePercentage]
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
        feePercentage
      ),
    [buyNowNum, feePercentage]
  );
  const estimatedPrice = useMemo(
    () => calculateEstimatedPrice(watchedValues, pricingModifiers),
    [watchedValues, pricingModifiers]
  );
  /** True when user set starting price below the live calculated estimate (property + add-ons). */
  const startingPriceBelowSuggested =
    typeof reservePriceWatched === "number" &&
    Number.isFinite(reservePriceWatched) &&
    reservePriceWatched > 0 &&
    reservePriceWatched < estimatedPrice;

  // When special areas change in step 1, sync them into addons (auto-add/remove).
  useEffect(() => {
    const special = watchedValues.specialAreas ?? [];
    const currentAddons = watchedValues.addons ?? [];
    const nonSpecialAddons = currentAddons.filter(
      (a) => !(specialAreaKeys as readonly string[]).includes(a)
    );
    const merged = [...new Set([...nonSpecialAddons, ...special])] as ListingAddonKey[];
    if (
      merged.length !== currentAddons.length ||
      merged.some((a, i) => a !== currentAddons[i])
    ) {
      form.setValue("addons", merged, { shouldValidate: true });
    }
  }, [watchedValues.specialAreas, form]);

  useEffect(() => {
    if (!reserveTouched) {
      form.setValue("reservePrice", estimatedPrice, { shouldValidate: true });
    }
  }, [estimatedPrice, form, reserveTouched]);

  useEffect(() => {
    const sub = form.getValues("suburb");
    if (sub) setSuburbQuery(sub);
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
      setSubmitPhase("creating");
    });

    try {
      const reserve = values.reservePrice;
      const buyNow = values.buyNowPrice?.trim()
        ? Number(values.buyNowPrice)
        : null;
      const startingPrice = calculateEstimatedPrice(values, pricingModifiers);
      if (buyNow != null && buyNow >= startingPrice) {
        setSubmitError("Buy-now price must be lower than the starting bid price.");
        return;
      }

      const durationDays = values.durationDays;
      const moveOutDateStr = format(values.moveOutDate, "yyyy-MM-dd");
      const endTime = new Date(
        Date.now() + durationDays * 24 * 60 * 60 * 1000
      ).toISOString();

      const specialParts = values.specialAreas.length
        ? `Special areas: ${values.specialAreas.join(", ")}. `
        : "";
      const instructions = [specialParts, values.instructions ?? ""].filter(Boolean).join("").trim() || null;

      const title = `${values.bedrooms} ${values.bedrooms === 1 ? "Bedroom" : "Bedrooms"} + ${values.bathrooms} ${values.bathrooms === 1 ? "Bathroom" : "Bathrooms"} ${values.propertyType.charAt(0).toUpperCase() + values.propertyType.slice(1)} in ${values.suburb}`;

      if (initialPhotoFiles.length > PHOTO_LIMITS.LISTING_INITIAL) {
        toast({
          variant: "destructive",
          title: "Too many photos",
          description: `Max ${PHOTO_LIMITS.LISTING_INITIAL} initial condition photos allowed.`,
        });
        return;
      }
      if (initialPhotoFiles.length < PHOTO_LIMITS.LISTING_INITIAL_MIN_PUBLISH) {
        toast({
          variant: "destructive",
          title: "Initial photos required",
          description: `Upload at least ${PHOTO_LIMITS.LISTING_INITIAL_MIN_PUBLISH} initial condition photos (step 3) before publishing.`,
        });
        return;
      }

      const row = buildListingInsertRow({
        lister_id: listerId,
        title,
        description: instructions,
        property_address: values.propertyAddress?.trim() || null,
        suburb: values.suburb,
        postcode: values.postcode,
        property_type: values.propertyType,
        bedrooms: values.bedrooms,
        bathrooms: values.bathrooms,
        addons: [...new Set(values.addons)],
        special_instructions: instructions,
        move_out_date: moveOutDateStr,
        photo_urls: null,
        reserve_cents: Math.round(reserve * 100),
        reserve_price: Math.round(reserve * 100),
        buy_now_cents: buyNow ? Math.round(buyNow * 100) : null,
        base_price: Math.round(startingPrice * 100),
        starting_price_cents: Math.round(startingPrice * 100),
        current_lowest_bid_cents: Math.round(startingPrice * 100),
        duration_days: durationDays,
        status: "live",
        end_time: endTime,
        end_date: endTime.slice(0, 10),
        platform_fee_percentage: Math.max(0, Math.min(30, Number(feePercentage) || 12)),
        preferred_dates: [moveOutDateStr],
        property_condition: values.propertyCondition,
        property_levels: values.propertyLevels,
      });

      const { data: inserted, error } = await supabase
        .from("listings")
        .insert(row as never)
        .select("id")
        .maybeSingle();

      if (error || !inserted) {
        const msg = error?.message ?? "Failed to create listing.";
        setSubmitError(msg);
        toast({ variant: "destructive", title: "Error", description: msg });
        return;
      }

      const listingId = String((inserted as { id: string }).id);
      const total = initialPhotoFiles.length;
      const uploadedUrls: string[] = [];

      setSubmitPhase("uploading");
      setFileStatuses(initialPhotoFiles.map(() => ({ status: "pending" as const })));
      setUploading(true);
      try {
        for (let i = 0; i < initialPhotoFiles.length; i++) {
          setFileStatuses((prev) =>
            prev.map((s, j) => (j === i ? { ...s, status: "uploading" as const } : s))
          );
          setUploadProgress(total > 0 ? Math.round(((i + 1) / total) * 100) : 0);
          const file = initialPhotoFiles[i];
          if (!file) continue;
          const fd = new FormData();
          fd.append("file", file);
          const { results, error: actionError } = await uploadProcessedPhotos(fd, {
            bucket: "condition-photos",
            pathPrefix: `listings/${listingId}/initial`,
            maxFiles: 1,
            generateThumb: true,
          });
          const res = results[0];
          if (actionError || !res?.url) {
            const err = res?.error ?? actionError ?? "Upload failed";
            setFileStatuses((prev) =>
              prev.map((s, j) => (j === i ? { ...s, status: "error" as const, error: err } : s))
            );
            setSubmitError(err);
            toast({ variant: "destructive", title: "Upload failed", description: `${file.name}: ${err}` });
            return;
          }
          uploadedUrls.push(res.url);
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

      if (uploadedUrls.length > 0) {
        const updateResult = await updateListingInitialPhotos(listingId, uploadedUrls);
        if (!updateResult.ok) {
          setSubmitError(updateResult.error);
          toast({
            variant: "destructive",
            title: "Photos uploaded but save failed",
            description: updateResult.error,
          });
          return;
        }
        const coverUrl =
          uploadedUrls[Math.min(coverPhotoIndex, uploadedUrls.length - 1)] ?? uploadedUrls[0];
        const coverRes = await updateListingCoverPhoto(listingId, coverUrl ?? null);
        if (!coverRes.ok) {
          toast({
            variant: "destructive",
            title: "Cover photo not saved",
            description: coverRes.error,
          });
        }
      }

      setCreatedListingId(listingId);
      setCreated(true);
      // SMS (Twilio) + push (Expo) to cleaners within max_travel_km — fire-and-forget
      void triggerNewListingJobAlerts(listingId).catch(() => {
        /* non-blocking */
      });
      void notifyListerListingLive(listingId).catch(() => {
        /* non-blocking */
      });
      toast({
        title: "Listing created",
        description: "Cleaners can now bid on your bond clean.",
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Something went wrong while publishing.";
      setSubmitError(msg);
      toast({ variant: "destructive", title: "Error", description: msg });
    } finally {
      setIsSubmitting(false);
      setSubmitPhase("idle");
    }
  };

  if (created) {
    return (
      <section className="page-inner">
        <Card className="mx-auto max-w-xl border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30">
          <CardHeader className="flex flex-col items-center gap-2 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
            <CardTitle className="text-xl dark:text-gray-100">
              Listing created successfully
            </CardTitle>
            <CardDescription className="text-base md:text-sm dark:text-gray-400">
              Cleaners can now review your details and start bidding.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild variant="outline" size="lg" className="w-full min-h-12 sm:w-auto md:min-h-0">
              <Link href="/lister/dashboard">Go to dashboard</Link>
            </Button>
            <Button asChild size="lg" className="w-full min-h-12 sm:w-auto md:min-h-0">
              <Link
                href={
                  createdListingId ? `/jobs/${createdListingId}` : "/my-listings"
                }
              >
                View my listing
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="page-inner relative space-y-6 pb-12 md:space-y-6">
        <FormSavingOverlay
          show={isSubmitting}
          variant="screen"
          title={submitPhase === "uploading" ? "Uploading photos…" : "Creating listing…"}
          description="Hang tight — this usually takes a few seconds on mobile networks."
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
                New bond clean listing
              </p>
            </div>
            <h1 className="text-2xl font-bold leading-[1.15] tracking-tight text-foreground dark:text-gray-50 sm:text-3xl">
              Post your job and get cleaner bids
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground dark:text-gray-400 sm:text-base">
              You&apos;re on the create-listing flow: add your property, move-out date, photos, and pricing. Cleaners will see your listing and place competitive bids so you can choose the best offer.
            </p>
          </div>
        </header>

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
                              onClick={() => handleSuburbSelect(row)}
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
                  Upload clear before photos of the entire property. You need at least{" "}
                  {PHOTO_LIMITS.LISTING_INITIAL_MIN_PUBLISH} photos to publish; you can move on and come back. Select one photo as the cover—it will be shown on job cards.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-5 pt-0 md:p-6 md:pt-0">
                {initialPhotoFiles.length < PHOTO_LIMITS.LISTING_INITIAL_MIN_PUBLISH && (
                  <Alert variant="warning" className="px-4 py-3">
                    <AlertDescription className="space-y-1.5 text-xs leading-relaxed sm:text-sm">
                      <span className="block font-semibold text-amber-950 dark:text-amber-50">
                        {PHOTO_LIMITS.LISTING_INITIAL_MIN_PUBLISH} photos required to publish
                      </span>
                      <span className="block text-amber-900/95 dark:text-amber-100/95">
                        You have {initialPhotoFiles.length} of {PHOTO_LIMITS.LISTING_INITIAL_MIN_PUBLISH}. Add enough photos here before you can publish.
                        You can still use <strong className="font-medium">Next</strong> to continue the form and return to this step later.
                      </span>
                    </AlertDescription>
                  </Alert>
                )}
                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" variant="outline" size="lg" className="min-h-12 w-full gap-2 sm:w-auto md:min-h-0" asChild>
                      <label htmlFor="photos" className="cursor-pointer">
                        <ImagePlus className="h-5 w-5 md:h-4 md:w-4" />
                        Upload photos (3 to publish, max {PHOTO_LIMITS.LISTING_INITIAL})
                      </label>
                    </Button>
                    <input
                      id="photos"
                      type="file"
                      accept={PHOTO_VALIDATION.ACCEPT}
                      multiple
                      onChange={handlePhotosChange}
                      className="hidden"
                    />
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
                  {initialPhotoPreviews.length > 0 &&
                    initialPhotoPreviews.length < PHOTO_LIMITS.LISTING_INITIAL_MIN_PUBLISH && (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                      Add {PHOTO_LIMITS.LISTING_INITIAL_MIN_PUBLISH - initialPhotoPreviews.length} more photo
                      {PHOTO_LIMITS.LISTING_INITIAL_MIN_PUBLISH - initialPhotoPreviews.length === 1 ? "" : "s"} to meet the minimum for publishing.
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
                <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-800 dark:bg-emerald-950/40">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-200 max-md:text-sm">
                    Estimated price
                  </p>
                  <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">
                    ${estimatedPrice} AUD
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    Base from rate × bedrooms × condition × levels × base multiplier; then selected add-ons (carpet steam,
                    walls, and windows scale per bedroom).{" "}
                    {PROPERTY_CONDITION_OPTIONS.find((o) => o.value === watchedValues.propertyCondition)?.label ?? ""}
                    {", "}
                    {PROPERTY_LEVELS_OPTIONS.find((o) => o.value === watchedValues.propertyLevels)?.label ?? ""}.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Add-ons</Label>
                  <p className="text-xs text-muted-foreground dark:text-gray-400">
                    Special areas selected in step 1 are included here. Amounts follow platform pricing (admin-configurable).
                    Use special instructions if something is unusual.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {LISTING_ADDON_KEYS.map((key) => {
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
                    })}
                  </div>
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
                    <Label>Move-out date</Label>
                    <FieldHelp label="Move-out date help">
                      When do you need the bond clean completed? Cleaners will use this to plan.
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
                              : "Select move-out date"}
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
                  {initialPhotoFiles.length < PHOTO_LIMITS.LISTING_INITIAL_MIN_PUBLISH && (
                    <p className="mt-2 text-base text-amber-600 dark:text-amber-400 md:text-sm">
                      Add at least {PHOTO_LIMITS.LISTING_INITIAL_MIN_PUBLISH} initial condition photos in step 3 to publish (
                      {initialPhotoFiles.length} of {PHOTO_LIMITS.LISTING_INITIAL_MIN_PUBLISH} so far).
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-6 p-5 pt-0 md:p-6 md:pt-0">
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
                    min={MIN_LISTING_STARTING_PRICE_AUD}
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
                              Platform fee ({feePercentage}%)
                            </dt>
                            <dd className="text-base font-medium tabular-nums text-foreground dark:text-gray-100 sm:text-lg">
                              {formatAudFromCents(reserveFeeCents)}
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
                        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                      >
                        {durationOptions.map((days) => (
                          <label
                            key={days}
                            className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-3 text-sm dark:border-gray-700 dark:hover:bg-gray-800"
                          >
                            <RadioGroupItem value={String(days)} />
                            <span className="dark:text-gray-200">
                              {days === 1 ? "1 day" : `${days} days`}
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
                            Platform fee ({feePercentage}%)
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
                    ok = await form.trigger([
                      "propertyType",
                      "bedrooms",
                      "bathrooms",
                      "propertyCondition",
                      "propertyLevels",
                    ]);
                  } else if (step === 2) {
                    ok = await form.trigger(["suburb", "postcode"]);
                  } else if (step === 4) {
                    ok = await form.trigger(["moveOutDate"]);
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
                  initialPhotoFiles.length < PHOTO_LIMITS.LISTING_INITIAL_MIN_PUBLISH ||
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
              <DialogFooter className="gap-2 sm:gap-0">
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
                    initialPhotoFiles.length < PHOTO_LIMITS.LISTING_INITIAL_MIN_PUBLISH
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
