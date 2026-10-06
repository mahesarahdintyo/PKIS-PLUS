import { getCurrentUserProfile } from "@/lib/services/auth-server";
import { redirect } from "next/navigation";
import AndonSettingsClient from "./andon-settings-client";

export const dynamic = "force-dynamic";

export default async function AndonSettingsPage() {
  const { user, role } = await getCurrentUserProfile();

  if (!user) redirect("/");
  if (!role || !["admin", "leader"].includes(role)) {
    redirect("/operator");
  }

  return <AndonSettingsClient userId={user.id} role={role} />;
}
