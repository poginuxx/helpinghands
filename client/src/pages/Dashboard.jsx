import { useState, useEffect } from 'react';
import { getSummary } from '../api/reports';

function formatPHP(amount) {
  return '₱' + Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function daysUntilExpiry(iso) {
  const diff = new Date(iso) - Date.now();
  return Math.ceil(diff / 86400000);
}

function SummaryCard({ label, revenue, profit, count }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{formatPHP(revenue)}</p>
      <p className="text-sm text-gray-500 mt-0.5">Revenue · {count} sale{count !== 1 ? 's' : ''}</p>
      <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
        <span className="text-xs text-gray-400">Gross Profit</span>
        <span className={`text-sm font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {formatPHP(profit)}
        </span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getSummary()
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Dashboard</h1>
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
              <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
              <div className="h-7 bg-gray-100 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Dashboard</h1>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center">
          <p className="text-red-600 font-medium mb-1">Failed to load dashboard data</p>
          <p className="text-red-400 text-sm mb-4">Check your connection and try again.</p>
          <button
            onClick={() => { setError(false); setLoading(true); getSummary().then(setData).catch(() => setError(true)).finally(() => setLoading(false)); }}
            className="px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold active:bg-red-700 min-h-[44px]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { today, week, month, lowStock, expiringSoon } = data;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-400">
          {new Date().toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Sales summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Today"      {...today} />
        <SummaryCard label="This Week"  {...week} />
        <SummaryCard label="This Month" {...month} />
      </div>

      {/* Alerts row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Low stock */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">⚠️</span>
            <h2 className="font-semibold text-gray-800">Low Stock</h2>
            {lowStock.length > 0 && (
              <span className="ml-auto bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
                {lowStock.length}
              </span>
            )}
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">All stock levels are healthy ✓</p>
          ) : (
            <div className="space-y-2">
              {lowStock.map(m => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {m.name}
                      {m.brandName && <span className="text-gray-400 font-normal italic"> {m.brandName}</span>}
                      {m.strength  && <span className="text-gray-400 font-normal"> {m.strength}</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-600">{m.stockQty} left</p>
                    <p className="text-xs text-gray-400">min {m.reorderLevel}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expiring soon */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">📅</span>
            <h2 className="font-semibold text-gray-800">Expiring Soon</h2>
            {expiringSoon.length > 0 && (
              <span className="ml-auto bg-orange-100 text-orange-600 text-xs font-bold px-2 py-0.5 rounded-full">
                {expiringSoon.length}
              </span>
            )}
          </div>
          {expiringSoon.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No medicines expiring within 30 days ✓</p>
          ) : (
            <div className="space-y-2">
              {expiringSoon.map(m => {
                const days = daysUntilExpiry(m.expiryDate);
                const urgent = days <= 7;
                return (
                  <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {m.name}{m.strength ? <span className="text-gray-400 font-normal"> {m.strength}</span> : ''}
                      </p>
                      <p className="text-xs text-gray-400">Expires {formatDate(m.expiryDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${urgent ? 'text-red-600' : 'text-orange-500'}`}>
                        {days <= 0 ? 'Expired' : `${days}d`}
                      </p>
                      <p className="text-xs text-gray-400">{m.stockQty} in stock</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
