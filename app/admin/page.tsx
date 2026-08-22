import AdminPageClient from "@/app/admin/admin-page-client";
import { getInitialLines } from "@/lib/services/workspace-server";

export const dynamic = "force-dynamic";

export default async function Page() {
  const initialLines = await getInitialLines();

  return <AdminPageClient initialLines={initialLines} />;
}
