export interface PartNumber {
  id: string;
  code: string;
  description?: string | null;
  created_at: string;
}

export async function getPartNumbers(): Promise<PartNumber[]> {
  const url = "/api/part-numbers";

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Gagal memuat part numbers");
  }

  return response.json();
}

export async function createPartNumber(
  code: string,
  description?: string
): Promise<PartNumber> {
  const url = "/api/part-numbers";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code, description }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error ?? "Gagal menyimpan part number");
  }

  return response.json();
}

export async function deletePartNumber(id: string): Promise<boolean> {
  const url = `/api/part-numbers?id=${encodeURIComponent(id)}`;

  const response = await fetch(url, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error ?? "Gagal menghapus part number");
  }

  return true;
}
