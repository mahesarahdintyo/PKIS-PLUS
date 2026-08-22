# Walkthrough: Rename Total "Land" -> "Line" & Restrukturisasi Produksi

## Ringkasan Tahap 1 Selesai

Tahap 1 yaitu **Rename total "land" / "lands" -> "line" / "lines"** telah selesai di seluruh basis kode: database migration, services, komponen UI, API routes, dan halaman operator & admin.

### 1. Database Migration
- Berkas migrasi: `supabase/migrations/20260718_rename_lands_to_lines.sql`
- Mengganti nama tabel `lands` -> `lines` menggunakan `ALTER TABLE lands RENAME TO lines;` (mempertahankan data dan UUID).
- Mengganti nama kolom foreign key `land_id` -> `line_id` pada tabel:
  - `profiles`
  - `documents`
  - `folders`
  - `production_reports`
  - `display_heartbeats`

### 2. Services & Workspace Server
- `lib/services/line.ts`: Dibuat untuk menggantikan `land.ts` (`Line` interface, `getLines`).
- `lib/services/document.ts`: Menggunakan `lineId` dan `line_id`.
- `lib/services/folder.ts`: Menggunakan `lineId` dan `line_id`.
- `lib/services/production-report.ts`: Relasi `line:lines(name)` dan parameter `lineId`.
- `lib/services/auth-server.ts`: Membaca `line_id` dari profil user.
- `lib/services/workspace-server.ts`: Fungsi `getInitialLines()`, `getInitialFolders(lineId)`, `getInitialDocuments(lineId)`.

### 3. Komponen UI
- `components/admin/AdminLineCard.tsx` (menggantikan `AdminLandCard.tsx`)
- `components/admin/CreateLineDialog.tsx` (menggantikan `CreateLandDialog.tsx`)
- `components/operator/LineSelector.tsx` (menggantikan `LandSelector.tsx`)
- `components/operator/OperatorHeader.tsx`, `DocumentList.tsx`, `document-card.tsx`, `upload-dialog.tsx`, `create-folder-dialog.tsx`, `ProductionReportsDashboard.tsx`.

### 4. API Routes
- `app/api/lines/route.ts`: CRUD untuk tabel `lines` dan relasi `line_id` (menggantikan `app/api/lands/route.ts`).
- `app/api/documents/route.ts`: Menggunakan `line_id` dan `lineId`.
- `app/api/folders/route.ts`: Menggunakan `line_id` dan `lineId`.
- `app/api/production-reports/route.ts`: Menggunakan `line_id` dan relasi `line:lines(name)`.
- `app/api/display-document/route.ts`: Menggunakan `lineId` & `line_id`.
- `app/api/system/display-heartbeat/route.ts`: Menggunakan `line_id`.
- `app/api/system/health/route.ts`: Memeriksa tabel `lines`.
- `app/api/admin/recycle-bin/route.ts`: Mendukung `line` dan tabel `lines`.

### 5. App Pages
- `app/display/[lineId]/page.tsx` & `app/display/display-page-client.tsx` & `app/display/page.tsx`
- `app/admin/admin-page-client.tsx` & `app/admin/page.tsx`
- `app/admin/recycle-bin/recycle-bin-client.tsx`
- `app/operator/operator-page-client.tsx` & `app/operator/machines/[slug]/page.tsx`
- `app/actions/auth.ts` & `app/system/system-page-client.tsx`

---

## Verifikasi
- `npm run build` : **PASS** (18/18 static & dynamic routes compiled)
- `npx tsc --noEmit` : **PASS** (0 TypeScript errors)

---

## Tahap Selanjutnya (Tahap 2): Restrukturisasi Machine -> Line
1. Tambahkan kolom `machine_type` pada tabel `lines` dan relasi `line_id` pada tabel-tabel `prod_*`.
2. Halaman `/operator/machines` dan komponen Machine Picker mengambil data dinamis dari tabel `lines` (`machine_type`), bukan dari constant hardcoded.
3. Seluruh query `prod_*` diselaraskan agar mengikat ke `line_id` (dengan kolom `mesin` tetap dipertahankan sebagai fallback aman).
