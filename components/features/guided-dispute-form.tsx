"use client";

import * as React from "react";
import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  validatePhotoFiles,
  PHOTO_LIMITS,
  PHOTO_VALIDATION,
  checkImageHeader,
} from "@/lib/photo-validation";
import { uploadProcessedPhotos } from "@/lib/actions/upload-photos";
import { openDispute } from "@/lib/actions/jobs";
import { useToast } from "@/components/ui/use-toast";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CheckCircle2, HelpCircle, Upload, X } from "lucide-react";
import Link from "next/link";
import { formatCents } from "@/lib/listings";

const DISPUTE_REASONS = [
  { value: "quality", label: "Quality of cleaning not up to standard" },
  { value: "incomplete", label: "Job not completed / items missed" },
  { value: "timeliness", label: "Cleaner was late or didn't show" },
  { value: "damage", label: "Damage caused during clean" },
  { value: "other", label: "Other" },
] as const;

const MESSAGE_MAX_LENGTH = 500;

const REFUND_STEP_CENTS = 500; // $5 steps (fallback when using percentage)
const REFUND_PERCENTAGE_STEP = 5; // 0–100% slider step

export type GuidedDisputeFormProps = {
  jobId: number;
  jobPageHref: string;
  jobTitle?: string | null;
  onCancel?: () => void;
  className?: string;
  /** When true (lister opening dispute), show partial refund slider. Required to be > 0 to submit. */
  isLister?: boolean;
  /** Full job amount in cents (e.g. from listing buy_now or winning bid). Used as slider max when isLister. */
  agreedAmountCents?: number;
};

