import { useState, useEffect } from 'react';
import { getTransactions, bulkDeleteTransactions } from '../api/transactions';
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

function medName(medicine) {
  return [medicine.name, medicine.brandName, medicine.strength].filter(Boolean).join(' ');
}

function itemsSummary(items) {
  if (!items.length) return '—';
  const labels = items.map(i => `${medName(i.medicine)} ×${i.quantity}`);
  if (labels.length <= 2) return labels.join(', ');
  return `${labels[0]}, ${labels[1]} +${labels.length - 2} more`;
}

const BADGE = {
  CASH:   'bg-green-100 text-green-700',
  CARD:   'bg-blue-100 text-blue-700',
  GCASH:  'bg-purple-100 text-purple-700',
  MAYA:   'bg-cyan-100 text-cyan-700',
};
const DISC_BADGE = {
  PWD:    'bg-orange-100 text-orange-700',
  SENIOR: 'bg-amber-100 text-amber-700',
};

export default function SalesHistory() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [from, setFrom]                 = useState('');
  const [to, setTo]                     = useState('');
  const [viewTx, setViewTx]             = useState(null);   // detail modal
  const [checkedIds, setCheckedIds]     = useState(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const showToast = useToast();

  useEffect(() => { fetchTransactions(); }, []);

  async function fetchTransactions(overrideFrom, overrideTo) {
    setLoading(true);
    setCheckedIds(new Set());
    try {
      const params = {};
      const f = overrideFrom !== undefined ? overrideFrom : from;
      const t = overrideTo   !== undefined ? overrideTo   : to;
      if (f) params.from = f;
      if (t) params.to   = t;
      const data = await getTransactions(params);
      setTransactions(data);
    } finally {
      setLoading(false);
    }
  }

  function handleFilter(e) {
    e.preventDefault();
    fetchTransactions();
  }

  function handleClear() {
    setFrom('');
    setTo('');
    fetchTransactions('', '');
  }

  // ── Checkbox logic ─────────────────────────────────────────────────────────
  const allChecked = transactions.length > 0 && checkedIds.size === transactions.length;
  const someChecked = checkedIds.size > 0 && !allChecked;

  function toggleAll() {
    if (allChecked || someChecked) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(transactions.map(t => t.id)));
    }
  }

  function toggleOne(id) {
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Bulk delete ────────────────────────────────────────────────────────────
  async function handleBulkDelete() {
    setDeleting(true);
    try {
      await bulkDeleteTransactions([...checkedIds]);
      setTransactions(prev => prev.filter(t => !checkedIds.has(t.id)));
      setCheckedIds(new Set());
      setShowDeleteConfirm(false);
      showToast(`${checkedIds.size} transaction${checkedIds.size !== 1 ? 's' : ''} deleted.`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Delete failed. Please try again.');
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sales History</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
          </p>
        </div>

        {checkedIds.size > 0 && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold active:bg-red-700 transition-colors min-h-[44px]"
          >
            Delete {checkedIds.size} selected
          </button>
        )}
      </div>

      {/* Date filter */}
      <form onSubmit={handleFilter} className="flex flex-wrap gap-3 mb-6 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <input
            type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 min-h-[44px]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input
            type="date" value={to} onChange={e => setTo(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 min-h-[44px]"
          />
        </div>
        <button
          type="submit"
          className="px-5 py-2 bg-teal-600 text-white rounded-xl text-sm font-semibold active:bg-teal-700 transition-colors min-h-[44px]"
        >
          Filter
        </button>
        {(from || to) && (
          <button
            type="button" onClick={handleClear}
            className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold active:bg-gray-50 transition-colors min-h-[44px]"
          >
            Clear
          </button>
        )}
      </form>

      {/* Table */}
      {loading ? (
        <p className="text-center text-gray-400 py-16">Loading...</p>
      ) : transactions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No transactions found</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {/* Select-all checkbox */}
                <th className="px-4 py-3.5 w-10">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={el => { if (el) el.indeterminate = someChecked; }}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded accent-teal-600 cursor-pointer"
                  />
                </th>
                <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Medicines Sold</th>
                <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Discount</th>
                <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Payment</th>
                <th className="text-right px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Total</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <tr
                  key={tx.id}
                  onClick={() => setViewTx(tx)}
                  className={`border-b border-gray-50 cursor-pointer transition-colors ${
                    checkedIds.has(tx.id) ? 'bg-teal-50' : 'hover:bg-gray-50 active:bg-teal-50'
                  }`}
                >
                  {/* Per-row checkbox — stop propagation so it doesn't open detail modal */}
                  <td
                    className="px-4 py-4"
                    onClick={e => { e.stopPropagation(); toggleOne(tx.id); }}
                  >
                    <input
                      type="checkbox"
                      checked={checkedIds.has(tx.id)}
                      onChange={() => toggleOne(tx.id)}
                      className="w-4 h-4 rounded accent-teal-600 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-4 text-gray-700 whitespace-nowrap">{formatDate(tx.date)}</td>
                  <td className="px-4 py-4 text-gray-700 max-w-xs truncate">{itemsSummary(tx.items)}</td>
                  <td className="px-4 py-4">
                    {tx.discountType
                      ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${DISC_BADGE[tx.discountType] || ''}`}>{tx.discountType}</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${BADGE[tx.paymentMethod] || 'bg-gray-100 text-gray-600'}`}>
                      {tx.paymentMethod}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-gray-900">{formatPHP(tx.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Transaction detail modal */}
      {viewTx && (
        <Modal title={`Sale — ${formatDate(viewTx.date)}`} onClose={() => setViewTx(null)}>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${BADGE[viewTx.paymentMethod] || ''}`}>
                {viewTx.paymentMethod}
              </span>
              {viewTx.discountType && (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${DISC_BADGE[viewTx.discountType] || ''}`}>
                  {viewTx.discountType} Discount
                </span>
              )}
            </div>

            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase">Medicine</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-500 text-xs uppercase">Qty</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-500 text-xs uppercase">Unit Price</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-500 text-xs uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {viewTx.items.map(item => (
                    <tr key={item.id} className="border-t border-gray-50">
                      <td className="px-4 py-3 text-gray-800">
                        {item.medicine.name}
                        {item.medicine.brandName && <span className="text-gray-400 italic ml-1">{item.medicine.brandName}</span>}
                        {item.medicine.strength   && <span className="text-gray-400 ml-1">{item.medicine.strength}</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatPHP(item.unitPrice)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatPHP(item.unitPrice * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span><span>{formatPHP(viewTx.subtotal)}</span>
              </div>
              {viewTx.discountType && (
                <div className="flex justify-between text-orange-600">
                  <span>{viewTx.discountType} Discount (20%)</span>
                  <span>-{formatPHP(viewTx.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2">
                <span>Total</span><span>{formatPHP(viewTx.totalAmount)}</span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Bulk delete confirmation */}
      {showDeleteConfirm && (
        <Modal title="Delete Transactions" onClose={() => setShowDeleteConfirm(false)}>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700">
              <p className="font-semibold mb-1">This cannot be undone.</p>
              <p>You are about to permanently delete <strong>{checkedIds.size} transaction record{checkedIds.size !== 1 ? 's' : ''}</strong>.</p>
              <p className="mt-2 text-red-500">Note: stock quantities will <em>not</em> be restored.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold active:bg-gray-50 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={deleting}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl text-sm font-semibold active:bg-red-700 disabled:opacity-50 min-h-[44px]"
              >
                {deleting ? 'Deleting...' : `Delete ${checkedIds.size} record${checkedIds.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
