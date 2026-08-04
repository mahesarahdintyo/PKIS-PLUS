export interface NgCategory {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
}

export async function getNgCategories(): Promise<NgCategory[]> {
  const response = await fetch("/api/ng-categories", {
    cache: "no-store",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Gagal memuat kategori NG");
  }

  return response.json();
}

export async function createNgCategory(
  name: string,
  description?: string
): Promise<NgCategory> {
  const response = await fetch("/api/ng-categories", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, description }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error ?? "Gagal menyimpan kategori NG");
  }

  return response.json();
}

export async function deleteNgCategory(id: string): Promise<boolean> {
  const response = await fetch(
    `/api/ng-categories?id=${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error ?? "Gagal menghapus kategori NG");
  }

  return true;
}
