"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAbnAutoSaveOnValid } from "@/hooks/use-abn-auto-save-on-valid";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { updateProfile, updateMaxTravelKm } from "@/lib/actions/profile";
import { validateAbnIfRequired } from "@/lib/actions/validate-abn";
import {
  VEHICLE_TYPES,
  CLEANER_SPECIALTIES,
  AVAILABILITY_DAYS,
  type VehicleType,
  type CleanerSpecialty,
} from "@/lib/types";
import {
  AU_STATES,
  type AuStateCode,
  type SuburbEntry,
} from "@/lib/au-suburbs";
import type { Database } from "@/types/supabase";
import { cn } from "@/lib/utils";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ImagePlus, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { OptimizedImage } from "@/components/ui/optimized-image";
import {
  validatePhotoFile,
  validatePhotoFiles,
  PHOTO_LIMITS,
  PHOTO_VALIDATION,
  checkImageHeader,
} from "@/lib/photo-validation";
import { uploadProcessedPhotos } from "@/lib/actions/upload-photos";
import {
  compressImage,
  formatPhotoUploadError,
} from "@/lib/utils/compressImage";
import { NEXT_IMAGE_SIZES_AVATAR_80 } from "@/lib/next-image-sizes";
import {
  clampRadiusKm,
  setStoredRadiusKm,
  JOBS_RADIUS_SYNC_SESSION_KEY,
} from "@/lib/jobs-radius-local";
import { useAbnLiveValidation } from "@/hooks/use-abn-live-validation";
import {
  AbnValidationInputRow,
  AbnLiveValidationMessages,
} from "@/components/features/abn-validation-ui";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const listerSchema = z.object({
  full_name: z.string().min(1, "Name is required"),
  phone: z
    .string()
    .min(1, "Phone is required")
    .refine(
      (v) => v.replace(/\D/g, "").length >= 9 && v.replace(/\D/g, "").length <= 11,
      "Valid Australian phone (9–11 digits)"
    ),
  date_of_birth: z.string().optional(),
  state: z.string().optional(),
  suburb: z.string().min(1, "Suburb is required"),
  postcode: z.string().optional(),
});

const cleanerSchema = listerSchema.extend({
  abn: z
    .string()
    .max(11)
    .refine(
      (v) => !v || v.replace(/\D/g, "").length === 11,
      "ABN must be 11 digits"
    )
    .optional(),
  max_travel_km: z.coerce.number().min(5).max(100),
  years_experience: z.coerce.number().min(0).max(50),
  vehicle_type: z.enum(VEHICLE_TYPES as unknown as [string, ...string[]]),
  bio: z.string().max(2000).optional(),
  business_name: z.string().max(200).optional(),
  insurance_policy_number: z.string().max(100).optional(),
  equipment_notes: z.string().max(1000).optional(),
});

type ListerValues = z.infer<typeof listerSchema>;
type CleanerValues = z.infer<typeof cleanerSchema>;

const defaultAvailability = () =>
  Object.fromEntries(AVAILABILITY_DAYS.map((d) => [d, false])) as Record<
    string,
    boolean
  >;

export type ProfileFormProps = {
  profile: ProfileRow;
  email: string | null;
};

