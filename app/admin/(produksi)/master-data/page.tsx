import { getCurrentUserProfile } from "@/lib/services/auth-server";
import { redirect } from "next/navigation";
import MasterDataClient from "./master-data-client";

export const dynamic = "force-dynamic";

export default async function AdminMasterDataPage() {
  const { user, role } = await getCurrentUserProfile();

  if (!user) redirect("/");
  if (role !== "admin") redirect("/operator");

  return <MasterDataClient />;
}
