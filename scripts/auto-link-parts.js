/**
 * Script Auto-Link Dokumen ke Part Number berdasarkan kemiripan nama
 * 
 * Penggunaan:
 *   node scripts/auto-link-parts.js --dry-run
 *   node scripts/auto-link-parts.js --line=blanking --dry-run
 *   node scripts/auto-link-parts.js --line=blanking
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

// Normalisasi teks untuk perbandingan (hilangkan ekstensi file, karakter non-alphanumeric, noise words, dan huruf/angka rancu)
function cleanNoise(str) {
  if (!str) return '';
  return str
    .replace(/\.[a-zA-Z0-9]+$/g, '') // hapus ekstensi .pdf dll
    .toLowerCase()
    .replace(/pkis/g, '')
    .replace(/finish/g, '')
    .replace(/\(reg\)/g, '')
    .replace(/reg/g, '')
    .replace(/rev\s*[0-9.]+/g, '')
    .replace(/^xx[.\s]*/g, '')
    .replace(/^[0-9]+[.\s]+/g, '') // hapus nomor urut di awal misal "188. "
    .trim();
}

function normalizeString(str) {
  if (!str) return '';
  const cleaned = cleanNoise(str);
  return cleaned
    .replace(/[^a-z0-9]/g, '') // buang spasi, titik, slash, koma, strip
    .trim();
}

// Normalisasi longgar (memperlakukan 1 dan i sama jika dalam kode part)
function looseNormalize(str) {
  return normalizeString(str)
    .replace(/i/g, '1')
    .replace(/000+/g, '00'); // normalisasi typo triple zero
}

