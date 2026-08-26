export interface Line {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  hidden_from_operator?: boolean;
  machine_type?: string | null;
  document_count?: number;
}

interface LineQuery {
  includeHidden?: boolean;
  trash?: boolean;
}

export async function getLines({
  includeHidden = false,
  trash = false,
}: LineQuery = {}): Promise<Line[]> {
  const params = new URLSearchParams();

  if (includeHidden) {
    params.set("includeHidden", "true");
  }

  if (trash) {
    params.set("trash", "true");
  }

  const query = params.toString();
  const url = `/api/lines${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Failed to load lines");
  }

  const data = await response.json();

  return data;
}
