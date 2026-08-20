import { redirect } from "next/navigation";
import OperatorPageClient from "@/app/operator/operator-page-client";
import { getCurrentUserProfile } from "@/lib/services/auth-server";
import {
  getInitialDocuments,
  getInitialFolders,
  getInitialLands,
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

  const initialLands = await getInitialLands();
  
  const activeLand =
    profile.role === "operator" && profile.landId
      ? initialLands.find(
          (l) => String(l.id).trim().toLowerCase() === String(profile.landId).trim().toLowerCase()
        ) ?? initialLands[0] ?? null
      : initialLands[0] ?? null;

  const [initialFolders, initialDocuments] = activeLand
    ? await Promise.all([
        getInitialFolders(activeLand.id),
        getInitialDocuments(activeLand.id),
      ])
    : [[], []];

  return (
    <OperatorPageClient
      machineSlug={slug}
      userRole={profile.role ?? "operator"}
      userLandId={profile.landId}
      initialLands={initialLands}
      initialFolders={initialFolders}
      initialDocuments={initialDocuments}
    />
  );
}
