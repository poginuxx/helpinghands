import { useState, useEffect } from 'react';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../api/suppliers';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';

const EMPTY_FORM = { name: '', contactPerson: '', phone: '', address: '' };

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'add' | 'edit'
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const showToast = useToast();

  useEffect(() => {
    fetchSuppliers();
  }, []);

  async function fetchSuppliers() {
    setLoading(true);
    try {
      const data = await getSuppliers();
      setSuppliers(data);
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setForm(EMPTY_FORM);
    setError('');
    setModal('add');
  }

  function openEdit(supplier) {
    setEditing(supplier);
    setForm({
      name: supplier.name,
      contactPerson: supplier.contactPerson || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
    });
    setError('');
    setModal('edit');
  }

  function closeModal() {
    setModal(null);
    setEditing(null);
    setError('');
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (modal === 'add') {
        const s = await createSupplier(form);
        setSuppliers(prev => [...prev, s].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        const s = await updateSupplier(editing.id, form);
        setSuppliers(prev => prev.map(x => x.id === s.id ? s : x));
      }
      closeModal();
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(supplier) {
    try {
      await deleteSupplier(supplier.id);
      setSuppliers(prev => prev.filter(s => s.id !== supplier.id));
      setDeleteConfirm(null);
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not delete supplier.');
      setDeleteConfirm(null);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-sm text-gray-500 mt-0.5">{suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={openAdd}
          className="px-5 py-2.5 bg-teal-600 text-white rounded-xl font-semibold text-sm active:bg-teal-700 transition-colors min-h-[44px]"
        >
          + Add Supplier
        </button>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-16">Loading...</p>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No suppliers yet</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Name</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Contact Person</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Phone</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Address</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {suppliers.map(s => (
                <tr key={s.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-4 font-medium text-gray-900">{s.name}</td>
                  <td className="px-5 py-4 text-gray-600">{s.contactPerson || <span className="text-gray-300">—</span>}</td>
                  <td className="px-5 py-4 text-gray-600">{s.phone || <span className="text-gray-300">—</span>}</td>
                  <td className="px-5 py-4 text-gray-600 max-w-xs truncate">{s.address || <span className="text-gray-300">—</span>}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => openEdit(s)}
                        className="px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 rounded-lg active:bg-teal-100 transition-colors min-h-[36px]"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(s)}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg active:bg-red-100 transition-colors min-h-[36px]"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit modal */}
      {modal && (
        <Modal title={modal === 'add' ? 'Add Supplier' : 'Edit Supplier'} onClose={closeModal}>
          <form onSubmit={handleSave} className="space-y-4">
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                placeholder="e.g. MedCore Distributors"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
              <input
                type="text"
                value={form.contactPerson}
                onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                placeholder="e.g. Juan dela Cruz"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                placeholder="e.g. 0917-123-4567"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                rows={2}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                placeholder="e.g. 123 Rizal Ave, Manila"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm active:bg-gray-50 transition-colors min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3 bg-teal-600 text-white rounded-xl font-semibold text-sm active:bg-teal-700 transition-colors disabled:opacity-50 min-h-[44px]"
              >
                {saving ? 'Saving...' : modal === 'add' ? 'Add Supplier' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <Modal title="Delete Supplier" onClose={() => setDeleteConfirm(null)}>
          <p className="text-gray-600 mb-6">
            Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?
            This cannot be undone. Suppliers with linked medicines cannot be deleted.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteConfirm(null)}
              className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm active:bg-gray-50 min-h-[44px]"
            >
              Cancel
            </button>
            <button
              onClick={() => handleDelete(deleteConfirm)}
              className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold text-sm active:bg-red-700 min-h-[44px]"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
