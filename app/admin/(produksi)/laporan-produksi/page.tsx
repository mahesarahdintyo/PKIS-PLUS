import { getCurrentUserProfile } from "@/lib/services/auth-server";
import { redirect } from "next/navigation";
import LaporanProduksiClient from "./laporan-produksi-client";

export const dynamic = "force-dynamic";

export default async function AdminLaporanProduksiPage() {
  const { user, role } = await getCurrentUserProfile();

  if (!user) redirect("/");
  const normalizedRole = (role || "").trim().toLowerCase();
  if (!["admin", "leader"].includes(normalizedRole)) {
    redirect("/operator");
  }

  return <LaporanProduksiClient />;
}
