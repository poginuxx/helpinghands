import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { getChart, getTopMedicines, getSummary, getExportUrl } from '../api/reports';

const PERIODS = [
  { key: 'daily',   label: 'Daily (30 days)' },
  { key: 'weekly',  label: 'Weekly (12 wks)' },
  { key: 'monthly', label: 'Monthly (12 mo)' },
];

function formatPHP(v) {
  return '₱' + Number(v).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatPHPFull(v) {
  return '₱' + Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatCard({ label, value, sub, color = 'teal' }) {
  const colors = {
    teal:    'bg-teal-50 text-teal-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    red:     'bg-red-50 text-red-700',
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-xl font-bold ${colors[color].split(' ')[1]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.fill }}>
          {p.name}: {formatPHPFull(p.value)}
        </p>
      ))}
    </div>
  );
};

export default function Reports() {
  const [period, setPeriod]         = useState('daily');
  const [chartData, setChartData]   = useState([]);
  const [topMeds, setTopMeds]       = useState([]);
  const [summary, setSummary]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const exportUrl = getExportUrl();

  // Initial load
  useEffect(() => {
    Promise.all([getChart('daily'), getTopMedicines(), getSummary()])
      .then(([c, t, s]) => {
        setChartData(c);
        setTopMeds(t);
        setSummary(s);
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  // Period switch
  useEffect(() => {
    if (loading) return;
    setChartLoading(true);
    getChart(period).then(data => {
      setChartData(data);
      setChartLoading(false);
    });
  }, [period]);

  // Aggregate totals for selected period chart data
  const totalRevenue = chartData.reduce((s, d) => s + d.revenue, 0);
  const totalCogs    = chartData.reduce((s, d) => s + d.cogs, 0);
  const totalProfit  = chartData.reduce((s, d) => s + d.profit, 0);

  function handleExport() {
    const token = localStorage.getItem('token');
    // Trigger download via fetch → blob
    fetch(exportUrl, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pharmapoint-sales.csv';
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-bold text-gray-900">Reports</h1>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
              <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
              <div className="h-6 bg-gray-100 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/3" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse h-80" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Reports</h1>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center">
          <p className="text-red-600 font-medium mb-1">Failed to load report data</p>
          <p className="text-red-400 text-sm">Check your connection and reload the page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Reports</h1>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl font-semibold text-sm active:bg-teal-700 transition-colors min-h-[44px]"
        >
          <span>↓</span> Export CSV
        </button>
      </div>

      {/* All-time month summary from dashboard */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="This Month Revenue"
            value={formatPHPFull(summary.month.revenue)}
            sub={`${summary.month.count} sales`}
            color="teal"
          />
          <StatCard
            label="This Month COGS"
            value={formatPHPFull(summary.month.cogs)}
            sub="Cost of goods sold"
            color="red"
          />
          <StatCard
            label="This Month Profit"
            value={formatPHPFull(summary.month.profit)}
            sub={summary.month.revenue > 0
              ? `${((summary.month.profit / summary.month.revenue) * 100).toFixed(1)}% margin`
              : 'No sales yet'}
            color="emerald"
          />
        </div>
      )}

      {/* Revenue chart */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-gray-800">Revenue &amp; Profit</h2>
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {PERIODS.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[36px] ${
                  period === p.key
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-gray-500 active:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {chartLoading ? (
          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Loading chart...</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} barGap={2} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  interval={period === 'daily' ? 4 : 0}
                />
                <YAxis
                  tickFormatter={v => '₱' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={55}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={v => <span style={{ fontSize: 12, color: '#64748b' }}>{v}</span>}
                />
                <Bar dataKey="revenue" name="Revenue" fill="#0d9488" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cogs"    name="COGS"    fill="#fca5a5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit"  name="Profit"  fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* Chart period totals */}
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-50">
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">Total Revenue</p>
                <p className="text-sm font-bold text-teal-700">{formatPHPFull(totalRevenue)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">Total COGS</p>
                <p className="text-sm font-bold text-red-400">{formatPHPFull(totalCogs)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">Gross Profit</p>
                <p className={`text-sm font-bold ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {formatPHPFull(totalProfit)}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Top 10 medicines */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Top 10 Best-Selling Medicines</h2>
        {topMeds.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No sales data yet</p>
        ) : (
          <div className="space-y-2">
            {topMeds.map((med, idx) => {
              const maxQty = topMeds[0].totalQty;
              const pct = (med.totalQty / maxQty) * 100;
              return (
                <div key={med.medicineId} className="flex items-center gap-3">
                  <span className="w-6 text-xs font-bold text-gray-300 text-right shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {med.name}
                        {med.brandName && <span className="text-gray-400 font-normal italic"> {med.brandName}</span>}
                        {med.strength  && <span className="text-gray-400 font-normal"> {med.strength}</span>}
                      </p>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <span className="text-xs text-gray-500">{med.totalQty} units</span>
                        <span className="text-sm font-bold text-teal-700">{formatPHPFull(med.totalRevenue)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-400 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
