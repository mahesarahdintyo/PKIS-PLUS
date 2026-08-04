import AdminPageClient from "@/app/admin/admin-page-client";
import { getInitialLands } from "@/lib/services/workspace-server";

export const dynamic = "force-dynamic";

export default async function Page() {
  const initialLands = await getInitialLands();

  return <AdminPageClient initialLands={initialLands} />;
}
