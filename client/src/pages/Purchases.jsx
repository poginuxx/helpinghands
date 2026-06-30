import { useState, useEffect } from 'react';
import { getPurchases, createPurchase, receivePurchase } from '../api/purchases';
import { getSuppliers } from '../api/suppliers';
import { getMedicines, updateMedicine } from '../api/medicines';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';

function formatPHP(amount) {
  return '₱' + Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDateOnly(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' });
}

const EMPTY_LINE = { type: 'existing', medicineId: '', quantity: 1, unitCost: '', medicineName: '', medicineBrandName: '', medicineStrength: '' };

function medName(medicine) {
  if (!medicine) return '—';
  return [medicine.name, medicine.brandName, medicine.strength].filter(Boolean).join(' ');
}

function itemLabel(item) {
  if (item.medicine) return medName(item.medicine);
  return [item.medicineName, item.medicineBrandName, item.medicineStrength].filter(Boolean).join(' ') || '—';
}

function itemsSummary(items) {
  if (!items.length) return '—';
  const labels = items.map(i => `${itemLabel(i)} ×${i.quantity}`);
  if (labels.length <= 2) return labels.join(', ');
  return `${labels[0]}, ${labels[1]} +${labels.length - 2} more`;
}

export default function Purchases() {
  const [tab, setTab] = useState('orders'); // 'orders' | 'received'
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState(null);
  const [receiving, setReceiving] = useState(null);

  const showToast = useToast();

  // Create form state
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState([{ ...EMPTY_LINE }]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Orders Received — edit state: { [medicineId]: { sellingPrice, expiryDate, reorderLevel, saving } }
  const [reviewEdits, setReviewEdits] = useState({});

  useEffect(() => {
    Promise.all([getPurchases(), getSuppliers(), getMedicines()]).then(([o, s, m]) => {
      setOrders(o);
      setSuppliers(s);
      setMedicines(m);
      setLoading(false);
    });
  }, []);

  function openCreate() {
    setSupplierId('');
    setLines([{ ...EMPTY_LINE }]);
    setFormError('');
    setShowCreate(true);
  }

  function closeCreate() {
    setShowCreate(false);
    setFormError('');
  }

  function addLine() {
    setLines(prev => [...prev, { ...EMPTY_LINE }]);
  }

  function removeLine(idx) {
    setLines(prev => prev.filter((_, i) => i !== idx));
  }

  function updateLine(idx, field, value) {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  }

  function toggleLineType(idx) {
    setLines(prev => prev.map((l, i) => i !== idx ? l : {
      ...EMPTY_LINE,
      type: l.type === 'existing' ? 'new' : 'existing',
    }));
  }

  function medicineForLine(line) {
    return medicines.find(m => m.id === parseInt(line.medicineId));
  }

  const orderTotal = lines.reduce((sum, l) => {
    const qty = parseInt(l.quantity) || 0;
    const cost = parseFloat(l.unitCost) || 0;
    return sum + qty * cost;
  }, 0);

  async function handleCreate(e) {
    e.preventDefault();
    if (!supplierId) { setFormError('Select a supplier'); return; }
    for (const l of lines) {
      if (l.type === 'existing' && !l.medicineId) {
        setFormError('Select a medicine or switch to "New Medicine" for each item');
        return;
      }
      if (l.type === 'new' && !l.medicineName.trim()) {
        setFormError('Enter a medicine name for each new medicine item');
        return;
      }
      if (!l.quantity || !l.unitCost) {
        setFormError('All items must have a quantity and unit cost');
        return;
      }
    }
    setSaving(true);
    setFormError('');
    try {
      const items = lines.map(l => l.type === 'existing'
        ? { medicineId: l.medicineId, quantity: l.quantity, unitCost: l.unitCost }
        : { medicineName: l.medicineName.trim(), medicineBrandName: l.medicineBrandName.trim(), medicineStrength: l.medicineStrength.trim(), quantity: l.quantity, unitCost: l.unitCost }
      );
      const order = await createPurchase({ supplierId, items });
      setOrders(prev => [order, ...prev]);
      closeCreate();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to create order');
    } finally {
      setSaving(false);
    }
  }

  async function handleReceive(order) {
    setReceiving(order.id);
    try {
      const updated = await receivePurchase(order.id);
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
      if (selected?.id === updated.id) setSelected(updated);
      const fresh = await getMedicines();
      setMedicines(fresh);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to mark order as received.');
    } finally {
      setReceiving(null);
    }
  }

  // Orders Received editing
  function initReviewEdit(med) {
    setReviewEdits(prev => ({
      ...prev,
      [med.id]: {
        sellingPrice: med.sellingPrice !== 0 ? med.sellingPrice : '',
        expiryDate: med.expiryDate ? new Date(med.expiryDate).toISOString().split('T')[0] : '',
        reorderLevel: med.reorderLevel !== 10 ? med.reorderLevel : '',
        saving: false,
      },
    }));
  }

  function updateReviewEdit(medId, field, value) {
    setReviewEdits(prev => ({ ...prev, [medId]: { ...prev[medId], [field]: value } }));
  }

  async function saveReviewEdit(item, supplierIdForMed) {
    const edit = reviewEdits[item.medicine.id];
    if (!edit) return;
    if (!edit.sellingPrice) { showToast('Selling price is required'); return; }

    setReviewEdits(prev => ({ ...prev, [item.medicine.id]: { ...prev[item.medicine.id], saving: true } }));
    try {
      const currentMed = medicines.find(m => m.id === item.medicine.id);
      const payload = {
        name: item.medicine.name,
        brandName: item.medicine.brandName || '',
        strength: item.medicine.strength || '',
        supplierId: supplierIdForMed,
        unitCost: item.unitCost,
        sellingPrice: parseFloat(edit.sellingPrice),
        stockQty: currentMed ? currentMed.stockQty : item.quantity,
        expiryDate: edit.expiryDate || null,
        reorderLevel: parseInt(edit.reorderLevel) || 10,
        needsReview: false,
      };
      await updateMedicine(item.medicine.id, payload);
      // Update orders state so needsReview reflects false
      setOrders(prev => prev.map(o => ({
        ...o,
        items: o.items.map(i => i.medicine?.id === item.medicine.id
          ? { ...i, medicine: { ...i.medicine, needsReview: false, sellingPrice: payload.sellingPrice, expiryDate: payload.expiryDate, reorderLevel: payload.reorderLevel } }
          : i
        ),
      })));
      const fresh = await getMedicines();
      setMedicines(fresh);
      setReviewEdits(prev => { const n = { ...prev }; delete n[item.medicine.id]; return n; });
      showToast('Medicine details saved.');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save medicine details.');
      setReviewEdits(prev => ({ ...prev, [item.medicine.id]: { ...prev[item.medicine.id], saving: false } }));
    }
  }

  const receivedOrders = orders.filter(o => o.status === 'RECEIVED');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Purchases</h1>
          <p className="text-sm text-gray-500 mt-0.5">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
        </div>
        {tab === 'orders' && (
          <button
            onClick={openCreate}
            className="px-5 py-2.5 bg-teal-600 text-white rounded-xl font-semibold text-sm active:bg-teal-700 transition-colors min-h-[44px]"
          >
            + New Order
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('orders')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors min-h-[40px] ${tab === 'orders' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 active:bg-white/50'}`}
        >
          Purchase Orders
        </button>
        <button
          onClick={() => setTab('received')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors min-h-[40px] ${tab === 'received' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 active:bg-white/50'}`}
        >
          Orders Received
          {receivedOrders.some(o => o.items.some(i => i.medicine?.needsReview)) && (
            <span className="ml-1.5 inline-flex items-center justify-center w-2 h-2 rounded-full bg-amber-400" />
          )}
        </button>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-16">Loading...</p>
      ) : tab === 'orders' ? (
        /* ── Purchase Orders Tab ── */
        orders.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No purchase orders yet</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Order #</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Date</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Supplier</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Medicines Ordered</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Total</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr
                    key={order.id}
                    onClick={() => setSelected(order)}
                    className="border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 active:bg-teal-50 transition-colors"
                  >
                    <td className="px-5 py-4 text-gray-500">#{order.id}</td>
                    <td className="px-5 py-4 text-gray-700">{formatDate(order.date)}</td>
                    <td className="px-5 py-4 font-medium text-gray-900">{order.supplier.name}</td>
                    <td className="px-5 py-4 text-gray-600 max-w-xs truncate">{itemsSummary(order.items)}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        order.status === 'RECEIVED'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-gray-900">{formatPHP(order.totalAmount)}</td>
                    <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                      {order.status === 'PENDING' && (
                        <button
                          onClick={() => handleReceive(order)}
                          disabled={receiving === order.id}
                          className="px-3 py-1.5 text-xs font-semibold bg-teal-600 text-white rounded-lg active:bg-teal-700 transition-colors disabled:opacity-50 min-h-[36px] whitespace-nowrap"
                        >
                          {receiving === order.id ? '...' : 'Mark Received'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* ── Orders Received Tab ── */
        receivedOrders.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No received orders yet</div>
        ) : (
          <div className="space-y-4">
            {receivedOrders.map(order => {
              const needsReviewItems = order.items.filter(i => i.medicine?.needsReview);
              return (
                <div key={order.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-900 text-sm">Order #{order.id}</span>
                      <span className="text-gray-400 text-sm">{formatDate(order.date)}</span>
                      <span className="text-gray-600 text-sm font-medium">{order.supplier.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {needsReviewItems.length > 0 && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                          {needsReviewItems.length} need{needsReviewItems.length === 1 ? 's' : ''} details
                        </span>
                      )}
                      <span className="font-bold text-gray-900 text-sm">{formatPHP(order.totalAmount)}</span>
                    </div>
                  </div>

                  <div className="divide-y divide-gray-50">
                    {order.items.map(item => {
                      const med = item.medicine;
                      const needsReview = med?.needsReview;
                      const edit = reviewEdits[med?.id];

                      return (
                        <div key={item.id} className="px-5 py-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-medium text-gray-900 text-sm">
                                {med ? med.name : item.medicineName}
                                {(med?.brandName || item.medicineBrandName) && (
                                  <span className="text-gray-400 italic ml-1">{med?.brandName || item.medicineBrandName}</span>
                                )}
                                {(med?.strength || item.medicineStrength) && (
                                  <span className="text-gray-500 ml-1">{med?.strength || item.medicineStrength}</span>
                                )}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                Qty: {item.quantity} · Unit cost: {formatPHP(item.unitCost)}
                              </p>
                              {med && !needsReview && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Selling: {formatPHP(med.sellingPrice)}
                                  {med.expiryDate && ` · Exp: ${formatDateOnly(med.expiryDate)}`}
                                  {` · Reorder ≤ ${med.reorderLevel}`}
                                </p>
                              )}
                            </div>
                            {med && needsReview && !edit && (
                              <button
                                onClick={() => initReviewEdit(med)}
                                className="px-3 py-1.5 text-xs font-semibold bg-amber-500 text-white rounded-lg active:bg-amber-600 whitespace-nowrap min-h-[36px]"
                              >
                                Fill Details
                              </button>
                            )}
                            {med && !needsReview && (
                              <span className="text-xs text-green-600 font-semibold whitespace-nowrap">✓ In Inventory</span>
                            )}
                          </div>

                          {edit && (
                            <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-3">
                              <p className="text-xs font-semibold text-amber-800 mb-1">Complete inventory details for this medicine:</p>
                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <label className="text-xs text-gray-600 mb-1 block">Selling Price (₱) <span className="text-red-500">*</span></label>
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={edit.sellingPrice}
                                    onChange={e => updateReviewEdit(med.id, 'sellingPrice', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 min-h-[44px]"
                                    placeholder="0.00"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-600 mb-1 block">Expiry Date</label>
                                  <input
                                    type="date"
                                    value={edit.expiryDate}
                                    onChange={e => updateReviewEdit(med.id, 'expiryDate', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 min-h-[44px]"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-600 mb-1 block">Reorder Level</label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={edit.reorderLevel}
                                    onChange={e => updateReviewEdit(med.id, 'reorderLevel', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 min-h-[44px]"
                                    placeholder="10"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setReviewEdits(prev => { const n = { ...prev }; delete n[med.id]; return n; })}
                                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold active:bg-gray-50 min-h-[44px]"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={edit.saving}
                                  onClick={() => saveReviewEdit(item, order.supplierId)}
                                  className="flex-1 py-2 bg-teal-600 text-white rounded-xl text-sm font-semibold active:bg-teal-700 disabled:opacity-50 min-h-[44px]"
                                >
                                  {edit.saving ? 'Saving...' : 'Save to Inventory'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Order detail modal */}
      {selected && (
        <Modal title={`Purchase Order #${selected.id}`} onClose={() => setSelected(null)}>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="text-gray-500">{formatDate(selected.date)}</span>
              <span className="font-medium text-gray-800">{selected.supplier.name}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                selected.status === 'RECEIVED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {selected.status}
              </span>
            </div>

            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase">Medicine</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-500 text-xs uppercase">Qty</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-500 text-xs uppercase">Unit Cost</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-500 text-xs uppercase">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map(item => (
                    <tr key={item.id} className="border-t border-gray-50">
                      <td className="px-4 py-3 text-gray-800">
                        {item.medicine ? (
                          <>
                            {item.medicine.name}
                            {item.medicine.brandName && <span className="text-gray-400 italic ml-1">{item.medicine.brandName}</span>}
                            {item.medicine.strength && <span className="text-gray-400 ml-1">{item.medicine.strength}</span>}
                          </>
                        ) : (
                          <>
                            {item.medicineName}
                            {item.medicineBrandName && <span className="text-gray-400 italic ml-1">{item.medicineBrandName}</span>}
                            {item.medicineStrength && <span className="text-gray-400 ml-1">{item.medicineStrength}</span>}
                            <span className="ml-1.5 text-xs text-amber-600 font-medium">(new)</span>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatPHP(item.unitCost)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatPHP(item.unitCost * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between font-bold text-gray-900 text-sm bg-gray-50 rounded-xl px-4 py-3">
              <span>Total</span><span>{formatPHP(selected.totalAmount)}</span>
            </div>

            {selected.status === 'PENDING' && (
              <button
                onClick={() => handleReceive(selected)}
                disabled={receiving === selected.id}
                className="w-full py-3 bg-teal-600 text-white rounded-xl font-semibold text-sm active:bg-teal-700 disabled:opacity-50 min-h-[44px]"
              >
                {receiving === selected.id ? 'Processing...' : 'Mark as Received — Update Stock'}
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Create order modal */}
      {showCreate && (
        <Modal title="New Purchase Order" onClose={closeCreate}>
          <form onSubmit={handleCreate} className="space-y-5">
            {formError && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{formError}</p>}

            {/* Supplier select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier <span className="text-red-500">*</span></label>
              <select
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
              >
                <option value="">Select supplier...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Items <span className="text-red-500">*</span></label>
                <button
                  type="button"
                  onClick={addLine}
                  className="text-xs text-teal-600 font-semibold active:text-teal-800 min-h-[36px] px-2"
                >
                  + Add Item
                </button>
              </div>
              <div className="space-y-3">
                {lines.map((line, idx) => {
                  const med = medicineForLine(line);
                  return (
                    <div key={idx} className="bg-gray-50 rounded-xl p-3 space-y-2">
                      {/* Toggle + remove */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-semibold">
                          <button
                            type="button"
                            onClick={() => line.type !== 'existing' && toggleLineType(idx)}
                            className={`px-3 py-1.5 min-h-[36px] transition-colors ${line.type === 'existing' ? 'bg-teal-600 text-white' : 'bg-white text-gray-500 active:bg-gray-50'}`}
                          >
                            In Inventory
                          </button>
                          <button
                            type="button"
                            onClick={() => line.type !== 'new' && toggleLineType(idx)}
                            className={`px-3 py-1.5 min-h-[36px] transition-colors ${line.type === 'new' ? 'bg-teal-600 text-white' : 'bg-white text-gray-500 active:bg-gray-50'}`}
                          >
                            New Medicine
                          </button>
                        </div>
                        {lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            className="w-9 h-9 flex items-center justify-center text-gray-400 active:text-red-500 rounded-lg bg-white border border-gray-200 shrink-0"
                          >
                            ×
                          </button>
                        )}
                      </div>

                      {/* Existing medicine select */}
                      {line.type === 'existing' && (
                        <select
                          value={line.medicineId}
                          onChange={e => {
                            const m = medicines.find(x => x.id === parseInt(e.target.value));
                            updateLine(idx, 'medicineId', e.target.value);
                            if (m) updateLine(idx, 'unitCost', m.unitCost.toString());
                          }}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white min-h-[44px]"
                        >
                          <option value="">Select medicine...</option>
                          {medicines.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name}{m.brandName ? ` ${m.brandName}` : ''}{m.strength ? ` ${m.strength}` : ''}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* New medicine text inputs */}
                      {line.type === 'new' && (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={line.medicineName}
                            onChange={e => updateLine(idx, 'medicineName', e.target.value)}
                            placeholder="Medicine name *"
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 min-h-[44px]"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={line.medicineBrandName}
                              onChange={e => updateLine(idx, 'medicineBrandName', e.target.value)}
                              placeholder="Brand name (optional)"
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 min-h-[44px]"
                            />
                            <input
                              type="text"
                              value={line.medicineStrength}
                              onChange={e => updateLine(idx, 'medicineStrength', e.target.value)}
                              placeholder="Strength (e.g. 500mg)"
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 min-h-[44px]"
                            />
                          </div>
                        </div>
                      )}

                      {/* Qty + unit cost */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Quantity</label>
                          <input
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={e => updateLine(idx, 'quantity', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 min-h-[44px]"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Unit Cost (₱)</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={line.unitCost}
                            onChange={e => updateLine(idx, 'unitCost', e.target.value)}
                            placeholder={med ? med.unitCost : '0.00'}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 min-h-[44px]"
                          />
                        </div>
                      </div>

                      {((line.type === 'existing' && line.medicineId) || (line.type === 'new' && line.medicineName)) && line.quantity && line.unitCost && (
                        <p className="text-xs text-teal-700 font-medium">
                          Subtotal: {formatPHP(parseFloat(line.unitCost) * parseInt(line.quantity))}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Order total */}
            {lines.some(l => l.unitCost && l.quantity) && (
              <div className="flex justify-between font-bold text-gray-900 bg-gray-50 rounded-xl px-4 py-3 text-sm">
                <span>Order Total</span><span>{formatPHP(orderTotal)}</span>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={closeCreate}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm active:bg-gray-50 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3 bg-teal-600 text-white rounded-xl font-semibold text-sm active:bg-teal-700 disabled:opacity-50 min-h-[44px]"
              >
                {saving ? 'Creating...' : 'Create Order'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
