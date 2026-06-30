const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getAll(req, res) {
  const orders = await prisma.purchaseOrder.findMany({
    include: {
      supplier: { select: { id: true, name: true } },
      items: { include: { medicine: { select: { id: true, name: true, brandName: true, strength: true, needsReview: true, sellingPrice: true, expiryDate: true, reorderLevel: true } } } },
    },
    orderBy: { date: 'desc' },
  });
  res.json(orders);
}

async function getById(req, res) {
  const order = await prisma.purchaseOrder.findUnique({
    where: { id: parseInt(req.params.id) },
    include: {
      supplier: { select: { id: true, name: true } },
      items: { include: { medicine: { select: { id: true, name: true, brandName: true, strength: true } } } },
    },
  });
  if (!order) return res.status(404).json({ message: 'Purchase order not found' });
  res.json(order);
}

async function create(req, res) {
  const { supplierId, items } = req.body;
  if (!supplierId) return res.status(400).json({ message: 'Supplier is required' });
  if (!items || items.length === 0) return res.status(400).json({ message: 'At least one item is required' });

  for (const i of items) {
    if (!i.medicineId && !i.medicineName) {
      return res.status(400).json({ message: 'Each item must have a medicine selection or a medicine name' });
    }
  }

  const totalAmount = items.reduce((sum, i) => sum + parseFloat(i.unitCost) * parseInt(i.quantity), 0);

  const order = await prisma.purchaseOrder.create({
    data: {
      supplierId: parseInt(supplierId),
      totalAmount,
      items: {
        create: items.map(i => ({
          medicineId: i.medicineId ? parseInt(i.medicineId) : null,
          medicineName: i.medicineName || null,
          medicineBrandName: i.medicineBrandName || null,
          medicineStrength: i.medicineStrength || null,
          quantity: parseInt(i.quantity),
          unitCost: parseFloat(i.unitCost),
        })),
      },
    },
    include: {
      supplier: { select: { id: true, name: true } },
      items: { include: { medicine: { select: { id: true, name: true, brandName: true, strength: true } } } },
    },
  });
  res.status(201).json(order);
}

async function receive(req, res) {
  const id = parseInt(req.params.id);
  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) return res.status(404).json({ message: 'Purchase order not found' });
  if (order.status === 'RECEIVED') return res.status(400).json({ message: 'Order already received' });

  const updated = await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      if (item.medicineId) {
        await tx.medicine.update({
          where: { id: item.medicineId },
          data: { stockQty: { increment: item.quantity } },
        });
      } else {
        // New medicine not yet in inventory — create it and link back to the PurchaseItem
        const newMed = await tx.medicine.create({
          data: {
            name: item.medicineName,
            brandName: item.medicineBrandName || null,
            strength: item.medicineStrength || null,
            supplierId: order.supplierId,
            unitCost: item.unitCost,
            sellingPrice: 0,
            stockQty: item.quantity,
            reorderLevel: 10,
            needsReview: true,
          },
        });
        await tx.purchaseItem.update({
          where: { id: item.id },
          data: { medicineId: newMed.id },
        });
      }
    }
    return tx.purchaseOrder.update({
      where: { id },
      data: { status: 'RECEIVED' },
      include: {
        supplier: { select: { id: true, name: true } },
        items: { include: { medicine: { select: { id: true, name: true, brandName: true, strength: true, needsReview: true, sellingPrice: true, expiryDate: true, reorderLevel: true } } } },
      },
    });
  });
  res.json(updated);
}

module.exports = { getAll, getById, create, receive };
