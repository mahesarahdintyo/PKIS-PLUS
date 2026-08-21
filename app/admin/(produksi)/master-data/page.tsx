import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MasterDataClient from "./master-data-client";

export const dynamic = "force-dynamic";

export default async function AdminMasterDataPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "leader")) {
    redirect("/operator");
  }

  return <MasterDataClient />;
}
