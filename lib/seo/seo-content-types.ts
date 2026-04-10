/** JSON stored in `seo_content.landing` */
export type SeoLandingPayload = {
  heroTitle: string;
  heroSubtitle: string;
  sections: Array<{ heading: string; bodyMarkdown: string }>;
};

/** `seo_content.blog_posts` */
export type SeoBlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  bodyMarkdown: string;
};

/** `seo_content.faq_schema` — pairs for FAQPage JSON-LD */
export type SeoFaqPayload = {
  questions: Array<{ question: string; answer: string }>;
};

/** Full document returned to the bond-cleaning page + actions */
export type SeoGeneratedBundle = {
  landing: SeoLandingPayload;
  blogPosts: SeoBlogPost[];
  faq: SeoFaqPayload;
  metaTitle: string;
  metaDescription: string;
};
