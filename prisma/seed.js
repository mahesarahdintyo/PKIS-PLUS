// prisma/seed.js
// Script untuk mengisi data awal database PostgreSQL lokal (admin, profiles, default categories)

const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = process.env.PASSWORD_SALT || "pkis-salt-2026";
  return crypto.createHmac("sha256", salt).update(password).digest("hex");
}

async function main() {
  console.log("🌱 Menjalankan Database Seeder...");

  // 1. Buat User Admin Default
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || "admin@pabrik.local";
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || "admin123";

  const existingAdmin = await prisma.user.findFirst({
    where: { email: adminEmail },
  });

  let adminUser = existingAdmin;
  if (!existingAdmin) {
    adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        password_hash: hashPassword(adminPassword),
      },
    });
    console.log(`✅ User Admin dibuat: ${adminEmail} (password: ${adminPassword})`);
  } else {
    console.log(`ℹ️ User Admin sudah ada: ${adminUser.email}`);
  }

  // Profile Admin
  await prisma.profile.upsert({
    where: { id: adminUser.id },
    create: {
      id: adminUser.id,
      role: "admin",
    },
    update: {
      role: "admin",
    },
  });

  // 2. Buat User Operator Default
  const opEmail = "operator@pabrik.local";
  const opPassword = "operator123";
  let opUser = await prisma.user.findFirst({
    where: { email: opEmail },
  });

  if (!opUser) {
    opUser = await prisma.user.create({
      data: {
        email: opEmail,
        password_hash: hashPassword(opPassword),
      },
    });
    console.log(`✅ User Operator dibuat: ${opEmail} (password: ${opPassword})`);
  }

  await prisma.profile.upsert({
    where: { id: opUser.id },
    create: {
      id: opUser.id,
      role: "operator",
    },
    update: {
      role: "operator",
    },
  });

  // 3. Buat User Leader Default
  const leaderEmail = "leader@pabrik.local";
  const leaderPassword = "leader123";
  let leaderUser = await prisma.user.findFirst({
    where: { email: leaderEmail },
  });

  if (!leaderUser) {
    leaderUser = await prisma.user.create({
      data: {
        email: leaderEmail,
        password_hash: hashPassword(leaderPassword),
      },
    });
    console.log(`✅ User Leader dibuat: ${leaderEmail} (password: ${leaderPassword})`);
  }

  await prisma.profile.upsert({
    where: { id: leaderUser.id },
    create: {
      id: leaderUser.id,
      role: "leader",
    },
    update: {
      role: "leader",
    },
  });

  // 4. Default Categories
  const defaultCategories = [
    "Instruksi Kerja (IK)",
    "Standard Operating Procedure (SOP)",
    "Drawing / Gambar Kerja",
    "Form Pemeriksaan / Checksheet",
    "Dokumen Kualitas & Safety",
  ];

  for (const catName of defaultCategories) {
    const existing = await prisma.category.findFirst({ where: { name: catName } });
    if (!existing) {
      await prisma.category.create({ data: { name: catName } });
    }
  }
  console.log("✅ Kategori dokumen default siap.");

  console.log("\n🎉 Seeding selesai dengan sukses!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding gagal:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });