import { redirect } from "next/navigation";
import OperatorPageClient from "@/app/operator/operator-page-client";
import { getCurrentUserProfile } from "@/lib/services/auth-server";
import {
  getInitialDocuments,
  getInitialFolders,
  getInitialLines,
} from "@/lib/services/workspace-server";

export const dynamic = "force-dynamic";

const VALID_SLUGS = ["tandem", "blanking", "transfer-2000t", "transfer-800t", "pc200t"];

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function MachineHubPage({ params }: PageProps) {
  const { slug } = await params;
  if (!VALID_SLUGS.includes(slug)) {
    redirect("/operator/machines");
  }

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
  
  const activeLine =
    profile.role === "operator" && profile.lineId
      ? initialLines.find(
          (l) => String(l.id).trim().toLowerCase() === String(profile.lineId).trim().toLowerCase()
        ) ?? initialLines[0] ?? null
      : initialLines[0] ?? null;

  const [initialFolders, initialDocuments] = activeLine
    ? await Promise.all([
        getInitialFolders(activeLine.id),
        getInitialDocuments(activeLine.id),
      ])
    : [[], []];

  return (
    <OperatorPageClient
      machineSlug={slug}
      userRole={profile.role ?? "operator"}
      userLineId={profile.lineId}
      initialLines={initialLines}
      initialFolders={initialFolders}
      initialDocuments={initialDocuments}
    />
  );
}
