# 🔗 Supabase Integration - PT ABC Document Center

Panduan lengkap untuk menggunakan Pusat Dokumen PT ABC dengan backend Supabase.

---

## 📖 Dokumentasi

Ada 3 file dokumentasi yang tersedia:

### 1. **SETUP_GUIDE.md** 📚 (Baca ini PERTAMA)
- Penjelasan apa yang sudah diintegrasikan
- Cara menjalankan aplikasi di Antigravity
- Cara menggunakan aplikasi (upload, download, search, filter)
- Struktur database Supabase
- Troubleshooting umum

### 2. **IMPLEMENTATION_SUMMARY.md** 🔧
- Summary teknis implementasi
- File structure yang dibuat
- API endpoints detail
- Database schema lengkap
- Checklist testing
- Recommended next steps

### 3. **SUPABASE_INTEGRATION_README.md** (File ini)
- Ringkasan cepat
- Quick start guide
- Architecture overview
- Contact & support

---

## 🚀 Quick Start (5 Menit)

### Step 1: Install & Run
```bash
cd /path/to/project
pnpm install
pnpm dev
```

### Step 2: Buka di Browser
```
http://localhost:3000
```

### Step 3: Upload Dokumen
- Klik "Upload Document"
- Isi form (title, file wajib)
- Pilih file (max 50MB)
- Klik "Upload"

### Step 4: Lihat Dokumen
- Dokumen akan muncul di list
- Gunakan Search untuk cari
- Gunakan Filter untuk kategori
- Klik Download atau Delete

**Done! 🎉**

---

## 🏗️ Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────┐
│                   Browser / Frontend                     │
│                  (React 19, Next.js 16)                 │
├─────────────────────────────────────────────────────────┤
│                   Next.js API Routes                     │
│  (/api/documents, /api/upload, /api/download, etc)     │
├─────────────────────────────────────────────────────────┤
│                   Supabase Backend                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │  PostgreSQL Database                              │  │
│  │  - categories table                               │  │
│  │  - documents table                                │  │
│  ├──────────────────────────────────────────────────┤  │
│  │  Storage (S3-compatible)                          │  │
│  │  - documents bucket                               │  │
│  │  - File storage & retrieval                       │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Data Flow:

**Upload:**
```
User Form → API /api/upload → Supabase Storage (file) 
                            ↓
                        Database (record)
                            ↓
                        UI updates
```

**Download:**
```
User Click → API /api/download → Generate Signed URL 
                                ↓
                            Browser download
```

**List:**
```
Page Mount → API /api/documents → Fetch from Database
                              ↓
                          API /api/categories
                              ↓
                          UI render
```

---

## 📊 Database Schema

### Categories Table
```
┌─────────────────────────────────────────┐
│ categories                               │
├─────────────────────────────────────────┤
│ id          INTEGER (PRIMARY KEY)       │
│ name        TEXT (UNIQUE)               │
│ description TEXT                        │
│ created_at  TIMESTAMP                   │
└─────────────────────────────────────────┘
```

### Documents Table
```
┌──────────────────────────────────────────┐
│ documents                                │
├──────────────────────────────────────────┤
│ id          UUID (PRIMARY KEY)          │
│ title       TEXT                        │
│ description TEXT                        │
│ category_id INTEGER (FK → categories)   │
│ file_name   TEXT                        │
│ file_path   TEXT                        │
│ file_size   INTEGER                     │
│ file_type   TEXT                        │
│ uploaded_by TEXT                        │
│ created_at  TIMESTAMP                   │
│ updated_at  TIMESTAMP                   │
└──────────────────────────────────────────┘
```

---

## 🔌 API Endpoints Quick Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/documents` | Fetch all documents |
| POST | `/api/documents` | Create document record |
| DELETE | `/api/documents/[id]` | Delete document & file |
| GET | `/api/categories` | Fetch all categories |
| POST | `/api/upload` | Upload file & create record |
| POST | `/api/download` | Generate signed URL |

---

## 💡 Key Features

### ✅ Upload Documents
- Direct to Supabase Storage
- Auto-naming dengan timestamp
- File size validation (50MB)
- Type detection automatic
- Error handling & rollback

### ✅ Fetch Documents
- Real-time from database
- Metadata included (size, type, date)
- Category information joined
- Sorted by date (newest first)

### ✅ Search & Filter
- Real-time search (title + description)
- Category filter
- Combination support
- Case-insensitive

