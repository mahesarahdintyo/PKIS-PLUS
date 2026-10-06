import { getCurrentUserProfile } from "@/lib/services/auth-server";
import { redirect } from "next/navigation";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function AdminProduksiDashboardPage() {
  const { user, role } = await getCurrentUserProfile();

  if (!user) redirect("/");
  if (role !== "admin") redirect("/operator");

  return <DashboardClient />;
}
