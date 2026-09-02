/**
 * Script Import Master Jenis Non-Produksi dari CSV ke tabel prod_nonproduksi_types Supabase
 *
 * Penggunaan:
 *   node scripts/import-nonproduksi-types.js --dry-run
 *   node scripts/import-nonproduksi-types.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const MACHINE_TO_LINE_ID = {
  blanking: '907b7090-c859-4d92-9667-50bc9efc52fc',
  transfer_2000t: '41707428-e87c-4914-8315-91e0615485a8',
  pc200t: '42fb5ddd-2f97-4b77-bd23-fdbe0a28384d',
  tandem: '10f5bab0-11e9-45fc-b9a3-80576cc39969',
  transfer_800t: 'dae18e3e-de93-4bc6-8dc1-d0ff8a507489',
};

const VALID_MACHINES = new Set([
  'tandem',
  'blanking',
  'transfer_2000t',
  'transfer_800t',
  'pc200t',
]);

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
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];

  function parseLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    return fields;
  }

  const headers = parseLine(lines[0]).map((h) => h.replace(/^["']|["']$/g, '').toLowerCase());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const values = parseLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] !== undefined ? values[idx] : '';
    });
    rows.push(row);
  }

  return rows;
}

function normalizeMesin(raw) {
  if (!raw) return null;
  const m = String(raw).trim().toLowerCase().replace(/-/g, '_');
  if (VALID_MACHINES.has(m)) return m;
  if (m.includes('blank')) return 'blanking';
  if (m.includes('2000')) return 'transfer_2000t';
  if (m.includes('800')) return 'transfer_800t';
  if (m.includes('200')) return 'pc200t';
  if (m.includes('tandem')) return 'tandem';
  return null;
}

async function main() {
  loadEnv();

  const isDryRun = process.argv.includes('--dry-run');
  const defaultFile = path.resolve(process.cwd(), 'scripts/data/non_produksi_export.csv');
  const argFile = process.argv.find((a) => a.endsWith('.csv'));
  const csvFilePath = argFile ? path.resolve(process.cwd(), argFile) : defaultFile;

  console.log('='.repeat(65));
  console.log('📦 PKIS-PLUS: IMPORT MASTER JENIS NON-PRODUKSI');
  console.log(`MODE : ${isDryRun ? '🔍 DRY RUN (Simulasi / Tidak ada perubahan DB)' : '🚀 LIVE IMPORT'}`);
  console.log(`FILE : ${csvFilePath}`);
  console.log('='.repeat(65));

  if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ File CSV tidak ditemukan di: ${csvFilePath}`);
    console.error('Silakan simpan file CSV export di folder scripts/data/non_produksi_export.csv');
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvFilePath, 'utf8');
  const rawRows = parseCSV(csvContent);
  console.log(`\n📄 Total baris dalam CSV: ${rawRows.length}`);

  if (rawRows.length === 0) {
    console.log('⚠️ File CSV kosong.');
    return;
  }

  console.log('📋 Kolom yang terdeteksi:', Object.keys(rawRows[0]).join(', '));

  const transformed = [];
  const skipped = [];

  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i];
    const nama = r.nama || r.name || r.value || r.jenis || r.tipe || r.kategori || '';
    const rawMesin = r.mesin || r.machine || r.line || '';
    const mesin = normalizeMesin(rawMesin);

    if (!nama.trim()) {
      skipped.push({ row: i + 2, reason: 'Nama jenis non-produksi kosong', data: r });
      continue;
    }

    if (!mesin) {
      skipped.push({ row: i + 2, reason: `Mesin "${rawMesin}" tidak valid`, data: r });
      continue;
    }

    const line_id = MACHINE_TO_LINE_ID[mesin];

    transformed.push({
      mesin,
      nama: nama.trim(),
      line_id,
      is_active: true,
      created_at: r.created_at || new Date().toISOString(),
    });
  }

  console.log('\n📊 Ringkasan Transformasi:');
  console.log(`   - Siap Di-import : ${transformed.length}`);
  console.log(`   - Di-skip        : ${skipped.length}`);

  if (skipped.length > 0) {
    console.log('\n⚠️ Contoh Baris yang Di-skip:');
    skipped.slice(0, 5).forEach((s) => {
      console.log(`   - Baris ${s.row}: ${s.reason}`);
    });
  }

  // Distribusi per mesin
  const byMachine = {};
  transformed.forEach((t) => {
    byMachine[t.mesin] = (byMachine[t.mesin] || 0) + 1;
  });
  console.log('\n🏭 Distribusi per Mesin/Line:');
  Object.entries(byMachine).forEach(([m, count]) => {
    console.log(`   - ${m.padEnd(16)}: ${count} jenis`);
  });

  console.log('\n🔍 Contoh 5 Data Hasil Transformasi:');
  console.log(JSON.stringify(transformed.slice(0, 5), null, 2));

  if (isDryRun) {
    console.log('\n✅ SIMULASI (DRY RUN) SELESAI.');
    console.log('   Tidak ada database yang diubah.');
    console.log('   Jalankan tanpa flag --dry-run untuk meng-import data ke Supabase.\n');
    return;
  }

  // Live Import: Upsert to prod_nonproduksi_types
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase URL atau Key tidak ditemukan!');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`\n🚀 Meng-upsert ${transformed.length} records ke prod_nonproduksi_types...`);

  const BATCH_SIZE = 50;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < transformed.length; i += BATCH_SIZE) {
    const batch = transformed.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('prod_nonproduksi_types')
      .upsert(batch, { onConflict: 'mesin,nama' });

    if (error) {
      console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} gagal:`, error.message);
      failCount += batch.length;
    } else {
      successCount += batch.length;
      process.stdout.write(`   Progress: ${Math.min(i + BATCH_SIZE, transformed.length)}/${transformed.length}\r`);
    }
  }

  console.log('\n=================================================================');
  console.log(`🎉 PROSES IMPORT SELESAI!`);
  console.log(`   - Berhasil Di-upsert : ${successCount}`);
  console.log(`   - Gagal              : ${failCount}`);
  console.log('=================================================================\n');
}

main().catch((err) => {
  console.error('❌ Terjadi kesalahan:', err);
  process.exit(1);
});