export function ProfileForm({ profile, email }: ProfileFormProps) {
  const supabase = createBrowserSupabaseClient();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(
    profile.profile_photo_url
  );
  const [portfolioUrls, setPortfolioUrls] = useState<string[]>(
    Array.isArray(profile.portfolio_photo_urls)
      ? profile.portfolio_photo_urls
      : []
  );
  const [profilePhotoPhase, setProfilePhotoPhase] = useState<
    "idle" | "compressing" | "uploading"
  >("idle");
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);
  const [portfolioUploadPhase, setPortfolioUploadPhase] = useState<
    "idle" | "compressing" | "uploading"
  >("idle");
  const [, startPhotoTransition] = useTransition();
  const [portfolioPendingSlots, setPortfolioPendingSlots] = useState(0);
  const [availability, setAvailability] = useState<Record<string, boolean>>(
    (profile.availability as Record<string, boolean>) ?? defaultAvailability()
  );
  const [specialties, setSpecialties] = useState<string[]>(
    profile.specialties ?? []
  );
  const [cleanerSuburbSuggestions, setCleanerSuburbSuggestions] = useState<
    SuburbEntry[]
  >([]);
  const [listerSuburbSuggestions, setListerSuburbSuggestions] = useState<
    SuburbEntry[]
  >([]);
  const [distanceUnit, setDistanceUnit] = useState<"km" | "miles">("km");
  const [savingTravelRadius, setSavingTravelRadius] = useState(false);

  const roles = (profile.roles as string[] | null) ?? [];
  const activeRole = (profile.active_role as "lister" | "cleaner" | null) ?? null;
  const isCleaner = roles.includes("cleaner") && activeRole === "cleaner";

  const { toast } = useToast();
  const router = useRouter();

  const listerForm = useForm<ListerValues>({
    resolver: zodResolver(listerSchema),
    defaultValues: {
      full_name: profile.full_name ?? "",
      phone: profile.phone ?? "",
      date_of_birth: (profile as { date_of_birth?: string | null }).date_of_birth ?? "",
      state: (profile as any).state ?? "",
      suburb: profile.suburb ?? "",
      postcode: profile.postcode ?? "",
    },
  });

  const cleanerForm = useForm<CleanerValues>({
    resolver: zodResolver(cleanerSchema),
    defaultValues: {
      full_name: profile.full_name ?? "",
      phone: profile.phone ?? "",
      date_of_birth: (profile as { date_of_birth?: string | null }).date_of_birth ?? "",
      state: (profile as any).state ?? "",
      suburb: profile.suburb ?? "",
      postcode: profile.postcode ?? "",
      abn: (profile.abn ?? "").replace(/\D/g, "").slice(0, 11),
      max_travel_km: Math.min(100, Math.max(5, profile.max_travel_km ?? 30)),
      years_experience: profile.years_experience ?? 0,
      vehicle_type: (profile.vehicle_type as VehicleType) ?? "Car",
      bio: profile.bio ?? "",
      business_name: profile.business_name ?? "",
      insurance_policy_number: profile.insurance_policy_number ?? "",
      equipment_notes: profile.equipment_notes ?? "",
    },
  });

  const abnWatch = cleanerForm.watch("abn");
  const abnLiveValidation = useAbnLiveValidation(abnWatch ?? "");

  useAbnAutoSaveOnValid({
    enabled: isCleaner,
    abnRaw: abnWatch ?? "",
    validation: abnLiveValidation,
    storedAbn: profile.abn,
  });

  const handleProfilePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = validatePhotoFile(file);
    if (!result.valid) {
      toast({
        variant: "destructive",
        title: "Photo validation",
        description: result.error,
      });
      e.target.value = "";
      return;
    }
    setProfilePhotoPhase("compressing");
    let compressed: File;
    try {
      compressed = await compressImage(file);
    } catch {
      setProfilePhotoPhase("idle");
      toast({
        variant: "destructive",
        title: "Couldn’t prepare photo",
        description: "Try another image or take a new photo.",
      });
      e.target.value = "";
      return;
    }
    const header = await checkImageHeader(compressed);
    if (!header.valid) {
      setProfilePhotoPhase("idle");
      toast({
        variant: "destructive",
        title: "Photo validation",
        description: header.error,
      });
      e.target.value = "";
      return;
    }
    const revertUrl = profilePhotoUrl;
    const optimisticUrl = URL.createObjectURL(compressed);
    startPhotoTransition(() => {
      setProfilePhotoUrl(optimisticUrl);
      setProfilePhotoPhase("uploading");
    });
    setSubmitError(null);
    try {
      const fd = new FormData();
      fd.append("file", compressed);
      const { results, error: actionError } = await uploadProcessedPhotos(fd, {
        bucket: "profile-photos",
        pathPrefix: String(profile.id),
        maxFiles: 1,
        generateThumb: true,
      });
      const res = results[0];
      if (actionError || !res?.url) {
        const err = formatPhotoUploadError(
          res?.error ?? actionError ?? "Upload failed"
        );
        startPhotoTransition(() => setProfilePhotoUrl(revertUrl));
        URL.revokeObjectURL(optimisticUrl);
        setSubmitError(err);
        toast({ variant: "destructive", title: "Upload failed", description: err });
        return;
      }
      URL.revokeObjectURL(optimisticUrl);
      setProfilePhotoUrl(res.url);
      const updateResult = await updateProfile({ profile_photo_url: res.url });
      if (!updateResult.ok) setSubmitError(updateResult.error);
    } catch (err: unknown) {
      const msg = formatPhotoUploadError(err);
      startPhotoTransition(() => setProfilePhotoUrl(revertUrl));
      URL.revokeObjectURL(optimisticUrl);
      setSubmitError(msg);
      toast({ variant: "destructive", title: "Upload failed", description: msg });
    } finally {
      setProfilePhotoPhase("idle");
      e.target.value = "";
    }
  };

  const handlePortfolioPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const incoming = Array.from(files);
    const { validFiles, errors } = validatePhotoFiles(incoming, {
      maxFiles: PHOTO_LIMITS.PORTFOLIO,
      existingCount: portfolioUrls.length,
    });
    errors.forEach((err) => {
      toast({
        variant: "destructive",
        title: "Photo validation",
        description: err,
      });
    });
    if (validFiles.length === 0) {
      e.target.value = "";
      return;
    }
    setPortfolioUploadPhase("compressing");
    setUploadingPortfolio(true);
    const withHeaderCheck: File[] = [];
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
    if (withHeaderCheck.length === 0) {
      setPortfolioUploadPhase("idle");
      setUploadingPortfolio(false);
      e.target.value = "";
      return;
    }
    setPortfolioPendingSlots(withHeaderCheck.length);
    setPortfolioUploadPhase("uploading");
    setSubmitError(null);
    try {
      const fd = new FormData();
      withHeaderCheck.forEach((f) => fd.append("files", f));
      const { results, error: actionError } = await uploadProcessedPhotos(fd, {
        bucket: "profile-photos",
        pathPrefix: `${profile.id}/portfolio`,
        maxFiles: PHOTO_LIMITS.PORTFOLIO,
        existingCount: portfolioUrls.length,
        generateThumb: true,
      });
      if (actionError) {
        toast({
          variant: "destructive",
          title: "Upload failed",
          description: formatPhotoUploadError(actionError),
        });
      }
      const newUrls: string[] = [];
      results.forEach((r, i) => {
        if (r.error) {
          toast({
            variant: "destructive",
            title: "Upload failed",
            description: `${r.fileName}: ${formatPhotoUploadError(r.error)}`,
          });
        } else if (r.url) {
          newUrls.push(r.url);
        }
      });
      if (newUrls.length > 0) {
        const base = Array.isArray(portfolioUrls) ? portfolioUrls : [];
        const nextUrls = [...base, ...newUrls].slice(0, PHOTO_LIMITS.PORTFOLIO);
        setPortfolioUrls(nextUrls);
        updateProfile({ portfolio_photo_urls: nextUrls }).then((result) => {
          if (!result.ok) setSubmitError(result.error ?? undefined);
        });
      }
    } catch (err: unknown) {
      const msg = formatPhotoUploadError(err);
      setSubmitError(msg);
      toast({ variant: "destructive", title: "Upload failed", description: msg });
    } finally {
      setPortfolioUploadPhase("idle");
      setPortfolioPendingSlots(0);
      setUploadingPortfolio(false);
      e.target.value = "";
    }
  };

  const removePortfolioUrl = (url: string) => {
    const next = portfolioUrls.filter((u) => u !== url);
    setPortfolioUrls(next);
    updateProfile({
      portfolio_photo_urls: next.length > 0 ? next : null,
    }).then((result) => {
      if (!result.ok) setSubmitError(result.error ?? undefined);
    });
  };

  const toggleSpecialty = (s: string) => {
    setSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const onListerSubmit = async (values: ListerValues) => {
    setSubmitError(null);
    setIsSubmitting(true);
    const result = await updateProfile({
      full_name: values.full_name.trim(),
      phone: values.phone.trim(),
      date_of_birth: values.date_of_birth?.trim() || null,
      state: values.state || null,
      suburb: values.suburb.trim(),
      postcode: values.postcode?.trim() || null,
      profile_photo_url: profilePhotoUrl,
    });
    setIsSubmitting(false);
    if (!result.ok) setSubmitError(result.error);
  };

  const onCleanerSubmit = async (values: CleanerValues) => {
    setSubmitError(null);
    setIsSubmitting(true);
    const abnClean = (values.abn ?? "").replace(/\D/g, "").trim();
    if (abnClean.length === 11) {
      const abrResult = await validateAbnIfRequired(abnClean);
      if (!abrResult.ok) {
        setSubmitError(abrResult.error);
        setIsSubmitting(false);
        return;
      }
    }
    const result = await updateProfile({
      full_name: values.full_name.trim(),
      phone: values.phone.trim(),
      date_of_birth: values.date_of_birth?.trim() || null,
      state: values.state || null,
      suburb: values.suburb.trim(),
      postcode: values.postcode?.trim() || null,
      abn: abnClean.length === 11 ? abnClean : null,
      max_travel_km: values.max_travel_km,
      years_experience: values.years_experience,
      vehicle_type: values.vehicle_type,
      bio: values.bio?.trim() || null,
      business_name: values.business_name?.trim() || null,
      insurance_policy_number: values.insurance_policy_number?.trim() || null,
      equipment_notes: values.equipment_notes?.trim() || null,
      profile_photo_url: profilePhotoUrl,
      portfolio_photo_urls: portfolioUrls.length > 0 ? portfolioUrls : null,
      specialties: specialties.length > 0 ? specialties : null,
      availability: availability,
    });
    setIsSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    const prevKm = clampRadiusKm(
      Math.min(100, Math.max(5, profile.max_travel_km ?? 30))
    );
    const nextKm = clampRadiusKm(values.max_travel_km);
    if (prevKm !== nextKm) {
      setStoredRadiusKm(nextKm);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(JOBS_RADIUS_SYNC_SESSION_KEY, "1");
      }
    }
    router.refresh();
  };

  if (isCleaner) {
    return (
      <Card className="dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="dark:text-gray-100">Edit profile</CardTitle>
          <CardDescription className="dark:text-gray-400">
            Keep your details and availability up to date so listers can find you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-6"
            onSubmit={cleanerForm.handleSubmit(onCleanerSubmit)}
            noValidate
          >
            <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-800 dark:bg-emerald-950/40">
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <Label className="text-xs font-semibold text-emerald-900 dark:text-emerald-100">
                    Profile photo
                  </Label>
                  <p className="text-[11px] text-emerald-800/90 dark:text-emerald-200">
                    A friendly, clear photo helps you win more bond clean jobs.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                  {profilePhotoUrl ? (
                    <OptimizedImage
                      src={profilePhotoUrl}
                      alt="Profile"
                      width={80}
                      height={80}
                      sizes={NEXT_IMAGE_SIZES_AVATAR_80}
                      quality={75}
                      className="rounded-full object-cover ring-2 ring-emerald-500/80 dark:ring-emerald-500/60"
                    />
                  ) : (
                    <span className="text-xs font-medium text-emerald-900 dark:text-emerald-100">
                      No photo
                    </span>
                  )}
                </div>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-emerald-300 px-3 py-2 text-xs font-medium text-emerald-900 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-900/40">
                  <Input
                    type="file"
                    accept={PHOTO_VALIDATION.ACCEPT}
                    className="hidden"
                    onChange={handleProfilePhoto}
                    disabled={profilePhotoPhase !== "idle"}
                  />
                  <ImagePlus className="h-4 w-4" />
                  {profilePhotoPhase === "compressing"
                    ? "Optimizing photo…"
                    : profilePhotoPhase === "uploading"
                      ? "Uploading photo…"
                      : "Upload / replace photo (max 1)"}
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                {...cleanerForm.register("full_name")}
              />
              {cleanerForm.formState.errors.full_name && (
                <p className="text-base text-destructive md:text-xs">
                  {cleanerForm.formState.errors.full_name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email ?? ""} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone (Australian)</Label>
              <Input id="phone" type="tel" {...cleanerForm.register("phone")} />
              {cleanerForm.formState.errors.phone && (
                <p className="text-base text-destructive md:text-xs">
                  {cleanerForm.formState.errors.phone.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of birth (optional)</Label>
              <Input
                id="date_of_birth"
                type="date"
                {...cleanerForm.register("date_of_birth")}
              />
              <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                Used for birthday wishes from Bond Back. We don’t share this.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="abn">ABN (11 digits)</Label>
              <Controller
                name="abn"
                control={cleanerForm.control}
                render={({ field }) => (
                  <AbnValidationInputRow
                    id="abn"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="e.g. 12345678901"
                    maxLength={11}
                    validation={abnLiveValidation}
                    value={field.value ?? ""}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                      field.onChange(digits);
                    }}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                )}
              />
              <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                Australian Business Number. Required for professional cleaners; helps listers trust your profile.
              </p>
              <AbnLiveValidationMessages
                validation={abnLiveValidation}
                detailsId="abn-validated-abn-details"
              />
              {cleanerForm.formState.errors.abn && (
                <p className="text-base text-destructive md:text-xs">
                  {cleanerForm.formState.errors.abn.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>My location</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="state">State</Label>
                  <Controller
                    control={cleanerForm.control}
                    name="state"
                    render={({ field }) => (
                      <Select
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger id="state">
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          {AU_STATES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-1 relative">
                  <Label htmlFor="suburb">Suburb</Label>
                  <Input
                    id="suburb"
                    {...cleanerForm.register("suburb")}
                    onChange={(e) => {
                      const field = cleanerForm.register("suburb");
                      field.onChange(e);
                      const value = e.target.value.trim();
                      if (value.length < 2) {
                        setCleanerSuburbSuggestions([]);
                        return;
                      }
                      const stateCode = (cleanerForm.watch("state") ||
                        null) as AuStateCode | null;
                      supabase
                        .from("suburbs")
                        .select("suburb, postcode, state")
                        .ilike("suburb", `${value}%`)
                        .order("suburb")
                        .limit(8)
                        .then(({ data, error }) => {
                          if (error || !data) {
                            setCleanerSuburbSuggestions([]);
                            return;
                          }
                          const rows = data as SuburbEntry[];
                          const filtered = stateCode
                            ? rows.filter((s) => s.state === stateCode)
                            : rows;
                          setCleanerSuburbSuggestions(filtered);
                        });
                    }}
                  />
                  {cleanerForm.formState.errors.suburb && (
                    <p className="text-base text-destructive md:text-xs">
                      {cleanerForm.formState.errors.suburb.message}
                    </p>
                  )}
                  {cleanerSuburbSuggestions.length > 0 && (
                    <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover text-sm shadow-md dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
                      {cleanerSuburbSuggestions.map((s) => (
                        <li
                          key={`${s.suburb}-${s.postcode}-${s.state}`}
                          className="cursor-pointer px-2 py-1 hover:bg-muted dark:hover:bg-gray-800"
                          onClick={() => {
                            cleanerForm.setValue("suburb", s.suburb, {
                              shouldValidate: true,
                            });
                            cleanerForm.setValue("postcode", s.postcode, {
                              shouldValidate: true,
                            });
                            setCleanerSuburbSuggestions([]);
                          }}
                        >
                          {s.suburb} {s.postcode} ({s.state})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="postcode">Postcode</Label>
                  <Input
                    id="postcode"
                    {...cleanerForm.register("postcode")}
                  />
                  {cleanerForm.formState.errors.postcode && (
                    <p className="text-base text-destructive md:text-xs">
                      {cleanerForm.formState.errors.postcode.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Travel radius: only for cleaners */}
            {roles.includes("cleaner") && (
              <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4 dark:border-gray-700 dark:bg-gray-800/40">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="max_travel_km" className="text-sm font-medium">
                      Max travel distance
                    </Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex text-muted-foreground focus:outline-none">
                            <Info className="h-3.5 w-3.5" aria-hidden />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[240px] text-xs">
                          Set how far you&apos;re willing to travel for jobs. Helps us show you relevant listings.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => setDistanceUnit("km")}
                      onKeyDown={(e) => e.key === "Enter" && setDistanceUnit("km")}
                      className={cn(
                        "rounded px-2 py-1 text-xs font-medium transition-colors",
                        distanceUnit === "km"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      km
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => setDistanceUnit("miles")}
                      onKeyDown={(e) => e.key === "Enter" && setDistanceUnit("miles")}
                      className={cn(
                        "rounded px-2 py-1 text-xs font-medium transition-colors",
                        distanceUnit === "miles"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      miles
                    </span>
                  </div>
                </div>
                <div className="w-full min-w-0 px-0.5">
                  <Slider
                    id="max_travel_km"
                    min={5}
                    max={100}
                    step={5}
                    value={[cleanerForm.watch("max_travel_km") ?? 30]}
                    onValueChange={([v]) => {
                      // v can be undefined from Slider onValueChange
                      cleanerForm.setValue("max_travel_km", v ?? 30, {
                        shouldValidate: true,
                      });
                    }}
                    className="touch-none"
                    aria-label="Max travel distance in km"
                  />
                  <div className="mt-1 flex justify-between text-[11px] text-muted-foreground dark:text-gray-400">
                    <span>5 km</span>
                    <span>30 km</span>
                    <span>50 km</span>
                    <span>100 km</span>
                  </div>
                </div>
                <p className="text-sm font-medium text-foreground dark:text-gray-100">
                  Max travel distance:{" "}
                  {distanceUnit === "miles"
                    ? `${(Math.round(((cleanerForm.watch("max_travel_km") ?? 30) * 0.621371) * 10) / 10).toFixed(1)} miles`
                    : `${cleanerForm.watch("max_travel_km") ?? 30} km`}
                </p>
                <p className="text-xs text-muted-foreground dark:text-gray-400">
                  Jobs within {cleanerForm.watch("max_travel_km") ?? 30} km will be shown.
                </p>
                <p className="text-[11px] text-muted-foreground/90 dark:text-gray-500">
                  This will be used for &quot;Jobs near you&quot; alerts and filtering.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="h-12 min-h-[48px] w-full md:h-8 md:min-h-0 md:w-auto"
                  disabled={savingTravelRadius}
                  onClick={async () => {
                    const km = cleanerForm.getValues("max_travel_km") ?? 30;
                    setSavingTravelRadius(true);
                    try {
                      const result = await updateMaxTravelKm(profile.id, km);
                      if (result.ok) {
                        const nextKm = clampRadiusKm(km);
                        setStoredRadiusKm(nextKm);
                        if (typeof window !== "undefined") {
                          sessionStorage.setItem(JOBS_RADIUS_SYNC_SESSION_KEY, "1");
                        }
                        router.refresh();
                        toast({
                          title: "Travel radius updated",
                          description: `Travel radius updated to ${km} km`,
                        });
                      } else {
                        toast({
                          variant: "destructive",
                          title: "Update failed",
                          description: result.error,
                        });
                      }
                    } finally {
                      setSavingTravelRadius(false);
                    }
                  }}
                >
                  {savingTravelRadius ? "Saving…" : "Update radius"}
                </Button>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="years_experience">Years of experience</Label>
                <Input
                  id="years_experience"
                  type="number"
                  min={0}
                  max={50}
                  {...cleanerForm.register("years_experience", { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehicle_type">Vehicle type</Label>
              <Controller
                control={cleanerForm.control}
                name="vehicle_type"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger id="vehicle_type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VEHICLE_TYPES.map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                rows={4}
                placeholder="Tell listers about your experience and approach."
                {...cleanerForm.register("bio")}
              />
            </div>

            <div className="space-y-2">
              <Label>Specialties</Label>
              <div className="flex flex-wrap gap-3">
                {CLEANER_SPECIALTIES.map((s) => (
                  <label
                    key={s}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={specialties.includes(s)}
                      onCheckedChange={() => toggleSpecialty(s)}
                    />
                    {s}
                  </label>
                ))}
              </div>
            </div>

            <div
              id="portfolio-photos"
              className="scroll-mt-28 space-y-3 rounded-lg border border-sky-200 bg-sky-50/40 p-4 dark:border-sky-800 dark:bg-sky-950/30"
            >
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <Label className="text-xs font-semibold text-sky-900 dark:text-sky-200">
                    Portfolio photos
                  </Label>
                  <p className="text-[11px] text-sky-800/90 dark:text-sky-300">
                    {(Array.isArray(portfolioUrls) ? portfolioUrls : []).length}/{PHOTO_LIMITS.PORTFOLIO} photos · JPG, PNG or WebP, max {PHOTO_VALIDATION.MAX_FILE_LABEL} each. Show before/after shots so listers can see the quality of your bond cleans.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(Array.isArray(portfolioUrls) ? portfolioUrls : []).map((url) => (
                  <div key={url} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md ring-1 ring-sky-400/70">
                    <OptimizedImage
                      src={url}
                      alt="Portfolio"
                      width={80}
                      height={80}
                      sizes={NEXT_IMAGE_SIZES_AVATAR_80}
                      quality={75}
                      className="h-full w-full rounded-md object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePortfolioUrl(url)}
                      className="absolute -right-1 -top-1 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-medium text-destructive-foreground shadow-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {portfolioPendingSlots > 0 &&
                  Array.from({ length: portfolioPendingSlots }).map((_, i) => (
                    <Skeleton
                      key={`pf-pending-${i}`}
                      className="h-20 w-20 shrink-0 rounded-md ring-1 ring-sky-400/40"
                      aria-hidden
                    />
                  ))}
                <label className={cn(
                    "flex h-20 w-24 cursor-pointer items-center justify-center rounded-md border border-dashed border-sky-300 bg-sky-50/60 text-[11px] font-medium text-sky-900 hover:bg-sky-50 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-200 dark:hover:bg-sky-900/50",
                    (Array.isArray(portfolioUrls) ? portfolioUrls : []).length >= PHOTO_LIMITS.PORTFOLIO && "pointer-events-none opacity-60"
                  )}>
                  <Input
                    type="file"
                    accept={PHOTO_VALIDATION.ACCEPT}
                    multiple
                    className="hidden"
                    onChange={handlePortfolioPhotos}
                    disabled={uploadingPortfolio || (Array.isArray(portfolioUrls) ? portfolioUrls : []).length >= PHOTO_LIMITS.PORTFOLIO}
                  />
                  {uploadingPortfolio ? (
                    portfolioUploadPhase === "compressing"
                      ? "Optimizing…"
                      : "Uploading…"
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <ImagePlus className="h-5 w-5" />
                      <span>Add photos</span>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="business_name">Business name</Label>
              <Input
                id="business_name"
                {...cleanerForm.register("business_name")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="insurance_policy_number">Insurance policy number</Label>
              <Input
                id="insurance_policy_number"
                {...cleanerForm.register("insurance_policy_number")}
              />
            </div>

            <div className="space-y-2">
              <Label>Availability (days you can work)</Label>
              <div className="flex flex-wrap gap-4">
                {AVAILABILITY_DAYS.map((day) => (
                  <label
                    key={day}
                    className="flex items-center gap-2 capitalize text-sm"
                  >
                    <Switch
                      checked={!!availability[day]}
                      onCheckedChange={(checked) =>
                        setAvailability((prev) => ({ ...prev, [day]: checked }))
                      }
                    />
                    {day}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="equipment_notes">Equipment notes</Label>
              <Textarea
                id="equipment_notes"
                rows={2}
                placeholder="e.g. Own vacuum, steam cleaner, etc."
                {...cleanerForm.register("equipment_notes")}
              />
            </div>

            {submitError && (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-base font-medium text-destructive md:border-0 md:bg-transparent md:p-0 md:text-sm md:font-normal">
                {submitError}
              </p>
            )}

            <Button type="submit" disabled={isSubmitting} size="lg" className="h-12 min-h-[48px] w-full md:h-10 md:min-h-0 md:w-auto">
              {isSubmitting ? "Saving..." : "Save profile"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="dark:border-gray-800 dark:bg-gray-900">
      <CardHeader>
        <CardTitle className="dark:text-gray-100">Edit profile</CardTitle>
        <CardDescription className="dark:text-gray-400">
          Your contact and location for listings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={listerForm.handleSubmit(onListerSubmit)}
          noValidate
        >
          <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-800 dark:bg-emerald-950/40">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <Label className="text-xs font-semibold text-emerald-900 dark:text-emerald-100">
                  Profile photo
                </Label>
                <p className="text-[11px] text-emerald-800/90 dark:text-emerald-200">
                  This photo is shared with your cleaner profile so listers and
                  cleaners recognise you.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                {profilePhotoUrl ? (
                  <OptimizedImage
                    src={profilePhotoUrl}
                    alt="Profile"
                    width={80}
                    height={80}
                    sizes={NEXT_IMAGE_SIZES_AVATAR_80}
                    quality={75}
                    className="rounded-full object-cover ring-2 ring-emerald-500/80 dark:ring-emerald-500/60"
                  />
                ) : (
                  <span className="text-xs font-medium text-emerald-900 dark:text-emerald-100">
                    No photo
                  </span>
                )}
              </div>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-emerald-300 px-3 py-2 text-xs font-medium text-emerald-900 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-900/40">
                <Input
                  type="file"
                  accept={PHOTO_VALIDATION.ACCEPT}
                  className="hidden"
                  onChange={handleProfilePhoto}
                  disabled={profilePhotoPhase !== "idle"}
                />
                <ImagePlus className="h-4 w-4" />
                {profilePhotoPhase === "compressing"
                  ? "Optimizing photo…"
                  : profilePhotoPhase === "uploading"
                    ? "Uploading photo…"
                    : "Upload / replace photo (max 1)"}
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" {...listerForm.register("full_name")} />
            {listerForm.formState.errors.full_name && (
              <p className="text-base text-destructive md:text-xs">
                {listerForm.formState.errors.full_name.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone (Australian)</Label>
            <Input id="phone" type="tel" {...listerForm.register("phone")} />
            {listerForm.formState.errors.phone && (
              <p className="text-base text-destructive md:text-xs">
                {listerForm.formState.errors.phone.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="date_of_birth">Date of birth (optional)</Label>
            <Input
              id="date_of_birth"
              type="date"
              {...listerForm.register("date_of_birth")}
            />
            <p className="text-[11px] text-muted-foreground dark:text-gray-400">
              Used for birthday wishes from Bond Back. We don’t share this.
            </p>
          </div>
          <div className="space-y-2">
            <Label>My location</Label>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="state">State</Label>
                <Controller
                  control={listerForm.control}
                  name="state"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger id="state">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {AU_STATES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1 relative">
                <Label htmlFor="suburb">Suburb</Label>
                <Input
                  id="suburb"
                  {...listerForm.register("suburb")}
                  onChange={(e) => {
                    const field = listerForm.register("suburb");
                    field.onChange(e);
                    const value = e.target.value.trim();
                    if (value.length < 2) {
                      setListerSuburbSuggestions([]);
                      return;
                    }
                    const stateCode = (listerForm.watch("state") ||
                      null) as AuStateCode | null;
                    supabase
                      .from("suburbs")
                      .select("suburb, postcode, state")
                      .ilike("suburb", `${value}%`)
                      .order("suburb")
                      .limit(8)
                      .then(({ data, error }) => {
                        if (error || !data) {
                          setListerSuburbSuggestions([]);
                          return;
                        }
                        const rows = data as SuburbEntry[];
                        const filtered = stateCode
                          ? rows.filter((s) => s.state === stateCode)
                          : rows;
                        setListerSuburbSuggestions(filtered);
                      });
                  }}
                />
                {listerForm.formState.errors.suburb && (
                  <p className="text-base text-destructive md:text-xs">
                    {listerForm.formState.errors.suburb.message}
                  </p>
                )}
                {listerSuburbSuggestions.length > 0 && (
                  <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover text-sm shadow-md">
                    {listerSuburbSuggestions.map((s) => (
                      <li
                        key={`${s.suburb}-${s.postcode}-${s.state}`}
                        className="cursor-pointer px-2 py-1 hover:bg-muted"
                        onClick={() => {
                          listerForm.setValue("suburb", s.suburb, {
                            shouldValidate: true,
                          });
                          listerForm.setValue("postcode", s.postcode, {
                            shouldValidate: true,
                          });
                          setListerSuburbSuggestions([]);
                        }}
                      >
                        {s.suburb} {s.postcode} ({s.state})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="postcode">Postcode</Label>
                <Input id="postcode" {...listerForm.register("postcode")} />
                {listerForm.formState.errors.postcode && (
                  <p className="text-base text-destructive md:text-xs">
                    {listerForm.formState.errors.postcode.message}
                  </p>
                )}
              </div>
            </div>
          </div>
          {submitError && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-base font-medium text-destructive md:border-0 md:bg-transparent md:p-0 md:text-sm md:font-normal">
              {submitError}
            </p>
          )}
          <Button type="submit" disabled={isSubmitting} size="lg" className="h-12 min-h-[48px] w-full md:h-10 md:min-h-0 md:w-auto">
            {isSubmitting ? "Saving..." : "Save profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