### ✅ Download Files
- Secure signed URLs
- 1-hour expiration
- Browser auto-download
- File name preserved

### ✅ Delete Documents
- Confirm dialog
- File + record delete
- Atomic operation (fails = rollback)

---

## 🔐 Security Model

### Row Level Security
- Public read untuk documents & categories
- Public write untuk development
- **For production:** Update RLS policies

### Signed URLs
- Generated per-request
- Temporary (1 hour)
- Cannot be guessed

### Input Validation
- Required fields check
- File size limit
- Type detection
- SQL injection prevention (parameterized queries)

---

## 🛠️ Environment Variables

Required variables (auto-set by Supabase integration):
```
NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-key-here
SUPABASE_SERVICE_ROLE_KEY=service-key-here
```

---

## 📝 Common Use Cases

### Use Case 1: Share Company SOP
1. Admin upload SOP PDF
2. Kategori: SOP
3. User search untuk "SOP" atau filter kategori SOP
4. User download langsung dari list

### Use Case 2: Manage Forms
1. Admin upload multiple forms (PDF, Excel, Word)
2. Kategori: Form
3. User filter kategori Form
4. User download form yang dibutuhkan

### Use Case 3: Document Repository
1. Upload semua dokumen perusahaan
2. Organize dengan kategori
3. User cari berdasarkan title/description
4. User download document yang relevan

---

## 🚨 Troubleshooting Quick Fix

| Problem | Solution |
|---------|----------|
| Documents tidak muncul | Check Supabase connection, lihat console (F12) |
| Upload gagal | Check file size < 50MB, check internet |
| Categories tidak muncul | Verify categories table filled di Supabase |
| Download tidak jalan | File mungkin sudah dihapus, coba upload ulang |
| API error 500 | Check server logs, check database connection |

---

## 🧪 Testing Checklist

Sebelum production:
- [ ] Upload dokumen berhasil
- [ ] Dokumen muncul di list
- [ ] Search functionality works
- [ ] Filter functionality works
- [ ] Download works
- [ ] Delete works
- [ ] Load time acceptable
- [ ] Mobile responsive

---

## 📞 Getting Help

### Check These Files
1. **SETUP_GUIDE.md** - Untuk troubleshooting & usage
2. **IMPLEMENTATION_SUMMARY.md** - Untuk technical details

### Check These Places
1. Browser Console (F12 → Console) - JavaScript errors
2. Network Tab (F12 → Network) - API responses
3. Server Terminal - Request logs
4. Supabase Dashboard - Database state

### External Resources
- Supabase: https://supabase.com/docs
- Next.js: https://nextjs.org/docs
- React: https://react.dev

---

## 🚀 Next Steps

### Immediate (Optional)
- [ ] Test upload/download/delete
- [ ] Customize upload form
- [ ] Add more file types support

### Short Term (Recommended)
- [ ] Add authentication (OAuth, email)
- [ ] Restrict upload to authenticated users only
- [ ] Add admin dashboard
- [ ] Add audit logging

### Long Term (Advanced)
- [ ] Document versioning
- [ ] Full-text search
- [ ] Comments/collaboration
- [ ] Advanced permissions
- [ ] Analytics dashboard

---

## 📦 Tech Stack Summary

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Next.js 16, TypeScript |
| **Styling** | Tailwind CSS |
| **Icons** | Lucide React |
| **API** | Next.js API Routes |
| **Database** | Supabase (PostgreSQL) |
| **Storage** | Supabase Storage (S3) |
| **Auth** | Built-in (no auth for now) |

---

## 🎯 Success Criteria

✅ **Your integration is successful when:**
- Application runs tanpa error
- Categories muncul dari database
- Upload dialog functional
- Search & filter works
- Can test upload/download flow

---

## 📄 License & Credits

**Created with:** v0.app, Next.js 16, Supabase

**For:** PT ABC Document Management System

**Date:** 2024

---

## 📞 Questions?

Refer ke:
1. **SETUP_GUIDE.md** untuk usage questions
2. **IMPLEMENTATION_SUMMARY.md** untuk technical questions
3. Supabase docs untuk database questions
4. Next.js docs untuk framework questions

---

**🎉 Selamat! Aplikasi Anda sudah siap dengan Supabase integration!**

Untuk langkah selanjutnya, lihat **SETUP_GUIDE.md**
