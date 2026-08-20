import { createClient } from "@/lib/supabase/server";

export interface UserProfile {
  user: any | null;
  role: "admin" | "operator" | "leader" | null;
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

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role, land_id")
      .eq("id", user.id)
      .maybeSingle();

    if (error && error.message) {
      console.warn("Profile query notice:", error.message);
    }

    const rawRole = (profile?.role || user.user_metadata?.role || user.app_metadata?.role || null) as string | null;
    const cleanRole = rawRole ? (rawRole.trim().toLowerCase() as "admin" | "operator" | "leader") : null;
    const landId = profile?.land_id ?? user.user_metadata?.land_id ?? null;

    return {
      user,
      role: cleanRole,
      landId,
    };
  } catch (err) {
    console.error("Error fetching current user profile:", err);
    return { user: null, role: null, landId: null };
  }
}
