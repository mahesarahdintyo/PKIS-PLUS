export interface Land {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  hidden_from_operator?: boolean;
  document_count?: number;
}

interface LandQuery {
  includeHidden?: boolean;
  trash?: boolean;
}

export async function getLands({
  includeHidden = false,
  trash = false,
}: LandQuery = {}): Promise<Land[]> {
  const params = new URLSearchParams();

  if (includeHidden) {
    params.set("includeHidden", "true");
  }

  if (trash) {
    params.set("trash", "true");
  }

  const query = params.toString();
  const url = `/api/lands${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Failed to load lands");
  }

  const data = await response.json();

  return data;
}
