import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/services/auth-server";
import OperatorGateClient from "./operator-gate-client";

export const dynamic = "force-dynamic";

export default async function OperatorPage() {
  try {
    const profile = await getCurrentUserProfile();
    if (!profile?.user) {
      redirect("/");
    }
  } catch {
    redirect("/");
  }

  // OperatorGateClient fetches fresh user itself — no userId prop needed
  return <OperatorGateClient />;
}
