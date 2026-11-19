import { getCurrentUserProfile } from "@/lib/services/auth-server";
import { redirect } from "next/navigation";
import AdminUsersClient from "./admin-users-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kelola Pengguna & Role | Admin PKIS-PLUS",
  description: "Kelola pengguna, hak akses role, dan penugasan line kerja.",
};

export default async function AdminUsersPage() {
  const { user, role } = await getCurrentUserProfile();

  if (!user) {
    redirect("/");
  }

  if (role !== "admin") {
    redirect("/operator");
  }

  return <AdminUsersClient currentUserId={user.id} />;
}