export function GuidedDisputeForm({
  jobId,
  jobPageHref,
  jobTitle = null,
  onCancel,
  className,
  isLister = false,
  agreedAmountCents = 0,
}: GuidedDisputeFormProps) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [reasonOther, setReasonOther] = useState("");
  const [message, setMessage] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [errorPhotos, setErrorPhotos] = useState<string | null>(null);
  const [errorRefund, setErrorRefund] = useState<string | null>(null);
  const [errorSubmit, setErrorSubmit] = useState<string | null>(null);
  const maxRefundCents = Math.max(0, agreedAmountCents);
  const [refundPercentage, setRefundPercentage] = useState(0);
  const proposedRefundCents =
    maxRefundCents > 0
      ? Math.round((maxRefundCents * refundPercentage) / 100)
      : 0;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);

  const canSubmit =
    reason.trim() !== "" && (photoFiles.length >= 1 || uploadedUrls.length >= 1);

  const handleReasonChange = useCallback((v: string) => {
    setReason(v);
    setErrorReason(null);
  }, []);
  const messageLength = message.length;

  // Focus first focusable element on mount (reason trigger)
  useEffect(() => {
    const firstFocusable = formRef.current?.querySelector<HTMLElement>(
      "[data-dispute-first-focus]"
    );
    firstFocusable?.focus({ preventScroll: true });
  }, []);

  // Announce errors to screen readers
  const announceError = (msg: string) => {
    setErrorSubmit(msg);
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = msg;
    }
  };

  const clearErrors = () => {
    setErrorReason(null);
    setErrorPhotos(null);
    setErrorRefund(null);
    setErrorSubmit(null);
    if (liveRegionRef.current) liveRegionRef.current.textContent = "";
  };

  const removePhoto = (index: number) => {
    const url = photoPreviews[index];
    if (url) URL.revokeObjectURL(url);
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
    setUploadedUrls((prev) => prev.filter((_, i) => i !== index));
    setErrorPhotos(null);
  };

  const addFiles = React.useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      setErrorPhotos(null);
      const incoming = Array.from(files);
      const { validFiles, errors } = validatePhotoFiles(incoming, {
        maxFiles: PHOTO_LIMITS.DISPUTE,
        existingCount: photoFiles.length,
        minFiles: 1,
      });
      errors.forEach((err) => toast({ variant: "destructive", title: "Photo", description: err }));
      if (validFiles.length === 0) return;
      const withHeaderCheck: File[] = [];
      for (const f of validFiles) {
        const header = await checkImageHeader(f);
        if (!header.valid) {
          toast({ variant: "destructive", title: "Photo", description: `${f.name}: ${header.error}` });
          continue;
        }
        withHeaderCheck.push(f);
      }
      if (withHeaderCheck.length > 0) {
        const combined = [...photoFiles, ...withHeaderCheck].slice(0, PHOTO_LIMITS.DISPUTE);
        setPhotoPreviews((prev) => {
          prev.forEach((u) => URL.revokeObjectURL(u));
          return combined.map((f) => URL.createObjectURL(f));
        });
        setPhotoFiles(combined);
      }
    },
    [photoFiles.length, toast]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    clearErrors();

    if (!reason.trim()) {
      setErrorReason("Please select a reason for the dispute.");
      announceError("Please select a reason for the dispute.");
      return;
    }
    if (photoFiles.length < 1 && uploadedUrls.length < 1) {
      setErrorPhotos("Please add at least one evidence photo.");
      announceError("Please add at least one evidence photo.");
      return;
    }
    // Lister refund offer is optional; dispute can be opened with evidence alone.

    startSubmitTransition(async () => {
      let urls = uploadedUrls;
      if (photoFiles.length > 0 && urls.length !== photoFiles.length) {
        try {
          const fd = new FormData();
          photoFiles.forEach((f) => fd.append("file", f));
          const { results, error } = await uploadProcessedPhotos(fd, {
            bucket: "condition-photos",
            pathPrefix: `jobs/${jobId}/dispute`,
            maxFiles: PHOTO_LIMITS.DISPUTE,
            generateThumb: true,
          });
          urls = (results ?? []).map((r) => r?.url).filter(Boolean) as string[];
          if (error && urls.length === 0) {
            setErrorPhotos("Upload failed. Please try again.");
            announceError("Photo upload failed. Please try again.");
            toast({ variant: "destructive", title: "Upload failed", description: error });
            return;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Please try again.";
          setErrorPhotos(msg);
          announceError(msg);
          toast({ variant: "destructive", title: "Upload failed", description: msg });
          return;
        }
      }

      const result = await openDispute(jobId, {
        reason:
          reason === "other"
            ? "other"
            : (DISPUTE_REASONS.find((r) => r.value === reason)?.label ?? reason),
        reasonOther: reason === "other" ? reasonOther.trim() : undefined,
        photoUrls: urls,
        message: message.trim().slice(0, MESSAGE_MAX_LENGTH) || undefined,
        ...(isLister && proposedRefundCents > 0 ? { proposedRefundCents } : {}),
      });

      if (result.ok) {
        setSubmitted(true);
        toast({
          title: "Dispute submitted",
          description: "We'll notify the other party.",
        });
      } else {
        setErrorSubmit(result.error ?? "Something went wrong.");
        announceError(result.error ?? "Something went wrong.");
        toast({ variant: "destructive", title: "Could not submit", description: result.error });
      }
    });
  };

  const onFormKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.target instanceof HTMLElement) {
      const tag = e.target.tagName.toLowerCase();
      if (tag === "textarea") return; // allow newline in textarea
      e.preventDefault();
      if (canSubmit && !isSubmitting) handleSubmit();
    }
  };

  // Success screen
  if (submitted) {
    return (
      <Card
        className={cn(
          "w-full max-w-full border-emerald-200 dark:border-emerald-800 animate-in fade-in duration-300",
          className
        )}
        role="status"
        aria-live="polite"
        aria-label="Dispute submitted successfully"
      >
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white dark:bg-emerald-500" aria-hidden>
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                Dispute opened
              </h2>
              <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
                {isLister && proposedRefundCents > 0
                  ? `We've sent your partial refund offer (${formatCents(proposedRefundCents)}) to the cleaner. They can accept, counter, or reject.`
                  : "The other party has 72 hours to respond. We'll review if needed."}
              </p>
            </div>
            <Button
              asChild
              className="w-full min-h-[48px] min-w-[48px] md:min-h-10 md:min-w-0"
              size="lg"
            >
              <Link href={jobPageHref}>Back to job</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      ref={formRef}
      role="form"
      aria-label="Open a dispute"
      aria-describedby="dispute-form-description"
      onKeyDown={onFormKeyDown}
      className="w-full max-w-full"
    >
      <div id="dispute-form-description" className="sr-only">
        Form to open a dispute: select a reason, upload at least one evidence photo, optionally add details. Submit when ready.
      </div>

      {/* Live region for error announcements */}
      <div
        ref={liveRegionRef}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />

      <Card
        className={cn(
          "w-full max-w-full dark:border-gray-800 dark:bg-gray-900/50 animate-in fade-in duration-300",
          className
        )}
      >
        <CardContent className="pt-6 space-y-5 md:space-y-6">
          <header className="space-y-1.5">
            <h2 className="text-base font-semibold text-foreground dark:text-gray-100">
              Open a Dispute for Job #{jobId}
              {jobTitle ? ` – ${jobTitle}` : ""}
            </h2>
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              Please provide a reason and photos. The other party will have a chance to respond. We&apos;ll help resolve if needed.
            </p>
          </header>

          {/* Collapsible help */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="help" className="border-border dark:border-gray-800">
              <AccordionTrigger className="text-sm font-medium text-muted-foreground hover:text-foreground dark:hover:text-gray-100 py-3 min-h-[48px] md:min-h-0">
                What happens when I open a dispute?
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground dark:text-gray-400 pb-3">
                <p className="mb-2">We notify the other party and they have 72 hours to respond with their side and evidence.</p>
                <p>If you can&apos;t resolve together, our team will review both sides and the evidence to decide a fair outcome. Your funds stay protected until then.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="tips" className="border-border dark:border-gray-800">
              <AccordionTrigger className="text-sm font-medium text-muted-foreground hover:text-foreground dark:hover:text-gray-100 py-3 min-h-[48px] md:min-h-0">
                Tips for evidence photos
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground dark:text-gray-400 pb-3">
                <p>Upload clear before/after or close-up photos that show the issue. Well-lit images help us resolve faster. You can add 1 to 5 photos (JPG, PNG or WebP).
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Partial refund (lister only) */}
          {isLister && maxRefundCents > 0 && (
            <section className="space-y-2 animate-in fade-in duration-200" aria-labelledby="dispute-refund-label">
              <div className="flex items-center gap-2">
                <Label id="dispute-refund-label">Partial refund (required)</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex size-6 items-center justify-center rounded-full border border-muted-foreground/40 text-muted-foreground hover:bg-muted dark:border-gray-500 dark:text-gray-400 dark:hover:bg-gray-800"
                        aria-label="What is partial refund?"
                      >
                        <HelpCircle className="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[240px]">
                      Partial refund lets you keep some payment while resolving the issue fairly.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Slider
                value={[refundPercentage]}
                onValueChange={([v]) => {
                  if (v !== undefined) {
                    setRefundPercentage(v);
                    setErrorRefund(null);
                  }
                }}
                min={0}
                max={100}
                step={REFUND_PERCENTAGE_STEP}
                className="w-full"
                aria-label="Propose refund percentage (0–100%)"
              />
              <p className="text-sm font-medium text-foreground dark:text-gray-100" aria-live="polite">
                Refund: {refundPercentage}% — {formatCents(proposedRefundCents)} of {formatCents(maxRefundCents)} total
              </p>
              {errorRefund && (
                <Alert variant="destructive" className="text-red-700 dark:text-red-200 dark:border-red-800 dark:bg-red-950/50">
                  {errorRefund}
                </Alert>
              )}
            </section>
          )}

          {/* 1. Reason */}
          <section className="space-y-2 animate-in fade-in duration-200" aria-labelledby="dispute-reason-label">
            <Label id="dispute-reason-label" htmlFor="dispute-reason">
              Reason for dispute (required)
            </Label>
            <Select
              value={reason}
              onValueChange={handleReasonChange}
            >
              <SelectTrigger
                id="dispute-reason"
                data-dispute-first-focus
                className={cn(
                  "w-full min-h-[48px] md:min-h-10 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100",
                  errorReason && "border-red-500 dark:border-red-500"
                )}
                aria-label="Reason for dispute"
                aria-required="true"
                aria-invalid={!!errorReason}
                aria-errormessage={errorReason ? "dispute-reason-error" : undefined}
              >
                <SelectValue placeholder="Select a reason…" />
              </SelectTrigger>
              <SelectContent>
                {DISPUTE_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {reason === "other" && (
              <Input
                placeholder="Brief description"
                value={reasonOther}
                onChange={(e) => setReasonOther(e.target.value)}
                className="w-full min-h-[48px] md:min-h-10 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                aria-label="Other reason details"
                maxLength={200}
              />
            )}
            {errorReason && (
              <Alert variant="destructive" id="dispute-reason-error" className="mt-1 text-red-700 dark:text-red-200 dark:border-red-800 dark:bg-red-950/50">
                {errorReason}
              </Alert>
            )}
          </section>

          {/* 2. Evidence photos */}
          <section className="space-y-2 animate-in fade-in duration-200 delay-75" aria-labelledby="dispute-photos-label">
            <Label id="dispute-photos-label">Upload evidence photos (required, 1–5)</Label>
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={cn(
                "flex min-h-[140px] min-w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 transition-colors cursor-pointer touch-manipulation",
                isDragging
                  ? "border-primary bg-primary/5 dark:border-primary dark:bg-primary/10"
                  : "border-border bg-muted/30 hover:bg-muted/50 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:bg-gray-800",
                errorPhotos && "border-red-500 dark:border-red-500"
              )}
              aria-label="Upload evidence photos. Drag and drop or tap to select. At least one photo required."
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={PHOTO_VALIDATION.ACCEPT}
                multiple
                className="sr-only"
                onChange={handleFileChange}
                aria-label="Choose evidence photo files"
                aria-required
                aria-invalid={!!errorPhotos}
                aria-errormessage={errorPhotos ? "dispute-photos-error" : undefined}
              />
              <Upload className="h-8 w-8 text-muted-foreground dark:text-gray-400" aria-hidden />
              <span className="text-sm text-muted-foreground dark:text-gray-400 text-center">
                Drag and drop or tap to select (JPG, PNG, WebP · max {PHOTO_VALIDATION.MAX_FILE_LABEL})
              </span>
              <span className="text-xs text-muted-foreground dark:text-gray-500">
                {photoFiles.length}/5 photos
              </span>
            </div>
            {photoPreviews.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {photoPreviews.map((url, index) => (
                  <div
                    key={`${url}-${index}`}
                    className="relative h-20 w-20 overflow-hidden rounded-lg border border-border dark:border-gray-700"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      aria-label={`Remove photo ${index + 1}`}
                      className="absolute -right-1 -top-1 flex h-12 w-12 min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-black/70 text-white hover:bg-black dark:bg-white/20 dark:hover:bg-white/30 touch-manipulation"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePhoto(index);
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {errorPhotos && (
              <Alert variant="destructive" id="dispute-photos-error" className="mt-1 text-red-700 dark:text-red-200 dark:border-red-800 dark:bg-red-950/50">
                {errorPhotos}
              </Alert>
            )}
          </section>

          {/* 3. Optional message */}
          <section className="space-y-2 animate-in fade-in duration-200 delay-100" aria-labelledby="dispute-message-label">
            <Label id="dispute-message-label" htmlFor="dispute-message">
              Extra details (optional, max 500 characters)
            </Label>
            <Textarea
              id="dispute-message"
              placeholder="Add any extra details…"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX_LENGTH))}
              rows={3}
              maxLength={MESSAGE_MAX_LENGTH}
              className="w-full min-h-[80px] resize-none dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
              aria-label="Extra details, optional, maximum 500 characters"
            />
            <p className="text-[11px] text-muted-foreground dark:text-gray-500" aria-live="polite">
              {messageLength}/{MESSAGE_MAX_LENGTH}
            </p>
          </section>

          {/* 4. Submit error (general) */}
          {errorSubmit && (
            <Alert variant="destructive" role="alert" className="text-red-700 dark:text-red-200 dark:border-red-800 dark:bg-red-950/50">
              {errorSubmit}
            </Alert>
          )}

          {/* 5. Actions */}
          <section className="flex flex-col gap-2 pt-2 animate-in fade-in duration-200 delay-150">
            <Button
              type="button"
              variant="destructive"
              className="w-full min-h-[48px] min-w-[48px] md:min-h-10 md:min-w-0 touch-manipulation"
              disabled={!canSubmit || isSubmitting}
              onClick={() => handleSubmit()}
              aria-label="Submit dispute"
            >
              {isSubmitting ? "Submitting…" : "Submit Dispute"}
            </Button>
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="w-full min-h-[48px] min-w-[48px] md:min-h-10 md:min-w-0 text-muted-foreground dark:hover:text-gray-100 touch-manipulation"
                onClick={onCancel}
                aria-label="Cancel and go back"
              >
                Cancel
              </Button>
            )}
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
