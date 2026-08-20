import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/services/auth-server";
import MachinePickerClient from "./machine-picker-client";

export const dynamic = "force-dynamic";

export default async function MachinePickerPage() {
  try {
    const profile = await getCurrentUserProfile();
    if (!profile) {
      redirect("/");
    }
  } catch {
    redirect("/");
  }

  return <MachinePickerClient />;
}
