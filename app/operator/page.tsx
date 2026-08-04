import OperatorPageClient from "@/app/operator/operator-page-client";
import { getCurrentUserProfile } from "@/lib/services/auth-server";
import {
  getInitialDocuments,
  getInitialFolders,
  getInitialLands,
} from "@/lib/services/workspace-server";

export const dynamic = "force-dynamic";

export default async function OperatorPage() {
  const profile = await getCurrentUserProfile();
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
      userRole={profile.role ?? "operator"}
      userLandId={profile.landId}
      initialLands={initialLands}
      initialFolders={initialFolders}
      initialDocuments={initialDocuments}
    />
  );
}
