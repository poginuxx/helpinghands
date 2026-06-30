const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getAll(req, res) {
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });
  res.json(suppliers);
}

async function create(req, res) {
  const { name, contactPerson, phone, address } = req.body;
  if (!name) return res.status(400).json({ message: 'Name is required' });
  const supplier = await prisma.supplier.create({
    data: { name, contactPerson: contactPerson || null, phone: phone || null, address: address || null },
  });
  res.status(201).json(supplier);
}

async function update(req, res) {
  const { name, contactPerson, phone, address } = req.body;
  if (!name) return res.status(400).json({ message: 'Name is required' });
  const supplier = await prisma.supplier.update({
    where: { id: parseInt(req.params.id) },
    data: { name, contactPerson: contactPerson || null, phone: phone || null, address: address || null },
  });
  res.json(supplier);
}

async function remove(req, res) {
  const id = parseInt(req.params.id);
  const hasMedicines = await prisma.medicine.findFirst({ where: { supplierId: id } });
  if (hasMedicines) return res.status(409).json({ message: 'Cannot delete: supplier has medicines linked to them.' });
  await prisma.supplier.delete({ where: { id } });
  res.status(204).send();
}

module.exports = { getAll, create, update, remove };
