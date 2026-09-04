import AdminPageClient from "@/app/admin/admin-page-client";
import { getInitialLines } from "@/lib/services/workspace-server";
import { getCurrentUserProfile } from "@/lib/services/auth-server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page() {
  const profile = await getCurrentUserProfile();
  if (!profile.user) {
    redirect("/");
  }
  if (profile.role !== "admin") {
    redirect("/operator");
  }

  const initialLines = await getInitialLines();

  return <AdminPageClient initialLines={initialLines} />;
}
