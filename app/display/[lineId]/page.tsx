import DisplayPageClient from "@/app/display/display-page-client";
import { Suspense } from "react";

interface DisplayLinePageProps {
  params: Promise<{
    lineId: string;
  }>;
}

export default async function DisplayLinePage({ params }: DisplayLinePageProps) {
  const { lineId } = await params;

  return (
    <Suspense fallback={null}>
      <DisplayPageClient lineId={lineId} />
    </Suspense>
  );
}
