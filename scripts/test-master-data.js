const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Testing DB connection...');
  const lines = await prisma.line.findMany();
  console.log('lines count:', lines.length);
  const settings = await prisma.prodMesinSettings.findMany();
  console.log('settings count:', settings.length);
  const problems = await prisma.prodDowntimeProblem.findMany();
  console.log('problems count:', problems.length);
  const types = await prisma.prodNonproduksiType.findMany();
  console.log('types count:', types.length);
  const parts = await prisma.prodPartNumber.findMany();
  console.log('parts count:', parts.length);
  console.log('All DB queries successful!');
}

main()
  .catch((e) => console.error('DB ERROR:', e))
  .finally(() => prisma.$disconnect());
