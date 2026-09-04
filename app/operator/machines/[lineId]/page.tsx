import { redirect } from "next/navigation";
import OperatorPageClient from "@/app/operator/operator-page-client";
import { getCurrentUserProfile } from "@/lib/services/auth-server";
import {
  getInitialDocuments,
  getInitialFolders,
  getInitialLines,
} from "@/lib/services/workspace-server";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ lineId: string }>;
}

export default async function MachineHubPage({ params }: PageProps) {
  const { lineId } = await params;

  let profile;
  try {
    profile = await getCurrentUserProfile();
    if (!profile) {
      redirect("/");
    }
  } catch {
    redirect("/");
  }

  const initialLines = await getInitialLines();
  const activeLine = initialLines.find(
    (l) => String(l.id).trim().toLowerCase() === String(lineId).trim().toLowerCase()
  );

  if (!activeLine) {
    redirect("/operator/machines");
  }

  const [initialFolders, initialDocuments] = await Promise.all([
    getInitialFolders(activeLine.id),
    getInitialDocuments(activeLine.id),
  ]);

  return (
    <OperatorPageClient
      lineId={activeLine.id}
      selectedLineName={activeLine.name}
      userRole={profile.role ?? "operator"}
      userId={profile.user?.id}
      userLineId={profile.lineId}
      initialLines={initialLines}
      initialFolders={initialFolders}
      initialDocuments={initialDocuments}
    />
  );
}
