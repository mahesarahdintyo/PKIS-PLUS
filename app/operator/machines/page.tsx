import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/services/auth-server";
import MachinePickerClient from "./machine-picker-client";

export const dynamic = "force-dynamic";

export default async function MachinePickerPage() {
  try {
    const profile = await getCurrentUserProfile();
    if (!profile?.user) {
      redirect("/");
    }
  } catch {
    redirect("/");
  }

  // MachinePickerClient fetches fresh user itself — no userId prop needed
  return <MachinePickerClient />;
}
