import DisplayPageClient from "@/app/display/display-page-client";
import { Suspense } from "react";

interface DisplayLinePageProps {
  params: Promise<{
    landId: string;
  }>;
}

export default async function DisplayLinePage({ params }: DisplayLinePageProps) {
  const { landId } = await params;

  return (
    <Suspense fallback={null}>
      <DisplayPageClient landId={landId} />
    </Suspense>
  );
}