async function main() {
  loadEnv();

  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const lineArg = args.find((a) => a.startsWith('--line='))?.split('=')[1] || 'blanking';
  const targetLineId = MACHINE_TO_LINE_ID[lineArg] || lineArg;

  console.log('='.repeat(65));
  console.log('🔗 PKIS-PLUS: AUTO-LINK DOKUMEN KE PART NUMBER');
  console.log(`MODE      : ${isDryRun ? '🔍 DRY RUN (Simulasi / Tidak ada perubahan DB)' : '🚀 LIVE LINKING'}`);
  console.log(`TARGET    : Line '${lineArg}' (${targetLineId})`);
  console.log('='.repeat(65));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase URL atau Key tidak ditemukan di environment variables!');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Ambil semua dokumen aktif pada line tersebut (exclude yang di tempat sampah)
  const { data: documents, error: docErr } = await supabase
    .from('documents')
    .select('id, title, file_name, line_id')
    .eq('line_id', targetLineId)
    .or('is_active.eq.true,is_active.is.null');

  if (docErr) {
    console.error('❌ Gagal mengambil daftar dokumen:', docErr.message);
    process.exit(1);
  }

  // 2. Ambil semua part number pada line tersebut
  const { data: partNumbers, error: partErr } = await supabase
    .from('prod_part_numbers')
    .select('id, value, document_id, line_id, mesin')
    .or(`line_id.eq.${targetLineId},mesin.eq.${lineArg}`)
    .eq('is_active', true);

  if (partErr) {
    console.error('❌ Gagal mengambil daftar part numbers:', partErr.message);
    process.exit(1);
  }

  console.log(`\n📄 Ditemukan ${documents?.length || 0} Dokumen di Line ${lineArg}`);
  console.log(`🔢 Ditemukan ${partNumbers?.length || 0} Part Number di Line ${lineArg}\n`);

  if (!documents || documents.length === 0) {
    console.log('⚠️ Tidak ada dokumen yang ditemukan pada line ini.');
    return;
  }

  if (!partNumbers || partNumbers.length === 0) {
    console.log('⚠️ Tidak ada part number yang ditemukan pada line ini.');
    return;
  }

  const matches = [];
  const unmatchedDocs = [];

  for (const doc of documents) {
    const normTitle = normalizeString(doc.title);
    const normFileName = normalizeString(doc.file_name);

    let matchedPart = null;
    let matchType = '';

    // 1. Exact match pada title / file_name
    for (const part of partNumbers) {
      const normPart = normalizeString(part.value);

      if (normTitle === normPart || normFileName === normPart) {
        matchedPart = part;
        matchType = 'EXACT MATCH';
        break;
      }
    }

    // 2. Partial / Substring match jika exact tidak ketemu
    if (!matchedPart) {
      for (const part of partNumbers) {
        const normPart = normalizeString(part.value);

        if (normPart.length >= 4 && (normTitle.includes(normPart) || normFileName.includes(normPart) || normPart.includes(normTitle))) {
          matchedPart = part;
          matchType = 'SIMILARITY / SUBSTRING';
          break;
        }
      }
    }

    // 3. Loose Normalization (mengabaikan 1/I dan typo typo umum)
    if (!matchedPart) {
      const looseTitle = looseNormalize(doc.title);
      const looseFileName = looseNormalize(doc.file_name);

      for (const part of partNumbers) {
        const loosePart = looseNormalize(part.value);

        if (looseTitle === loosePart || looseFileName === loosePart || (loosePart.length >= 6 && (looseTitle.includes(loosePart) || looseFileName.includes(loosePart)))) {
          matchedPart = part;
          matchType = 'LOOSE MATCH (1/I/TYPO)';
          break;
        }
      }
    }

    if (matchedPart) {
      matches.push({
        docId: doc.id,
        docTitle: doc.title,
        docFileName: doc.file_name,
        partId: matchedPart.id,
        partValue: matchedPart.value,
        matchType,
        alreadyLinked: matchedPart.document_id === doc.id,
      });
    } else {
      unmatchedDocs.push(doc);
    }
  }

  console.log('-----------------------------------------------------------------');
  console.log(`📊 Hasil Pencocokan:`);
  console.log(`   - Berhasil Dicocokkan : ${matches.length} hubungan`);
  console.log(`   - Belum Ada Kecocokan : ${unmatchedDocs.length} dokumen`);
  console.log('-----------------------------------------------------------------');

  if (matches.length > 0) {
    console.log('\n📋 DAFTAR HUBUNGAN YANG DITEMUKAN:');
    matches.forEach((m, idx) => {
      console.log(
        `   ${idx + 1}. [${m.matchType}] Dokumen: "${m.docTitle}" (${m.docFileName}) -> Part Number: "${m.partValue}"`
      );
    });
  }

  if (unmatchedDocs.length > 0) {
    console.log('\n⚠️ DOKUMEN YANG BELUM COCOK DENGAN PART NUMBER MANAPUN:');
    unmatchedDocs.forEach((d, idx) => {
      console.log(`   ${idx + 1}. "${d.title}" (file: ${d.file_name})`);
    });
  }

  if (isDryRun) {
    console.log('\n✅ SIMULASI (DRY RUN) SELESAI.');
    console.log('   Tidak ada database yang diubah.');
    console.log('   Jalankan tanpa flag --dry-run untuk menghubungkan dokumen-dokumen tersebut secara live.\n');
    return;
  }

  // Live Update: Update prod_part_numbers.document_id
  console.log(`\n🚀 Mengupdate ${matches.length} part numbers di database Supabase...`);
  let successCount = 0;
  let failCount = 0;

  for (const m of matches) {
    const { error } = await supabase
      .from('prod_part_numbers')
      .update({ document_id: m.docId })
      .eq('id', m.partId);

    if (error) {
      console.error(`❌ Gagal menghubungkan part "${m.partValue}":`, error.message);
      failCount++;
    } else {
      successCount++;
    }
  }

  console.log('\n=================================================================');
  console.log(`🎉 PROSES PENGHUBUNGAN SELESAI!`);
  console.log(`   - Berhasil Dihubungkan : ${successCount}`);
  console.log(`   - Gagal                : ${failCount}`);
  console.log('=================================================================\n');
}

main().catch((err) => {
  console.error('❌ Terjadi kesalahan:', err);
  process.exit(1);
});
