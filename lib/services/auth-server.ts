import { createClient } from "@/lib/supabase/server";

export interface UserProfile {
  user: any | null;
  role: "admin" | "operator" | null;
  landId: string | null;
}

export async function getCurrentUserProfile(): Promise<UserProfile> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { user: null, role: null, landId: null };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, land_id")
      .eq("id", user.id)
      .single();

    return {
      user,
      role: (profile?.role as "admin" | "operator") ?? null,
      landId: profile?.land_id ?? null,
    };
  } catch (err) {
    console.error("Error fetching current user profile:", err);
    return { user: null, role: null, landId: null };
  }
}
