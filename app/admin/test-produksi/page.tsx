import { createClient } from '@/lib/supabase/server'

export default async function TestProduksiPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('prod_part_numbers')
    .select('*')
    .limit(1)

  if (error) {
    return (
      <div>
        <h1>Test Produksi</h1>
        <p>Query error: {error.message}</p>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div>
        <h1>Test Produksi</h1>
        <p>Tabel prod_part_numbers kosong, tapi query berhasil jalan tanpa error.</p>
      </div>
    )
  }

  return (
    <div>
      <h1>Test Produksi</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  )
}
