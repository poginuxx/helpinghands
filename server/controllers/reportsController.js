const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MANILA_MS = 8 * 60 * 60 * 1000; // UTC+8

// ── Date helpers (all return UTC Date objects) ──────────────────────────────

function startOfTodayManila() {
  const now = new Date();
  const manila = new Date(now.getTime() + MANILA_MS);
  manila.setUTCHours(0, 0, 0, 0);
  return new Date(manila.getTime() - MANILA_MS);
}

function startOfWeekManila() {
  const todayUTC = startOfTodayManila();
  const dayOfWeek = new Date(todayUTC.getTime() + MANILA_MS).getUTCDay(); // 0=Sun
  return new Date(todayUTC.getTime() - dayOfWeek * 86400000);
}

function startOfMonthManila() {
  const now = new Date();
  const manila = new Date(now.getTime() + MANILA_MS);
  manila.setUTCDate(1);
  manila.setUTCHours(0, 0, 0, 0);
  return new Date(manila.getTime() - MANILA_MS);
}

function startOfNMonthsAgo(n) {
  const now = new Date();
  const manila = new Date(now.getTime() + MANILA_MS);
  manila.setUTCDate(1);
  manila.setUTCHours(0, 0, 0, 0);
  manila.setUTCMonth(manila.getUTCMonth() - n + 1);
  return new Date(manila.getTime() - MANILA_MS);
}

// ── COGS helper ─────────────────────────────────────────────────────────────

function calcCogs(transactions) {
  return transactions.reduce((sum, tx) =>
    sum + tx.items.reduce((s, i) => s + i.medicine.unitCost * i.quantity, 0), 0);
}

// ── Endpoints ────────────────────────────────────────────────────────────────

async function getSummary(req, res) {
  const monthStart = startOfMonthManila();
  const weekStart  = startOfWeekManila();
  const todayStart = startOfTodayManila();
  const in30Days   = new Date(Date.now() + 30 * 86400000);

  const [monthTx, lowStock, expiringSoon] = await Promise.all([
    prisma.transaction.findMany({
      where: { date: { gte: monthStart } },
      include: { items: { include: { medicine: { select: { unitCost: true } } } } },
    }),
    // raw query: stockQty <= reorderLevel (can't compare two columns in Prisma ORM)
    prisma.$queryRaw`
      SELECT id, name, "brandName", strength, "stockQty", "reorderLevel"
      FROM "Medicine"
      WHERE "stockQty" <= "reorderLevel"
      ORDER BY "stockQty" ASC
    `,
    prisma.medicine.findMany({
      where: { expiryDate: { not: null, lte: in30Days } },
      select: { id: true, name: true, strength: true, expiryDate: true, stockQty: true },
      orderBy: { expiryDate: 'asc' },
    }),
  ]);

  const weekTx  = monthTx.filter(tx => tx.date >= weekStart);
  const todayTx = monthTx.filter(tx => tx.date >= todayStart);

  function period(txs) {
    const revenue = txs.reduce((s, tx) => s + tx.totalAmount, 0);
    const cogs    = calcCogs(txs);
    return { revenue, cogs, profit: revenue - cogs, count: txs.length };
  }

  res.json({
    today:        period(todayTx),
    week:         period(weekTx),
    month:        period(monthTx),
    lowStock:     lowStock.map(r => ({          // BigInt → Number from raw query
      id: Number(r.id),
      name: r.name,
      brandName: r.brandName,
      strength: r.strength,
      stockQty: Number(r.stockQty),
      reorderLevel: Number(r.reorderLevel),
    })),
    expiringSoon,
  });
}

