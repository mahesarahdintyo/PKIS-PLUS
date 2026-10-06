import { getCurrentUserProfile } from "@/lib/services/auth-server";
import { redirect } from "next/navigation";
import InputSafetyClient from "./input-safety-client";

export const dynamic = "force-dynamic";

export default async function InputSafetyPage() {
  const { user, role } = await getCurrentUserProfile();

  if (!user) redirect("/");
  if (role !== "admin") redirect("/operator");

  return <InputSafetyClient />;
}
