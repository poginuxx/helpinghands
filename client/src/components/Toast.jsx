import { useEffect } from 'react';

const STYLES = {
  error:   'bg-red-600',
  success: 'bg-emerald-600',
  warning: 'bg-amber-500',
};

const ICONS = {
  error:   '✕',
  success: '✓',
  warning: '⚠',
};

export default function Toast({ message, type = 'error', onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl text-white text-sm font-medium shadow-xl max-w-sm animate-fade-in ${STYLES[type]}`}
    >
      <span className="text-base leading-none shrink-0">{ICONS[type]}</span>
      <span className="flex-1">{message}</span>
      <button
        onClick={onDismiss}
        className="text-white/70 active:text-white text-lg leading-none shrink-0 ml-1"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
