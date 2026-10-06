import { getCurrentUserProfile } from "@/lib/services/auth-server";
import { redirect } from "next/navigation";
import InputProductivityClient from "./input-productivity-client";

export const dynamic = "force-dynamic";

export default async function InputProductivityPage() {
  const { user, role } = await getCurrentUserProfile();

  if (!user) redirect("/");
  if (role !== "admin") redirect("/operator");

  return <InputProductivityClient />;
}
