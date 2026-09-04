import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import InputAttendanceClient from "./input-attendance-client";

export const dynamic = "force-dynamic";

export default async function InputAttendancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/operator");
  }

  return <InputAttendanceClient userId={user.id} />;
}
