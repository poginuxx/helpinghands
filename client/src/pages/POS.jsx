import { useState, useEffect, useRef } from 'react';
import { getMedicines } from '../api/medicines';
import { createTransaction } from '../api/transactions';
import { useToast } from '../context/ToastContext';

const PAYMENT_METHODS = ['CASH', 'CARD', 'GCASH', 'MAYA'];

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

export default function POS() {
  const [medicines, setMedicines] = useState([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [discountType, setDiscountType] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [loading, setLoading] = useState(false);
  const [completedTx, setCompletedTx] = useState(null);
  const searchRef = useRef(null);
  const showToast = useToast();

  useEffect(() => {
    getMedicines().then(setMedicines);
  }, []);

  const filtered = search.trim()
    ? medicines.filter(m => {
        const q = search.toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          (m.brandName && m.brandName.toLowerCase().includes(q)) ||
          (m.strength  && m.strength.toLowerCase().includes(q))
        );
      })
    : medicines;

  function addToCart(medicine) {
    if (medicine.stockQty === 0) return;
    setCart(prev => {
      const existing = prev.find(i => i.medicineId === medicine.id);
      if (existing) {
        if (existing.quantity >= medicine.stockQty) return prev;
        return prev.map(i =>
          i.medicineId === medicine.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, {
        medicineId:   medicine.id,
        name:         medicine.name,
        brandName:    medicine.brandName,
        strength:     medicine.strength,
        sellingPrice: medicine.sellingPrice,
        stockQty:     medicine.stockQty,
        quantity:     1,
      }];
    });
  }

  function updateQty(medicineId, qty) {
    const item = cart.find(i => i.medicineId === medicineId);
    if (!item) return;
    const clamped = Math.max(1, Math.min(qty, item.stockQty));
    setCart(prev => prev.map(i => i.medicineId === medicineId ? { ...i, quantity: clamped } : i));
  }

  function removeFromCart(medicineId) {
    setCart(prev => prev.filter(i => i.medicineId !== medicineId));
  }

  function clearCart() {
    setCart([]);
    setDiscountType(null);
    setPaymentMethod('CASH');
  }

  const subtotal = cart.reduce((sum, i) => sum + i.sellingPrice * i.quantity, 0);
  const discountAmount = discountType ? subtotal * 0.20 : 0;
  const total = subtotal - discountAmount;

  async function handleCheckout() {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const tx = await createTransaction({
        items: cart.map(i => ({ medicineId: i.medicineId, quantity: i.quantity })),
        discountType,
        paymentMethod,
      });
      setCompletedTx(tx);
      setCart([]);
      setDiscountType(null);
      setPaymentMethod('CASH');
      setSearch('');
      getMedicines().then(setMedicines);
    } catch (err) {
      showToast(err.response?.data?.message || 'Checkout failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  if (completedTx) {
    return (
      <div className="h-full flex flex-col">
        {/* Screen view */}
        <div className="flex-1 flex items-center justify-center p-8 print:hidden">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm w-full max-w-md p-8 text-center">
            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              ✓
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Sale Complete</h2>
            <p className="text-gray-500 text-sm mb-6">Transaction #{completedTx.id}</p>
            <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 mb-6">
              {completedTx.items.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-700">
                    {item.medicine.name}{item.medicine.strength ? ` ${item.medicine.strength}` : ''} ×{item.quantity}
                  </span>
                  <span className="text-gray-900 font-medium">{formatPHP(item.unitPrice * item.quantity)}</span>
                </div>
              ))}
              <div className="border-t border-gray-200 pt-2 space-y-1">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Subtotal</span><span>{formatPHP(completedTx.subtotal)}</span>
                </div>
                {completedTx.discountType && (
                  <div className="flex justify-between text-sm text-orange-600">
                    <span>{completedTx.discountType} Discount (20%)</span>
                    <span>-{formatPHP(completedTx.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900">
                  <span>Total</span><span>{formatPHP(completedTx.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Payment</span><span>{completedTx.paymentMethod}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handlePrint}
                className="flex-1 py-3 border border-teal-600 text-teal-600 rounded-xl font-semibold text-sm active:bg-teal-50 transition-colors min-h-[44px]"
              >
                Print Receipt
              </button>
              <button
                onClick={() => setCompletedTx(null)}
                className="flex-1 py-3 bg-teal-600 text-white rounded-xl font-semibold text-sm active:bg-teal-700 transition-colors min-h-[44px]"
              >
                New Sale
              </button>
            </div>
          </div>
        </div>

        {/* Print layout */}
        <div className="hidden print:block p-8 text-sm font-mono">
          <div className="text-center mb-4">
            <p className="text-xl font-bold">PharmaPoint</p>
            <p className="text-gray-600">Official Receipt</p>
            <p className="text-gray-500 mt-1">{formatDate(completedTx.date)}</p>
            <p className="text-gray-500">Txn #{completedTx.id}</p>
          </div>
          <div className="border-t border-b border-dashed border-gray-400 py-3 space-y-1 my-3">
            {completedTx.items.map(item => (
              <div key={item.id} className="flex justify-between">
                <span>
                  {item.medicine.name}{item.medicine.strength ? ` ${item.medicine.strength}` : ''}<br />
                  <span className="text-gray-500">  x{item.quantity} @ {formatPHP(item.unitPrice)}</span>
                </span>
                <span>{formatPHP(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatPHP(completedTx.subtotal)}</span></div>
            {completedTx.discountType && (
              <div className="flex justify-between"><span>{completedTx.discountType} Disc. (20%)</span><span>-{formatPHP(completedTx.discountAmount)}</span></div>
            )}
            <div className="flex justify-between font-bold border-t border-gray-400 pt-1 mt-1">
              <span>TOTAL</span><span>{formatPHP(completedTx.totalAmount)}</span>
            </div>
            <div className="flex justify-between"><span>Payment</span><span>{completedTx.paymentMethod}</span></div>
          </div>
          <p className="text-center mt-6 text-gray-500">Thank you for your purchase!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* LEFT — Medicine search & list */}
      <div className="flex-1 flex flex-col border-r border-gray-100 overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-900 mb-3">Point of Sale</h1>
          <input
            ref={searchRef}
            type="text"
            placeholder="Search medicines..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {filtered.length === 0 ? (
            <p className="text-gray-400 text-sm text-center mt-10">No medicines found</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filtered.map(med => {
                const outOfStock = med.stockQty === 0;
                const inCart = cart.find(i => i.medicineId === med.id);
                return (
                  <button
                    key={med.id}
                    onClick={() => addToCart(med)}
                    disabled={outOfStock}
                    className={`text-left p-3 rounded-xl border transition-colors min-h-[72px] ${
                      outOfStock
                        ? 'bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed'
                        : inCart
                        ? 'bg-teal-50 border-teal-300 active:bg-teal-100'
                        : 'bg-white border-gray-100 active:bg-gray-50'
                    }`}
                  >
                    <p className="font-semibold text-gray-900 text-sm leading-tight">
                      {med.name}
                      {med.brandName && <span className="text-gray-400 font-normal italic"> {med.brandName}</span>}
                      {med.strength  && <span className="text-gray-500 font-normal"> {med.strength}</span>}
                    </p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-teal-700 font-bold text-sm">{formatPHP(med.sellingPrice)}</span>
                      <span className={`text-xs ${outOfStock ? 'text-red-500' : 'text-gray-400'}`}>
                        {outOfStock ? 'Out of stock' : `Stock: ${med.stockQty}`}
                      </span>
                    </div>
                    {inCart && (
                      <p className="text-xs text-teal-600 font-medium mt-0.5">In cart: {inCart.quantity}</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — Cart & Payment */}
      <div className="w-80 flex flex-col bg-white overflow-hidden shrink-0">
        <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Cart</h2>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-red-500 active:text-red-700 font-medium min-h-[44px] px-2"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {cart.length === 0 ? (
            <p className="text-gray-400 text-sm text-center mt-10">Cart is empty</p>
          ) : (
            cart.map(item => (
              <div key={item.medicineId} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {item.name}
                    {item.brandName && <span className="italic text-gray-400 font-normal"> {item.brandName}</span>}
                    {item.strength  && <span className="text-gray-500 font-normal"> {item.strength}</span>}
                  </p>
                  <p className="text-xs text-gray-500">{formatPHP(item.sellingPrice)} each</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => item.quantity === 1 ? removeFromCart(item.medicineId) : updateQty(item.medicineId, item.quantity - 1)}
                    className="w-7 h-7 bg-white border border-gray-200 rounded-lg text-gray-600 font-bold text-sm flex items-center justify-center active:bg-gray-100"
                  >
                    {item.quantity === 1 ? '×' : '−'}
                  </button>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={e => updateQty(item.medicineId, parseInt(e.target.value) || 1)}
                    className="w-10 text-center text-sm font-semibold border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-1 focus:ring-teal-400"
                    min={1}
                    max={item.stockQty}
                  />
                  <button
                    onClick={() => updateQty(item.medicineId, item.quantity + 1)}
                    className="w-7 h-7 bg-white border border-gray-200 rounded-lg text-gray-600 font-bold text-sm flex items-center justify-center active:bg-gray-100"
                  >
                    +
                  </button>
                </div>
                <span className="text-sm font-bold text-gray-900 w-16 text-right shrink-0">
                  {formatPHP(item.sellingPrice * item.quantity)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Totals + Discount + Payment */}
        <div className="border-t border-gray-100 px-5 pt-4 pb-5 space-y-4">
          {/* Discount */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Discount</p>
            <div className="flex gap-2">
              {[null, 'PWD', 'SENIOR'].map(d => (
                <button
                  key={String(d)}
                  onClick={() => setDiscountType(discountType === d ? null : d)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors min-h-[44px] ${
                    discountType === d
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : 'bg-white border-gray-200 text-gray-600 active:bg-gray-50'
                  }`}
                >
                  {d === null ? 'None' : d}
                </button>
              ))}
            </div>
          </div>

          {/* Payment method */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Payment</p>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map(pm => (
                <button
                  key={pm}
                  onClick={() => setPaymentMethod(pm)}
                  className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors min-h-[44px] ${
                    paymentMethod === pm
                      ? 'bg-teal-600 border-teal-600 text-white'
                      : 'bg-white border-gray-200 text-gray-600 active:bg-gray-50'
                  }`}
                >
                  {pm}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span><span>{formatPHP(subtotal)}</span>
            </div>
            {discountType && (
              <div className="flex justify-between text-sm text-orange-600">
                <span>{discountType} (20%)</span><span>-{formatPHP(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-200">
              <span>Total</span><span>{formatPHP(total)}</span>
            </div>
          </div>

          {/* Checkout button */}
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || loading}
            className="w-full py-4 bg-teal-600 text-white rounded-xl font-bold text-base active:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[56px]"
          >
            {loading ? 'Processing...' : `Charge ${formatPHP(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
