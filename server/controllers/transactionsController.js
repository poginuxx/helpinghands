const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MED_SELECT = { id: true, name: true, brandName: true, strength: true };

async function getAll(req, res) {
  const { from, to } = req.query;
  const where = {};
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      where.date.lte = toDate;
    }
  }
  const transactions = await prisma.transaction.findMany({
    where,
    include: { items: { include: { medicine: { select: MED_SELECT } } } },
    orderBy: { date: 'desc' },
  });
  res.json(transactions);
}

async function getById(req, res) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: parseInt(req.params.id) },
    include: { items: { include: { medicine: { select: MED_SELECT } } } },
  });
  if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
  res.json(transaction);
}

async function create(req, res) {
  const { items, discountType, paymentMethod } = req.body;

  if (!items || items.length === 0)
    return res.status(400).json({ message: 'Cart is empty' });
  if (!paymentMethod)
    return res.status(400).json({ message: 'Payment method is required' });

  const medicineIds = items.map(i => i.medicineId);
  const medicines = await prisma.medicine.findMany({ where: { id: { in: medicineIds } } });

  for (const item of items) {
    const med = medicines.find(m => m.id === item.medicineId);
    if (!med) return res.status(404).json({ message: `Medicine ID ${item.medicineId} not found` });
    if (med.stockQty < item.quantity)
      return res.status(400).json({ message: `Insufficient stock for ${med.name}` });
  }

  const subtotal = items.reduce((sum, item) => {
    const med = medicines.find(m => m.id === item.medicineId);
    return sum + med.sellingPrice * item.quantity;
  }, 0);

  const discountAmount = discountType ? subtotal * 0.20 : 0;
  const totalAmount = subtotal - discountAmount;

  const transaction = await prisma.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        subtotal,
        discountType: discountType || null,
        discountAmount,
        totalAmount,
        paymentMethod,
        items: {
          create: items.map(item => {
            const med = medicines.find(m => m.id === item.medicineId);
            return { medicineId: item.medicineId, quantity: item.quantity, unitPrice: med.sellingPrice };
          }),
        },
      },
      include: { items: { include: { medicine: { select: MED_SELECT } } } },
    });
    for (const item of items) {
      await tx.medicine.update({
        where: { id: item.medicineId },
        data: { stockQty: { decrement: item.quantity } },
      });
    }
    return created;
  });

  res.status(201).json(transaction);
}

async function bulkDelete(req, res) {
  const { ids } = req.body;
  if (!ids || ids.length === 0)
    return res.status(400).json({ message: 'No transactions selected' });

  const intIds = ids.map(id => parseInt(id));

  await prisma.$transaction(async (tx) => {
    // Must delete child rows first — no cascade on schema
    await tx.transactionItem.deleteMany({ where: { transactionId: { in: intIds } } });
    await tx.transaction.deleteMany({ where: { id: { in: intIds } } });
  });

  res.status(204).send();
}

module.exports = { getAll, getById, create, bulkDelete };
