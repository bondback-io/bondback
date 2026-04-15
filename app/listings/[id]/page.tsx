import { Suspense } from "react";
import ListingDetailPage, { dynamic, generateMetadata } from "./listing-detail-page";
import ListingDetailLoading from "./loading";

export { dynamic, generateMetadata };

export default async function ListingDetailPageRoute(props: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<ListingDetailLoading />}>
      <ListingDetailPage {...props} />
    </Suspense>
  );
}
