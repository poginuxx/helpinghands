const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getAll(req, res) {
  const medicines = await prisma.medicine.findMany({
    include: { supplier: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(medicines);
}

async function create(req, res) {
  const { name, brandName, strength, supplierId, unitCost, sellingPrice, stockQty, expiryDate, reorderLevel } = req.body;
  const medicine = await prisma.medicine.create({
    data: {
      name,
      brandName: brandName || null,
      strength: strength || null,
      category: null,
      supplierId: parseInt(supplierId),
      unitCost: parseFloat(unitCost),
      sellingPrice: parseFloat(sellingPrice),
      stockQty: parseInt(stockQty),
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      reorderLevel: parseInt(reorderLevel) || 10,
    },
    include: { supplier: { select: { id: true, name: true } } },
  });
  res.status(201).json(medicine);
}

async function update(req, res) {
  const { id } = req.params;
  const { name, brandName, strength, supplierId, unitCost, sellingPrice, stockQty, expiryDate, reorderLevel, needsReview } = req.body;
  const medicine = await prisma.medicine.update({
    where: { id: parseInt(id) },
    data: {
      name,
      brandName: brandName || null,
      strength: strength || null,
      supplierId: parseInt(supplierId),
      unitCost: parseFloat(unitCost),
      sellingPrice: parseFloat(sellingPrice),
      stockQty: parseInt(stockQty),
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      reorderLevel: parseInt(reorderLevel) || 10,
      ...(needsReview !== undefined ? { needsReview: Boolean(needsReview) } : {}),
    },
    include: { supplier: { select: { id: true, name: true } } },
  });
  res.json(medicine);
}

async function remove(req, res) {
  const { id } = req.params;
  const hasTransactions = await prisma.transactionItem.findFirst({ where: { medicineId: parseInt(id) } });
  if (hasTransactions) {
    return res.status(409).json({ message: 'Cannot delete: medicine has existing sales records.' });
  }
  await prisma.medicine.delete({ where: { id: parseInt(id) } });
  res.status(204).send();
}

module.exports = { getAll, create, update, remove };
