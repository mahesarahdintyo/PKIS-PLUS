# ⚡ Quick Reference Card - PT ABC Document Center

**Print this or bookmark it for quick access!**

---

## 🎮 How to Use in 30 Seconds

### Upload
```
Click "Upload Document" 
    ↓
Fill: Title (required), Description, Category, File (required)
    ↓
Click "Upload"
    ↓
Wait for success message
    ↓
Document appears in list!
```

### Download
```
Find document in list
    ↓
Click Download button (arrow down icon)
    ↓
Browser downloads file automatically
```

### Search
```
Type in search box
    ↓
Results filter in real-time
    ↓
All matching documents shown
```

### Filter by Category
```
Click category button (Semua, SOP, Manual, Form, Lainnya)
    ↓
Shows only documents in that category
```

### Delete
```
Click Trash icon on document
    ↓
Confirm deletion
    ↓
Document removed
```

---

## 🎯 Quick Tips

| Task | Shortcut |
|------|----------|
| Upload Doc | Click green "Upload Document" button |
| Search | Type in search box - updates instantly |
| Filter | Click category button |
| Download | Click blue Download button |
| Delete | Click red Trash button + confirm |
| Reset | Click "Semua" to reset filters |
| Clear Search | Clear search box or click "Semua" |

---

## 📋 Upload Form Fields

| Field | Required? | Notes |
|-------|-----------|-------|
| **Title** | ✅ Yes | Max file name length |
| **Description** | ❌ Optional | Helps with searching |
| **Category** | ❌ Optional | Can set later if needed |
| **File** | ✅ Yes | Max 50MB per file |

---

## 🏷️ Document Categories

- **SOP** - Standard Operating Procedures (how-to guides)
- **Manual** - User Manuals and Guides (product documentation)
- **Form** - Forms and Templates (official forms)
- **Lainnya** - Other Documents (miscellaneous)

---

## 📊 What You'll See

```
HEADER
├─ Logo & Title
└─ Green "Upload Document" button

SEARCH & FILTER
├─ Search box (search by title/description)
└─ Category buttons (Semua, SOP, Manual, Form, Lainnya)

DOCUMENT LIST
├─ Count of documents shown
└─ Cards with:
   ├─ Document icon
   ├─ Title & Description
   ├─ File type badge
   ├─ Blue Download button
   └─ Red Delete button

FOOTER
└─ Copyright info
```

---

## 🔍 Search Examples

| Search Term | Finds |
|-------------|-------|
| "SOP" | Documents with SOP in title/description |
| "customer" | Documents about customers |
| "2024" | Documents mentioning 2024 |
| "manual" | Documents with manual in title/desc |

---

## ⏱️ Common Tasks & Time

| Task | Time |
|------|------|
| Upload document | 30 seconds |
| Find document by search | 5 seconds |
| Filter by category | 2 seconds |
| Download document | 5 seconds |
| Delete document | 10 seconds |

---

## ❓ FAQ

**Q: What file types can I upload?**
A: Any file type (PDF, Word, Excel, Images, etc). Max 50MB.

**Q: Where is my file stored?**
A: In Supabase cloud storage (secure and backed up).

**Q: Can I rename a document?**
A: Not currently - would need to delete and re-upload.

**Q: How long can I download?**
A: Download link valid for 1 hour after generation.

**Q: Can multiple people upload?**
A: Yes, everyone can upload (in development). In production, only admins.

**Q: What if upload fails?**
A: Try again. Check file size < 50MB and internet connection.

**Q: How do I update a document?**
A: Delete old one, upload new one with new version name.

**Q: Is data backed up?**
A: Yes! Supabase includes automatic backups.

---

## 🎨 UI Elements Guide

| Icon/Button | What it does |
|-------------|------------|
| 🟦 Blue ABC Logo | Link to app (future feature) |
| 🟢 Upload Document | Open upload dialog |
| 🔍 Search box | Search documents |
| 🔘 Category buttons | Filter by category |
| 📄 File icon | Document indicator |
| ⬇️ Download button | Download the file |
| 🗑️ Delete button | Delete the document |

---

## 🚨 Error Messages & Fix

| Error | Fix |
|-------|-----|
| "File size must be less than 50MB" | Choose smaller file |
| "Title is required" | Fill in document title |
| "File is required" | Select a file to upload |
| "Failed to fetch documents" | Check internet, refresh page |
| "Failed to download" | File may be deleted, try again |
| "Failed to delete" | Refresh and try again |

---

## 💾 Where Things Live

- **Documents**: In Supabase cloud (encrypted storage)
- **Database**: PostgreSQL on Supabase (automatic backups)
- **App Code**: Next.js running on localhost (Antigravity)
- **Your Computer**: Nothing saved locally (except browser cache)

---

## 🔐 Security Notes

- ✅ Downloads use temporary secure links (1 hour)
- ✅ Files encrypted in storage
- ✅ Database protected
- ✅ No data sent to 3rd parties
- ✅ HTTPS for all connections

---

## 📱 Mobile-Friendly?

Yes! The app works on:
- ✅ Desktop computers
- ✅ Tablets
- ✅ Mobile phones

All features available on all devices.

---

## 🚀 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Tab | Navigate through fields |
| Enter | Submit form (upload) |
| Escape | Close upload dialog |
| Ctrl+F | Browser search on page |

---

## 📞 Troubleshooting Steps

**App not loading?**
1. Refresh page (Ctrl+R)
2. Clear browser cache (Ctrl+Shift+Delete)
3. Try different browser
4. Check internet connection

**Documents not showing?**
1. Refresh page
2. Check internet connection
3. Try uploading test document
4. Check browser console (F12)

**Upload not working?**
1. Check file size < 50MB
2. Check internet connection
3. Try different file type
4. Try refreshing page

---

## 📚 Need More Help?

📖 See these files:
- **SETUP_GUIDE.md** - Full user guide
- **IMPLEMENTATION_SUMMARY.md** - Technical details
- **SUPABASE_INTEGRATION_README.md** - Architecture guide

---

## 👥 Contact Support

**For Issues:**
1. Check browser console (F12 → Console)
2. Try refreshing page
3. Try different browser
4. Check SETUP_GUIDE.md troubleshooting section

---

**🎯 You're all set! Enjoy managing your documents! 📚✨**

**Bookmark this page for quick reference!**
