const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== LINES ===');
  const lines = await prisma.line.findMany();
  console.log(JSON.stringify(lines, null, 2));

  console.log('=== PROD LOGS (TRANSFER / 800) ===');
  const prod = await prisma.prodProductionLog.findMany({
    where: {
      OR: [
        { mesin: { contains: '800', mode: 'insensitive' } },
        { mesin: { contains: 'transfer', mode: 'insensitive' } }
      ]
    },
    take: 10,
    orderBy: { waktu_awal: 'desc' }
  });
  console.log(JSON.stringify(prod, null, 2));

  console.log('=== ALL PROD LOGS (GROUP BY MESIN & LINE_ID) ===');
  const grouped = await prisma.prodProductionLog.groupBy({
    by: ['mesin', 'line_id'],
    _count: { id: true },
    _sum: { qty: true }
  });
  console.log(JSON.stringify(grouped, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

