const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const suppliers = await Promise.all([
    prisma.supplier.upsert({
      where: { id: 1 },
      update: {},
      create: { name: 'Unilab', contactPerson: 'Juan dela Cruz', phone: '02-8888-1234', address: 'Mandaluyong City, Metro Manila' },
    }),
    prisma.supplier.upsert({
      where: { id: 2 },
      update: {},
      create: { name: 'Pfizer Philippines', contactPerson: 'Maria Santos', phone: '02-8555-9876', address: 'Makati City, Metro Manila' },
    }),
    prisma.supplier.upsert({
      where: { id: 3 },
      update: {},
      create: { name: 'Novartis Healthcare', contactPerson: 'Pedro Reyes', phone: '02-8777-4321', address: 'BGC, Taguig City' },
    }),
    prisma.supplier.upsert({
      where: { id: 4 },
      update: {},
      create: { name: 'Generika Drugstore', contactPerson: 'Ana Lim', phone: '02-8444-5678', address: 'Quezon City, Metro Manila' },
    }),
  ]);

  console.log(`Seeded ${suppliers.length} suppliers.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
