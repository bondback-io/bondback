"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Star, CheckCircle2, ImagePlus } from "lucide-react";
import { attachReviewPhotos, submitReview } from "@/lib/actions/reviews";
import { useToast } from "@/components/ui/use-toast";
import { uploadProcessedPhotos } from "@/lib/actions/upload-photos";
import {
  checkImageHeader,
  PHOTO_LIMITS,
  PHOTO_VALIDATION,
  validatePhotoFiles,
} from "@/lib/photo-validation";

type ReviewFormProps = {
  jobId: number;
  revieweeType: "cleaner" | "lister";
  onSuccess?: () => void;
};

export function ReviewForm({ jobId, revieweeType, onSuccess }: ReviewFormProps) {
  const [overall, setOverall] = useState(0);
  const [quality, setQuality] = useState(5);
  const [reliability, setReliability] = useState(5);
  const [communication, setCommunication] = useState(5);
  const [punctuality, setPunctuality] = useState(5);
  const [text, setText] = useState("");
  const [reviewPhotos, setReviewPhotos] = useState<File[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isCleanerReview = revieweeType === "cleaner";
  const { toast } = useToast();

  const handleSubmit = async () => {
    setError(null);
    if (!overall || overall < 1 || overall > 5) {
      setError("Please choose a rating (1–5 stars).");
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitReview({
        jobId,
        revieweeType,
        overallRating: overall,
        ...(isCleanerReview
          ? {
              qualityOfWork: quality,
              reliability,
              communication,
              punctuality,
            }
          : {}),
        reviewText: text.trim() || null,
      });
      if (!res.ok) {
        setError(res.error);
        setSubmitting(false);
        return;
      }

      if (reviewPhotos.length > 0) {
        setUploadingPhotos(true);
        const fd = new FormData();
        reviewPhotos.forEach((f) => fd.append("files", f));
        const { results, error: uploadError } = await uploadProcessedPhotos(fd, {
          bucket: "review-photos",
          pathPrefix: `reviews/${res.reviewId}`,
          maxFiles: PHOTO_LIMITS.REVIEW,
          generateThumb: true,
        });
        const photoPaths = (results ?? [])
          .map((r) => r.path)
          .filter((p): p is string => Boolean(p));
        if (uploadError && photoPaths.length === 0) {
          setError(uploadError);
          setSubmitting(false);
          setUploadingPhotos(false);
          return;
        }
        if (photoPaths.length > 0) {
          const attachRes = await attachReviewPhotos(res.reviewId, photoPaths);
          if (!attachRes.ok) {
            setError(attachRes.error);
            setSubmitting(false);
            setUploadingPhotos(false);
            return;
          }
        }
        setUploadingPhotos(false);
      }

      setSuccess(true);
      onSuccess?.();
      toast({
        title: "Review submitted",
        description: "Thanks for your feedback.",
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit review.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900/80">
      <CardContent className="space-y-3 p-3 sm:p-4">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground dark:text-gray-400">
            Rating (required)
          </p>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setOverall(star)}
                className="p-0.5 transition-opacity hover:opacity-80"
                aria-label={`${star} star${star > 1 ? "s" : ""}`}
              >
                <Star
                  className={`h-6 w-6 ${
                    star <= overall
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/50 dark:text-gray-500"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
        {isCleanerReview && (
          <div className="space-y-3 rounded-md border border-border bg-background/60 p-3 dark:border-gray-700 dark:bg-gray-900/40">
            <p className="text-xs font-medium text-muted-foreground dark:text-gray-400">
              Cleaner categories (1-5)
            </p>
            <div className="space-y-2">
              <Label className="text-xs">Quality of work: {quality}</Label>
              <Slider
                value={[quality]}
                min={1}
                max={5}
                step={1}
                onValueChange={([v]) => {
                  // v can be undefined from Slider onValueChange
                  if (v !== undefined) setQuality(v);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Reliability: {reliability}</Label>
              <Slider
                value={[reliability]}
                min={1}
                max={5}
                step={1}
                onValueChange={([v]) => {
                  // v can be undefined from Slider onValueChange
                  if (v !== undefined) setReliability(v);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Communication: {communication}</Label>
              <Slider
                value={[communication]}
                min={1}
                max={5}
                step={1}
                onValueChange={([v]) => {
                  // v can be undefined from Slider onValueChange
                  if (v !== undefined) setCommunication(v);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Punctuality: {punctuality}</Label>
              <Slider
                value={[punctuality]}
                min={1}
                max={5}
                step={1}
                onValueChange={([v]) => {
                  // v can be undefined from Slider onValueChange
                  if (v !== undefined) setPunctuality(v);
                }}
              />
            </div>
          </div>
        )}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground dark:text-gray-400">
            Comment (optional)
          </p>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 1000))}
            rows={3}
            className="text-sm resize-none dark:bg-gray-900 dark:border-gray-700"
            placeholder={
              isCleanerReview
                ? "How was the clean? Anything to note?"
                : "How was your experience with the owner?"
            }
          />
          <p className="text-[11px] text-muted-foreground dark:text-gray-400">
            {text.length}/1000
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground dark:text-gray-400">
            Photos (optional, up to {PHOTO_LIMITS.REVIEW})
          </p>
          <Button type="button" size="sm" variant="outline" asChild>
            <label className="inline-flex cursor-pointer items-center gap-1">
              <ImagePlus className="h-4 w-4" />
              Add photos
              <input
                type="file"
                multiple
                accept={PHOTO_VALIDATION.ACCEPT}
                className="hidden"
                onChange={async (e) => {
                  const files = e.target.files ? Array.from(e.target.files) : [];
                  const { validFiles, errors } = validatePhotoFiles(files, {
                    maxFiles: PHOTO_LIMITS.REVIEW,
                    existingCount: reviewPhotos.length,
                  });
                  if (errors.length) {
                    setError(errors[0]);
                  }
                  const headerValid: File[] = [];
                  for (const f of validFiles) {
                    const ok = await checkImageHeader(f);
                    if (ok.valid) headerValid.push(f);
                  }
                  if (headerValid.length > 0) {
                    const merged = [...reviewPhotos, ...headerValid].slice(
                      0,
                      PHOTO_LIMITS.REVIEW
                    );
                    setReviewPhotos(merged);
                  }
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
          {reviewPhotos.length > 0 && (
            <p className="text-[11px] text-muted-foreground dark:text-gray-400">
              {reviewPhotos.length} photo(s) selected
            </p>
          )}
        </div>
        {error && (
          <p className="text-[11px] text-destructive dark:text-red-400">{error}</p>
        )}
        {success && (
          <p className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Thank you — your review has been submitted.
          </p>
        )}
        {!success && (
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || uploadingPhotos}
            >
              {submitting || uploadingPhotos ? "Submitting…" : "Submit review"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
