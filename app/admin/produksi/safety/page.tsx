import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import InputSafetyClient from "./input-safety-client";

export const dynamic = "force-dynamic";

export default async function InputSafetyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Guard: harus login
  if (!user) redirect("/");

  // Guard: hanya admin & leader
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "leader")) {
    redirect("/operator");
  }

  return <InputSafetyClient />;
}
