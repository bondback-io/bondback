"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export type ReferralShareButtonsProps = {
  shareUrl: string;
  title: string;
  summary: string;
};

/**
 * Social share intents + Web Share API (mobile). `shareUrl` should be the /ref/CODE URL for OG previews.
 */
export function ReferralShareButtons({ shareUrl, title, summary }: ReferralShareButtonsProps) {
  const { toast } = useToast();

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedText = encodeURIComponent(`${summary} ${shareUrl}`);

  const shareNative = async () => {
    if (typeof navigator === "undefined" || !navigator.share) {
      toast({ title: "Copy link", description: "Use Copy link below, or open on your phone for native share." });
      return;
    }
    try {
      await navigator.share({ title, text: summary, url: shareUrl });
    } catch {
      // user cancelled
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="secondary" className="text-xs" onClick={shareNative}>
        Share…
      </Button>
      <Button type="button" size="sm" variant="outline" className="text-xs" asChild>
        <a
          href={`https://twitter.com/intent/tweet?text=${encodedText}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          X / Twitter
        </a>
      </Button>
      <Button type="button" size="sm" variant="outline" className="text-xs" asChild>
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Facebook
        </a>
      </Button>
      <Button type="button" size="sm" variant="outline" className="text-xs" asChild>
        <a
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          LinkedIn
        </a>
      </Button>
      <Button type="button" size="sm" variant="outline" className="text-xs" asChild>
        <a href={`mailto:?subject=${encodedTitle}&body=${encodedText}`}>Email</a>
      </Button>
    </div>
  );
}
