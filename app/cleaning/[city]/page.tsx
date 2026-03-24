import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CLEANING_CITY_TO_SLUG } from "@/lib/seo/location-top-slugs";

export function generateStaticParams(): { city: string }[] {
  return Object.keys(CLEANING_CITY_TO_SLUG).map((city) => ({ city }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  const slug = CLEANING_CITY_TO_SLUG[city.toLowerCase()];
  if (!slug) return { title: "Cleaning" };
  const title = `Bond cleaning ${city.replace(/-/g, " ")} | Bond Back`;
  const description = `Bond cleaning and end of lease cleaning — find cleaners and compare bids on Bond Back.`;
  return {
    title,
    description,
    alternates: { canonical: `/bond-cleaning/${slug}` },
    robots: { index: false, follow: true },
  };
}

export default async function CleaningCityAliasPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;
  const slug = CLEANING_CITY_TO_SLUG[city.toLowerCase()];
  if (!slug) notFound();
  redirect(`/bond-cleaning/${slug}`);
}
