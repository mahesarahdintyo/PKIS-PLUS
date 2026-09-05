/**
 * Script Migrasi Data Mesin Settings dari project lama (database-nu-two) ke PKIS-PLUS
 *
 * Sumber : tabel `mesin_settings` (database-nu-two)
 * Tujuan : tabel `prod_mesin_settings` (PKIS-PLUS)
 *
 * Catatan: kolom `updated_by` di-null-kan (UUID user sumber tidak valid di
 * auth.users PKIS-PLUS). Kalau nanti ternyata perlu tau siapa yang set,
 * bisa diisi manual lewat halaman Master Data setelah data lain beres.
 *
 * Penggunaan:
 *   node scripts/import-mesin-settings.js --dry-run
 *   node scripts/import-mesin-settings.js
 *   node scripts/import-mesin-settings.js --file=scripts/data/mesin_settings_rows.csv --dry-run
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const VALID_MACHINES = ['blanking', 'transfer_2000t', 'pc200t', 'tandem', 'transfer_800t'];

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

function parseNumeric(val, defaultVal = 0) {
  if (val === '' || val === null || val === undefined) return defaultVal;
  const num = Number(val);
  return isNaN(num) ? defaultVal : num;
}

async function main() {
  loadEnv();

  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const customFileArg = args.find((a) => a.startsWith('--file='));
  const filePath = customFileArg
    ? customFileArg.split('=')[1]
    : path.resolve(process.cwd(), 'scripts/data/mesin_settings_rows.csv');

  console.log('='.repeat(65));
  console.log('📦 PKIS-PLUS: SCRIPT MIGRASI MESIN SETTINGS');
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

    const mesin = (row.mesin || '').toLowerCase().trim();
    if (!mesin || !VALID_MACHINES.includes(mesin)) {
      skippedRecords.push({ rowNum, mesin, reason: `Mesin '${mesin}' tidak valid` });
      continue;
    }

    const mode = (row.gsph_target_mode || 'fixed').trim();

    validRecords.push({
      mesin,
      gsph_target_mode: mode === 'per_part' ? 'per_part' : 'fixed',
      gsph_target_fixed: parseNumeric(row.gsph_target_fixed, 0),
      // Sengaja NULL - UUID user di project sumber tidak valid di PKIS-PLUS
      updated_by: null,
      updated_at: row.updated_at || new Date().toISOString(),
    });
  }

  console.log('-----------------------------------------------------------------');
  console.log(`📊 Hasil Analisis Data:`);
  console.log(`   - Total Baris Sumber : ${rawRows.length}`);
  console.log(`   - Siap Di-import     : ${validRecords.length} record`);
  console.log(`   - Di-skip            : ${skippedRecords.length} baris`);
  console.log('-----------------------------------------------------------------');

  if (skippedRecords.length > 0) {
    console.log('\n⚠️ Daftar Record yang Di-skip:');
    skippedRecords.forEach((s) => {
      console.log(`   - [Baris ${s.rowNum}] mesin: '${s.mesin}' -> Alasan: ${s.reason}`);
    });
  }

  console.log('\n🔍 SAMPLE HASIL TRANSFORMASI:');
  console.log(JSON.stringify(validRecords, null, 2));

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

  const { error } = await supabase
    .from('prod_mesin_settings')
    .upsert(validRecords, { onConflict: 'mesin' });

  if (error) {
    console.error(`❌ Gagal mengimpor:`, error.message);
    console.log('\n=================================================================');
    console.log(`🎉 MIGRASI SELESAI (DENGAN ERROR)`);
    console.log('=================================================================\n');
    process.exit(1);
  }

  console.log('\n=================================================================');
  console.log(`🎉 MIGRASI SELESAI!`);
  console.log(`   - Berhasil : ${validRecords.length}`);
  console.log(`   - Di-skip  : ${skippedRecords.length}`);
  console.log('=================================================================\n');
}

main().catch((err) => {
  console.error('\n❌ Terjadi kesalahan saat menjalankan script:', err);
  process.exit(1);
});
