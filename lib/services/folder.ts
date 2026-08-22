export interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  line_id: string;
  created_at: string;
  item_count?: number;
}

interface FolderQuery {
  lineId?: string;
  parentId?: number | null;
  includeAll?: boolean;
  search?: string;
  trash?: boolean;
}

export async function getFolders({
  lineId,
  parentId,
  includeAll = false,
  search,
  trash = false,
}: FolderQuery = {}): Promise<Folder[]> {
  const params = new URLSearchParams();

  if (lineId) {
    params.set("lineId", lineId);
  }

  if (typeof parentId === "number") {
    params.set("parentId", parentId.toString());
  }

  if (includeAll) {
    params.set("includeAll", "true");
  }

  if (search?.trim()) {
    params.set("search", search.trim());
  }

  if (trash) {
    params.set("trash", "true");
  }

  const query = params.toString();
  const url = `/api/folders${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Failed to load folders");
  }

  const data = await response.json();

  return data;
}

export async function getFoldersByLine(lineId: string): Promise<Folder[]> {
  return getFolders({ lineId });
}
