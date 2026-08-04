import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/services/auth-server";
import type { Document } from "@/lib/services/document";
import type { Folder } from "@/lib/services/folder";
import type { Land } from "@/lib/services/land";

export async function getInitialLands(): Promise<Land[]> {
  const userProfile = await getCurrentUserProfile();
  const supabase = await createClient();

  let query = supabase
    .from("lands")
    .select("*")
    .or("is_active.eq.true,is_active.is.null");

  if (userProfile.role === "operator" && userProfile.landId) {
    query = query.eq("id", userProfile.landId);
  } else {
    query = query.eq("hidden_from_operator", false);
  }

  const { data, error } = await query.order("name", { ascending: true });

  if (error) {
    console.error("Initial lands error:", error);
    return [];
  }

  return data ?? [];
}

export async function getInitialFolders(landId: string): Promise<Folder[]> {
  const userProfile = await getCurrentUserProfile();
  const effectiveLandId =
    userProfile.role === "operator" && userProfile.landId
      ? userProfile.landId
      : landId;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("folders")
    .select("*")
    .eq("land_id", effectiveLandId)
    .is("parent_id", null)
    .or("is_active.eq.true,is_active.is.null")
    .order("name", { ascending: true });

  if (error) {
    console.error("Initial folders error:", error);
    return [];
  }

  return data ?? [];
}

export async function getInitialDocuments(landId: string): Promise<Document[]> {
  const userProfile = await getCurrentUserProfile();
  const effectiveLandId =
    userProfile.role === "operator" && userProfile.landId
      ? userProfile.landId
      : landId;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .select(
      `
        id,
        title,
        description,
        file_name,
        file_path,
        file_type,
        file_size,
        target_time,
        hidden_from_operator,
        created_at,
        folder_id,
        land_id,
        folders (
          id,
          name,
          land_id
        )
      `
    )
    .is("folder_id", null)
    .eq("land_id", effectiveLandId)
    .eq("hidden_from_operator", false)
    .or("is_active.eq.true,is_active.is.null")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Initial documents error:", error);
    return [];
  }

  return (data ?? []).map((doc: any) => ({
    id: doc.id,
    landId: doc.land_id ?? doc.folders?.land_id ?? undefined,
    title: doc.title,
    description: doc.description,
    category: "Lainnya",
    type: doc.file_type,
    file: {
      name: doc.file_name,
      path: doc.file_path,
      size: doc.file_size,
    },
    targetTime: doc.target_time,
    hiddenFromOperator: doc.hidden_from_operator,
  }));
}
