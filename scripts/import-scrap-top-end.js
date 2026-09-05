/**
 * Script Migrasi Data Scrap Top-End dari project lama (database-nu-two) ke PKIS-PLUS
 *
 * Sumber : tabel `scrap_top_end` (database-nu-two)
 * Tujuan : tabel `prod_scrap_top_end` (PKIS-PLUS)
 *
 * Penggunaan:
 *   node scripts/import-scrap-top-end.js --dry-run
 *   node scripts/import-scrap-top-end.js
 *   node scripts/import-scrap-top-end.js --file=scripts/data/scrap_top_end_rows.csv --dry-run
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Load Environment Variables dari .env.local atau .env
function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const envPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
    }
  }
}

// 2. Robust CSV Parser (sama seperti import-part-numbers.js)
function parseCSV(text) {
  const lines = [];
  let currentField = '';
  let currentLine = [];
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentLine.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentLine.push(currentField.trim());
      currentField = '';
      if (currentLine.some((f) => f.length > 0)) {
        lines.push(currentLine);
      }
      currentLine = [];
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentLine.length > 0) {
    currentLine.push(currentField.trim());
    if (currentLine.some((f) => f.length > 0)) {
      lines.push(currentLine);
    }
  }

  if (lines.length < 2) return [];

  const headers = lines[0].map((h) => h.replace(/^["']|["']$/g, '').trim().toLowerCase());
  const rows = [];

  for (let r = 1; r < lines.length; r++) {
    const values = lines[r];
    const rowObj = {};
    headers.forEach((h, idx) => {
      rowObj[h] = values[idx] !== undefined ? values[idx].replace(/^["']|["']$/g, '').trim() : '';
    });
    rows.push(rowObj);
  }

  return rows;
}

function parseNumeric(val, defaultVal = null) {
  if (val === '' || val === null || val === undefined) return defaultVal;
  const num = Number(val);
  return isNaN(num) ? defaultVal : num;
}

function parseInt10(val, defaultVal = null) {
  if (val === '' || val === null || val === undefined) return defaultVal;
  const num = parseInt(val, 10);
  return isNaN(num) ? defaultVal : num;
}

async function main() {
  loadEnv();

  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const customFileArg = args.find((a) => a.startsWith('--file='));
  const filePath = customFileArg
    ? customFileArg.split('=')[1]
    : path.resolve(process.cwd(), 'scripts/data/scrap_top_end_rows.csv');

  console.log('='.repeat(65));
  console.log('📦 PKIS-PLUS: SCRIPT MIGRASI SCRAP TOP-END');
  console.log(`MODE      : ${isDryRun ? '🔍 DRY RUN (Simulasi / Tidak ada insert)' : '🚀 LIVE INSERT'}`);
  console.log(`FILE CSV  : ${filePath}`);
  console.log('='.repeat(65));

  if (!fs.existsSync(filePath)) {
    console.error(`\n❌ File CSV tidak ditemukan di: ${filePath}`);
    console.log(`\nSilakan letakkan file export CSV di: 📁 ${filePath}`);
    console.log('atau gunakan argumen: --file=/path/ke/file.csv\n');
    process.exit(1);
  }

  const fileContent = fs.readFileSync(filePath, 'utf8');
  const rawRows = parseCSV(fileContent);

  if (rawRows.length === 0) {
    console.error('❌ File CSV kosong atau format header tidak valid.');
    process.exit(1);
  }

  console.log(`\n📄 Ditemukan ${rawRows.length} baris data pada CSV.\n`);

  const validRecords = [];
  const skippedRecords = [];

  for (let idx = 0; idx < rawRows.length; idx++) {
    const row = rawRows[idx];
    const rowNum = idx + 2;

    const tahun = parseInt10(row.tahun);
    const bulan = parseInt10(row.bulan);

    if (!tahun || !bulan || bulan < 1 || bulan > 12) {
      skippedRecords.push({ rowNum, tahun: row.tahun, bulan: row.bulan, reason: 'tahun/bulan kosong atau tidak valid' });
      continue;
    }

    validRecords.push({
      // id dipertahankan dari sumber supaya bisa ditelusuri, upsert tetap pakai kunci (tahun, bulan)
      id: row.id || undefined,
      tahun,
      bulan,
      scrap_value_kidr: parseNumeric(row.scrap_value_kidr, 0),
      total_value_kidr: parseNumeric(row.total_value_kidr, 0),
      target_rasio: parseNumeric(row.target_rasio, null),
      is_active: true,
      created_at: row.created_at || new Date().toISOString(),
    });
  }

  console.log('-----------------------------------------------------------------');
  console.log(`📊 Hasil Analisis Data:`);
  console.log(`   - Total Baris Sumber : ${rawRows.length}`);
  console.log(`   - Siap Di-import     : ${validRecords.length} record`);
  console.log(`   - Di-skip (Invalid)  : ${skippedRecords.length} baris`);
  console.log('-----------------------------------------------------------------');

  if (skippedRecords.length > 0) {
    console.log('\n⚠️ Daftar Record yang Di-skip:');
    skippedRecords.forEach((s) => {
      console.log(`   - [Baris ${s.rowNum}] tahun: '${s.tahun}', bulan: '${s.bulan}' -> Alasan: ${s.reason}`);
    });
  }

  console.log('\n🔍 SAMPLE HASIL TRANSFORMASI (Maksimal 3 record pertama):');
  console.log(JSON.stringify(validRecords.slice(0, 3), null, 2));

  if (isDryRun) {
    console.log('\n✅ SIMULASI (DRY RUN) SELESAI.');
    console.log('   Tidak ada data yang diubah atau di-insert ke database.');
    console.log('   Jalankan tanpa flag --dry-run untuk mengeksekusi import ke Supabase.\n');
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('\n❌ Supabase URL atau Key tidak ditemukan di environment variable (.env.local)!');
    process.exit(1);
  }

  console.log(`\n🚀 Melakukan upsert ke Supabase: ${supabaseUrl}...`);
  const supabase = createClient(supabaseUrl, supabaseKey);

  const BATCH_SIZE = 50;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
    const batch = validRecords.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('prod_scrap_top_end')
      .upsert(batch, { onConflict: 'tahun,bulan' });

    if (error) {
      console.error(`❌ Gagal mengimpor batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
      failCount += batch.length;
    } else {
      successCount += batch.length;
      console.log(`   ✓ Berhasil mengimpor ${successCount}/${validRecords.length} record...`);
    }
  }

  console.log('\n=================================================================');
  console.log(`🎉 MIGRASI SELESAI!`);
  console.log(`   - Berhasil : ${successCount}`);
  console.log(`   - Gagal    : ${failCount}`);
  console.log(`   - Di-skip  : ${skippedRecords.length}`);
  console.log('=================================================================\n');
}

main().catch((err) => {
  console.error('\n❌ Terjadi kesalahan saat menjalankan script:', err);
  process.exit(1);
});
