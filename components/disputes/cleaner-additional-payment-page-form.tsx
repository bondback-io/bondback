"use client";

import { type FormEvent, useState, useTransition, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Upload, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { submitCleanerAdditionalPaymentRequest, type DisputeActionState } from "@/lib/actions/disputes";
import { uploadProcessedPhotos } from "@/lib/actions/upload-photos";
import { validatePhotoFiles } from "@/lib/photo-validation";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { OptimizedImage } from "@/components/ui/optimized-image";

type Props = {
  jobId: number;
  /** Shown above the card (dedicated page). */
  showBreadcrumbs?: boolean;
};

export function CleanerAdditionalPaymentPageForm({ jobId, showBreadcrumbs }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, setState] = useState<DisputeActionState>({});
  const [pending, startTransition] = useTransition();
  const [uploadPending, setUploadPending] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [extraUrls, setExtraUrls] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const revokePreviews = useCallback((urls: string[]) => {
    urls.forEach((u) => {
      if (u.startsWith("blob:")) URL.revokeObjectURL(u);
    });
  }, []);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      setPhotoFiles((prev) => {
        const res = validatePhotoFiles(list, { maxFiles: 5, existingCount: prev.length });
        if (res.validFiles.length === 0) {
          toast({
            variant: "destructive",
            title: "Invalid photos",
            description: res.errors.length > 0 ? res.errors.join(" ") : "No valid images selected.",
          });
          return prev;
        }
        const merged = [...prev, ...res.validFiles].slice(0, 5);
        setPhotoPreviews((oldPrev) => {
          oldPrev.forEach((u) => {
            if (u.startsWith("blob:")) URL.revokeObjectURL(u);
          });
          return merged.map((f) => URL.createObjectURL(f));
        });
        return merged;
      });
    },
    [toast]
  );

  const removePhotoAt = (idx: number) => {
    setPhotoFiles((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      revokePreviews([photoPreviews[idx]!]);
      setPhotoPreviews((p) => p.filter((_, i) => i !== idx));
      return next;
    });
  };

  const onFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const urls: string[] = extraUrls
        .split(/[\n\r]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8);

      if (photoFiles.length > 0) {
        setUploadPending(true);
        try {
          const fd = new FormData();
          photoFiles.forEach((f) => fd.append("file", f));
          const { results, error } = await uploadProcessedPhotos(fd, {
            bucket: "condition-photos",
            pathPrefix: `jobs/${jobId}/additional-payment`,
            maxFiles: 5,
            generateThumb: true,
          });
          setUploadPending(false);
          if (error && (!results || results.every((r) => !r.url))) {
            toast({ variant: "destructive", title: "Upload failed", description: error });
            return;
          }
          for (const r of results ?? []) {
            if (r.url) urls.push(r.url);
          }
        } catch (e) {
          setUploadPending(false);
          toast({
            variant: "destructive",
            title: "Upload failed",
            description: e instanceof Error ? e.message : "Could not upload images.",
          });
          return;
        }
      }

      if (urls.length < 1) {
        toast({
          variant: "destructive",
          title: "Evidence required",
          description: "Add at least one photo or paste image URLs.",
        });
        return;
      }

      formData.set("attachmentUrls", urls.join("\n"));
      const r = await submitCleanerAdditionalPaymentRequest(undefined, formData);
      setState(r);
      if (r.error) {
        toast({ variant: "destructive", title: "Request failed", description: r.error });
        return;
      }
      toast({ title: "Request sent", description: r.success });
      router.push(`/jobs/${jobId}`);
      router.refresh();
    });
  };

  const busy = pending || uploadPending;

  return (
    <div className="space-y-4">
      {showBreadcrumbs ? (
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground dark:text-gray-400"
        >
          <Link href="/jobs" className="font-medium text-foreground hover:underline dark:text-gray-200">
            Jobs
          </Link>
          <ChevronRight className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
          <Link
            href={`/jobs/${jobId}`}
            className="font-medium text-foreground hover:underline dark:text-gray-200"
          >
            Job #{jobId}
          </Link>
          <ChevronRight className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
          <span className="font-semibold text-foreground dark:text-gray-100">Request additional payment</span>
        </nav>
      ) : null}

      <Card className="border-violet-300/70 bg-violet-50/60 dark:border-violet-800 dark:bg-violet-950/20">
        <CardHeader>
          <CardTitle className="text-base">Request additional payment</CardTitle>
          <p className="text-sm text-muted-foreground dark:text-gray-400">
            The lister will see this on the job and listing page and can accept (Stripe) or deny. A dispute thread
            entry is created so both parties can follow up in Dispute Resolution.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onFormSubmit} className="space-y-4">
            <input type="hidden" name="jobId" value={jobId} />

            {state?.error ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}
            {state?.ok && state.success ? (
              <Alert className="border-emerald-600/50 bg-emerald-50/90 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
                <AlertDescription>{state.success}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-1.5">
              <Label>Additional amount (AUD)</Label>
              <Input
                name="amountAud"
                type="number"
                min={1}
                step={0.01}
                required
                disabled={busy}
                placeholder="e.g. 80"
                aria-describedby="additional-pay-min-hint-page"
              />
              <p id="additional-pay-min-hint-page" className="text-xs text-muted-foreground">
                Minimum $1.00. Enter dollars (not cents).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Textarea
                name="reason"
                rows={4}
                required
                disabled={busy}
                placeholder="Explain why additional payment is required..."
              />
            </div>

            <div className="space-y-2">
              <Label>Supporting photos</Label>
              <p className="text-xs text-muted-foreground">
                At least one image is required. Upload files or add direct URLs below.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || photoFiles.length >= 5}
                  onClick={() => fileRef.current?.click()}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" aria-hidden />
                  Add photos
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
              {photoPreviews.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {photoPreviews.map((src, idx) => (
                    <li key={src} className="relative h-20 w-20 overflow-hidden rounded-lg border dark:border-gray-700">
                      <OptimizedImage
                        src={src}
                        alt=""
                        width={80}
                        height={80}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5 shadow"
                        onClick={() => removePhotoAt(idx)}
                        aria-label="Remove photo"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="space-y-1.5">
                <Label className="text-xs font-normal text-muted-foreground">Optional: image URLs (one per line)</Label>
                <Textarea
                  value={extraUrls}
                  onChange={(e) => setExtraUrls(e.target.value)}
                  rows={2}
                  disabled={busy}
                  placeholder="https://…"
                  className={cn("resize-none dark:border-gray-700")}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" asChild disabled={busy}>
                <Link href={`/jobs/${jobId}`}>Cancel</Link>
              </Button>
              <Button type="submit" className="min-h-11" disabled={busy}>
                {busy ? "Working…" : "Send request to lister"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
