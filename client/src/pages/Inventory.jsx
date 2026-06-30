import { useState, useEffect, useMemo } from 'react';
import Modal from '../components/Modal';
import { getMedicines, createMedicine, updateMedicine, deleteMedicine } from '../api/medicines';
import { getSuppliers } from '../api/suppliers';

const EMPTY_FORM = {
  name: '', brandName: '', strength: '', supplierId: '',
  unitCost: '', sellingPrice: '', stockQty: '', expiryDate: '', reorderLevel: '10',
};

function stockStatus(med) {
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (med.expiryDate && new Date(med.expiryDate) < now) return 'expired';
  if (med.expiryDate && new Date(med.expiryDate) <= thirtyDays) return 'expiring';
  if (med.stockQty <= med.reorderLevel) return 'low';
  return 'ok';
}

function StatusBadge({ status }) {
  if (status === 'expired')  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Expired</span>;
  if (status === 'expiring') return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Expiring Soon</span>;
  if (status === 'low')      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">Low Stock</span>;
  return null;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
}

function formatCurrency(val) {
  return '₱' + Number(val).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}

export default function Inventory() {
  const [medicines, setMedicines]   = useState([]);
  const [suppliers, setSuppliers]   = useState([]);
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(true);
  const [modalOpen, setModalOpen]   = useState(false);
  const [editing, setEditing]       = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError]   = useState('');

  useEffect(() => {
    Promise.all([getMedicines(), getSuppliers()])
      .then(([meds, sups]) => { setMedicines(meds); setSuppliers(sups); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return medicines;
    return medicines.filter(m =>
      m.name.toLowerCase().includes(q) ||
      (m.brandName || '').toLowerCase().includes(q) ||
      (m.strength  || '').toLowerCase().includes(q)
    );
  }, [medicines, search]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(med) {
    setEditing(med);
    setForm({
      name:         med.name,
      brandName:    med.brandName  || '',
      strength:     med.strength   || '',
      supplierId:   String(med.supplierId),
      unitCost:     String(med.unitCost),
      sellingPrice: String(med.sellingPrice),
      stockQty:     String(med.stockQty),
      expiryDate:   med.expiryDate ? med.expiryDate.slice(0, 10) : '',
      reorderLevel: String(med.reorderLevel),
    });
    setFormError('');
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); setEditing(null); }

  async function handleSave(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateMedicine(editing.id, form);
        setMedicines(prev => prev.map(m => m.id === updated.id ? updated : m));
      } else {
        const created = await createMedicine(form);
        setMedicines(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      }
      closeModal();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleteError('');
    try {
      await deleteMedicine(deleteTarget.id);
      setMedicines(prev => prev.filter(m => m.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Could not delete.');
    }
  }

  const field = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500 text-sm mt-0.5">{medicines.length} medicines</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-teal-600 active:bg-teal-700 text-white font-medium px-4 py-2.5 rounded-xl transition-colors min-h-[44px]"
        >
          <span className="text-lg leading-none">+</span> Add Medicine
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by generic name, brand, or strength..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[44px]"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">No medicines found.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-left">
                  <th className="px-4 py-3 font-medium">Generic Name</th>
                  <th className="px-4 py-3 font-medium">Brand</th>
                  <th className="px-4 py-3 font-medium">Strength</th>
                  <th className="px-4 py-3 font-medium">Supplier</th>
                  <th className="px-4 py-3 font-medium text-right">Unit Cost</th>
                  <th className="px-4 py-3 font-medium text-right">Selling Price</th>
                  <th className="px-4 py-3 font-medium text-right">Stock</th>
                  <th className="px-4 py-3 font-medium">Expiry</th>
                  <th className="px-4 py-3 font-medium text-right">Reorder</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(med => {
                  const status = stockStatus(med);
                  const rowBg =
                    status === 'expired'  ? 'bg-gray-50/50'    :
                    status === 'expiring' ? 'bg-yellow-50/40'  :
                    status === 'low'      ? 'bg-red-50/40'     : '';
                  return (
                    <tr key={med.id} className={`${rowBg} hover:bg-gray-50 transition-colors`}>
                      <td className="px-4 py-3 font-medium text-gray-900">{med.name}</td>
                      <td className="px-4 py-3 text-gray-500 italic">{med.brandName || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{med.strength || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{med.supplier?.name}</td>
                      <td className="px-4 py-3 text-gray-600 text-right">{formatCurrency(med.unitCost)}</td>
                      <td className="px-4 py-3 text-gray-900 font-medium text-right">{formatCurrency(med.sellingPrice)}</td>
                      <td className={`px-4 py-3 font-semibold text-right ${status === 'low' ? 'text-red-600' : 'text-gray-900'}`}>
                        {med.stockQty}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(med.expiryDate)}</td>
                      <td className="px-4 py-3 text-gray-500 text-right">{med.reorderLevel}</td>
                      <td className="px-4 py-3"><StatusBadge status={status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => openEdit(med)}
                            className="px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 active:bg-teal-100 rounded-lg transition-colors min-h-[32px]"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => { setDeleteTarget(med); setDeleteError(''); }}
                            className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 active:bg-red-100 rounded-lg transition-colors min-h-[32px]"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <Modal title={editing ? 'Edit Medicine' : 'Add Medicine'} onClose={closeModal}>
          <form onSubmit={handleSave} className="space-y-4">
            {/* Row 1: Generic name (full width) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Generic Name <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className={field}
                placeholder="e.g. Losartan"
                autoFocus
              />
            </div>

            {/* Row 2: Brand name + Strength */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand Name</label>
                <input
                  value={form.brandName}
                  onChange={e => setForm(f => ({ ...f, brandName: e.target.value }))}
                  className={field}
                  placeholder="e.g. Lifezar"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Strength / Dose</label>
                <input
                  value={form.strength}
                  onChange={e => setForm(f => ({ ...f, strength: e.target.value }))}
                  className={field}
                  placeholder="e.g. 50mg"
                />
              </div>
            </div>

            {/* Row 3: Supplier (full width) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.supplierId}
                onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}
                className={field + ' bg-white'}
              >
                <option value="">Select supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Row 4: Unit Cost + Selling Price */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit Cost (₱) <span className="text-red-500">*</span>
                </label>
                <input
                  required type="number" min="0" step="0.01"
                  value={form.unitCost}
                  onChange={e => setForm(f => ({ ...f, unitCost: e.target.value }))}
                  className={field}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Selling Price (₱) <span className="text-red-500">*</span>
                </label>
                <input
                  required type="number" min="0" step="0.01"
                  value={form.sellingPrice}
                  onChange={e => setForm(f => ({ ...f, sellingPrice: e.target.value }))}
                  className={field}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Row 5: Stock Qty + Reorder Level */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stock Qty <span className="text-red-500">*</span>
                </label>
                <input
                  required type="number" min="0" step="1"
                  value={form.stockQty}
                  onChange={e => setForm(f => ({ ...f, stockQty: e.target.value }))}
                  className={field}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
                <input
                  type="number" min="0" step="1"
                  value={form.reorderLevel}
                  onChange={e => setForm(f => ({ ...f, reorderLevel: e.target.value }))}
                  className={field}
                />
              </div>
            </div>

            {/* Row 6: Expiry Date (full width) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
              <input
                type="date"
                value={form.expiryDate}
                onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))}
                className={field}
              />
            </div>

            {formError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{formError}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button" onClick={closeModal}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 active:bg-gray-50 transition-colors min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="submit" disabled={saving}
                className="flex-1 py-2.5 bg-teal-600 active:bg-teal-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-60 min-h-[44px]"
              >
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Medicine'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <Modal title="Delete Medicine" onClose={() => setDeleteTarget(null)}>
          <p className="text-gray-600 text-sm mb-1">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-gray-900">
              {deleteTarget.name}
              {deleteTarget.brandName ? ` ${deleteTarget.brandName}` : ''}
              {deleteTarget.strength  ? ` ${deleteTarget.strength}`  : ''}
            </span>?
          </p>
          <p className="text-gray-400 text-xs mb-4">This action cannot be undone.</p>
          {deleteError && <p className="text-red-500 text-sm mb-3">{deleteError}</p>}
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteTarget(null)}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 active:bg-gray-50 min-h-[44px]"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 py-2.5 bg-red-600 active:bg-red-700 text-white rounded-xl text-sm font-medium min-h-[44px]"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