async function getChart(req, res) {
  const period = req.query.period || 'daily'; // daily | weekly | monthly

  let startDate;
  let buckets = [];

  if (period === 'daily') {
    startDate = new Date(startOfTodayManila().getTime() - 29 * 86400000);
    for (let i = 29; i >= 0; i--) {
      const s = new Date(startOfTodayManila().getTime() - i * 86400000);
      const e = new Date(s.getTime() + 86400000);
      const manilaS = new Date(s.getTime() + MANILA_MS);
      buckets.push({ label: manilaS.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }), start: s, end: e });
    }
  } else if (period === 'weekly') {
    const thisWeekStart = startOfWeekManila();
    startDate = new Date(thisWeekStart.getTime() - 11 * 7 * 86400000);
    for (let i = 11; i >= 0; i--) {
      const s = new Date(thisWeekStart.getTime() - i * 7 * 86400000);
      const e = new Date(s.getTime() + 7 * 86400000);
      const manilaS = new Date(s.getTime() + MANILA_MS);
      const label = 'Wk ' + manilaS.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
      buckets.push({ label, start: s, end: e });
    }
  } else {
    // monthly — last 12 months
    startDate = startOfNMonthsAgo(12);
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const mBase = new Date(now.getTime() + MANILA_MS);
      mBase.setUTCDate(1);
      mBase.setUTCHours(0, 0, 0, 0);
      mBase.setUTCMonth(mBase.getUTCMonth() - i);
      const s = new Date(mBase.getTime() - MANILA_MS);
      const mNext = new Date(mBase);
      mNext.setUTCMonth(mNext.getUTCMonth() + 1);
      const e = new Date(mNext.getTime() - MANILA_MS);
      const label = mBase.toLocaleDateString('en-PH', { month: 'short', year: '2-digit' });
      buckets.push({ label, start: s, end: e });
    }
  }

  const transactions = await prisma.transaction.findMany({
    where: { date: { gte: startDate } },
    include: { items: { include: { medicine: { select: { unitCost: true } } } } },
    orderBy: { date: 'asc' },
  });

  const data = buckets.map(({ label, start, end }) => {
    const txs = transactions.filter(tx => tx.date >= start && tx.date < end);
    const revenue = txs.reduce((s, tx) => s + tx.totalAmount, 0);
    const cogs    = calcCogs(txs);
    return { label, revenue: +revenue.toFixed(2), cogs: +cogs.toFixed(2), profit: +(revenue - cogs).toFixed(2) };
  });

  res.json(data);
}

async function getTopMedicines(req, res) {
  const items = await prisma.transactionItem.groupBy({
    by: ['medicineId'],
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 10,
  });

  if (items.length === 0) return res.json([]);

  const ids = items.map(i => i.medicineId);
  const medicines = await prisma.medicine.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, brandName: true, strength: true, sellingPrice: true },
  });

  const result = items.map(item => {
    const med = medicines.find(m => m.id === item.medicineId);
    const qty = item._sum.quantity;
    return {
      medicineId: item.medicineId,
      name: med?.name || 'Unknown',
      brandName: med?.brandName || null,
      strength: med?.strength || null,
      totalQty: qty,
      totalRevenue: +(qty * (med?.sellingPrice || 0)).toFixed(2),
    };
  });

  res.json(result);
}

async function exportCSV(req, res) {
  const transactions = await prisma.transaction.findMany({
    include: {
      items: { include: { medicine: { select: { name: true, strength: true } } } },
    },
    orderBy: { date: 'desc' },
  });

  const headers = ['ID', 'Date (Manila)', 'Items', 'Subtotal', 'Discount Type', 'Discount Amount', 'Total', 'Payment'];
  const rows = [headers.join(',')];

  for (const tx of transactions) {
    const manilaDate = new Date(tx.date.getTime() + MANILA_MS)
      .toISOString().replace('T', ' ').substring(0, 16);
    const itemsStr = tx.items
      .map(i => `${i.medicine.name}${i.medicine.strength ? ' ' + i.medicine.strength : ''} x${i.quantity}`)
      .join('; ');
    rows.push([
      tx.id,
      manilaDate,
      `"${itemsStr}"`,
      tx.subtotal.toFixed(2),
      tx.discountType || '',
      tx.discountAmount.toFixed(2),
      tx.totalAmount.toFixed(2),
      tx.paymentMethod,
    ].join(','));
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="pharmapoint-sales.csv"');
  res.send(rows.join('\n'));
}

module.exports = { getSummary, getChart, getTopMedicines, exportCSV };
