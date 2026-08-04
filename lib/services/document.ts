export interface Document {
  id: string;
  landId?: string;
  title: string;
  description: string;
  category: string;
  type: string;
  file: {
    name: string;
    path: string;
    size?: number;
  };
  targetTime?: string | null;
  hiddenFromOperator?: boolean;
}

interface DocumentQuery {
  folderId?: number | null;
  landId?: string;
  search?: string;
  trash?: boolean;
  includeHidden?: boolean;
}

export async function getDocuments({
  folderId,
  landId,
  search,
  trash = false,
  includeHidden = false,
}: DocumentQuery = {}): Promise<Document[]> {
  const params = new URLSearchParams();

  if (typeof folderId === "number") {
    params.set("folderId", folderId.toString());
  }

  if (landId) {
    params.set("landId", landId);
  }

  if (search?.trim()) {
    params.set("search", search.trim());
  }

  if (trash) {
    params.set("trash", "true");
  }

  if (includeHidden) {
    params.set("includeHidden", "true");
  }

  const query = params.toString();
  const url = `/api/documents${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Failed to load documents");
  }

  const data = await response.json();

  return data;
}
