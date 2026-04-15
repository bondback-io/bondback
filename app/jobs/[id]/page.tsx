import { Suspense } from "react";
import JobDetailPage, { dynamic, generateMetadata } from "./job-detail-numeric-page";
import JobDetailLoading from "./loading";

export { dynamic, generateMetadata };

export default async function JobDetailPageRoute(props: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<JobDetailLoading />}>
      <JobDetailPage {...props} />
    </Suspense>
  );
}
