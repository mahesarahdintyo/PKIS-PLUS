import { getCurrentUserProfile } from "@/lib/services/auth-server";
import { redirect } from "next/navigation";
import DowntimeLogClient from "./downtime-log-client";

export const dynamic = "force-dynamic";

export default async function AdminDowntimeLogPage() {
  const { user, role } = await getCurrentUserProfile();

  if (!user) redirect("/");
  if (role !== "admin") redirect("/operator");

  return <DowntimeLogClient />;
}
