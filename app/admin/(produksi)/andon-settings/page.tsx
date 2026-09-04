import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AndonSettingsClient from "./andon-settings-client";

export const dynamic = "force-dynamic";

export default async function AndonSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "leader"].includes(profile.role)) {
    redirect("/operator");
  }

  return <AndonSettingsClient userId={user.id} role={profile.role} />;
}
