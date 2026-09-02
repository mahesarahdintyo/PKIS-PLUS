/**
 * Script Migrasi Data Part Numbers dari project lama (database-nu-two) ke PKIS-PLUS
 * 
 * Penggunaan:
 *   node scripts/import-part-numbers.js --dry-run
 *   node scripts/import-part-numbers.js
 *   node scripts/import-part-numbers.js --file=scripts/data/part_numbers_export.csv --dry-run
 *   node scripts/import-part-numbers.js --include-aliases --dry-run
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Mapping mesin -> line_id sesuai tabel `lines`
const MACHINE_TO_LINE_ID = {
  blanking: '907b7090-c859-4d92-9667-50bc9efc52fc',
  transfer_2000t: '41707428-e87c-4914-8315-91e0615485a8',
  pc200t: '42fb5ddd-2f97-4b77-bd23-fdbe0a28384d',
  tandem: '10f5bab0-11e9-45fc-b9a3-80576cc39969',
  transfer_800t: 'dae18e3e-de93-4bc6-8dc1-d0ff8a507489',
};

const VALID_MACHINES = Object.keys(MACHINE_TO_LINE_ID);

// 2. Load Environment Variables dari .env.local atau .env
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

// 3. Robust CSV Parser (Menangani quoted text, JSON di dalam kolom, escaped quotes, dan newlines)
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
        i++; // skip escaped quote
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

// 4. Helper format JSON field
function parseJsonField(raw, defaultVal = []) {
  if (!raw) return defaultVal;
  try {
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    // Jika format string CSV sedikit rusak
    return defaultVal;
  }
}

// Helper numeric
function parseNumeric(val, defaultVal = null) {
  if (val === '' || val === null || val === undefined) return defaultVal;
  const num = Number(val);
  return isNaN(num) ? defaultVal : num;
}

async function main() {
  loadEnv();

  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const includeAliases = args.includes('--include-aliases');
  const customFileArg = args.find((a) => a.startsWith('--file='));
  const filePath = customFileArg
    ? customFileArg.split('=')[1]
    : path.resolve(process.cwd(), 'scripts/data/part_numbers_export.csv');

  console.log('='.repeat(65));
  console.log('📦 PKIS-PLUS: SCRIPT MIGRASI PART NUMBERS');
  console.log(`MODE      : ${isDryRun ? '🔍 DRY RUN (Simulasi / Tidak ada insert)' : '🚀 LIVE INSERT'}`);
  console.log(`FILE CSV  : ${filePath}`);
  console.log(`ALIASES   : ${includeAliases ? '✅ Di-impor sebagai baris terpisah' : '⏭️ Di-skip (hanya part number utama)'}`);
  console.log('='.repeat(65));

  if (!fs.existsSync(filePath)) {
    console.error(`\n❌ File CSV tidak ditemukan di: ${filePath}`);
    console.log('\nSilakan letakkan file export CSV di:');
    console.log(`📁 ${filePath}`);
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
    const rowNum = idx + 2; // header line = 1

    const rawMesin = (row.mesin || '').toLowerCase().trim();
    const value = (row.value || '').trim();

    // Validasi basic
    if (!value) {
      skippedRecords.push({ rowNum, value: '(kosong)', mesin: rawMesin, reason: 'Nilai kode part (value) kosong' });
      continue;
    }

    if (!rawMesin || !VALID_MACHINES.includes(rawMesin)) {
      skippedRecords.push({
        rowNum,
        value,
        mesin: rawMesin,
        reason: `Mesin '${rawMesin}' tidak valid. Harus salah satu dari: ${VALID_MACHINES.join(', ')}`,
      });
      continue;
    }

    const line_id = MACHINE_TO_LINE_ID[rawMesin];
    const std_ct = parseNumeric(row.std_ct);
    const std_mp = parseNumeric(row.std_mp);
    const stroke_ratio = parseNumeric(row.stroke_ratio, 1);
    const harga_pcs = parseNumeric(row.harga_pcs);
    const harga_rp = harga_pcs; // Samakan harga_rp dan harga_pcs
    const next_processes = parseJsonField(row.next_processes, []);

    // 1. Record Utama
    const mainRecord = {
      mesin: rawMesin,
      line_id,
      value,
      nama_part: value, // Default nama_part sama dengan kode part
      std_ct,
      std_mp,
      stroke_ratio,
      output_ratio: 1, // Default output_ratio = 1
      harga_pcs,
      harga_rp,
      next_processes,
      is_active: true,
      document_id: null,
      created_at: row.created_at || new Date().toISOString(),
    };

    validRecords.push(mainRecord);

    // 2. Record Alias jika diaktifkan
    if (includeAliases && row.alias_values) {
      const aliases = parseJsonField(row.alias_values, []);
      if (Array.isArray(aliases)) {
        for (const alias of aliases) {
          const aliasVal = typeof alias === 'string' ? alias.trim() : (alias?.value || alias?.part_number || '').trim();
          if (aliasVal && aliasVal !== value) {
            validRecords.push({
              mesin: rawMesin,
              line_id,
              value: aliasVal,
              nama_part: aliasVal,
              std_ct,
              std_mp,
              stroke_ratio,
              output_ratio: 1,
              harga_pcs,
              harga_rp,
              next_processes,
              is_active: true,
              document_id: null,
              created_at: row.created_at || new Date().toISOString(),
            });
          }
        }
      }
    }
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
      console.log(`   - [Baris ${s.rowNum}] Part: '${s.value}', Mesin: '${s.mesin}' -> Alasan: ${s.reason}`);
    });
  }

  // Tampilkan Sample Preview
  console.log('\n🔍 SAMPLE HASIL TRANSFORMASI (Maksimal 3 record pertama):');
  console.log(JSON.stringify(validRecords.slice(0, 3), null, 2));

  if (isDryRun) {
    console.log('\n✅ SIMULASI (DRY RUN) SELESAI.');
    console.log('   Tidak ada data yang diubah atau di-insert ke database.');
    console.log('   Jalankan tanpa flag --dry-run untuk mengeksekusi import ke Supabase.\n');
    return;
  }

  // Live Upsert ke Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('\n❌ Supabase URL atau Key tidak ditemukan di environment variable (.env.local)!');
    process.exit(1);
  }

  console.log(`\n🚀 Melakukan upsert ke Supabase: ${supabaseUrl}...`);
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Batch insert per 50 record
  const BATCH_SIZE = 50;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
    const batch = validRecords.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from('prod_part_numbers')
      .upsert(batch, { onConflict: 'mesin,value' });

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
