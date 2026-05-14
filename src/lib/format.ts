export const currency = (n: number, frac = 0) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: frac, minimumFractionDigits: frac });

export const compactCurrency = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `$${Math.round(n)}`;
};

export const compactNumber = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return Math.round(n).toLocaleString();
};

export const hours = (n: number) => `${Math.round(n).toLocaleString()} hrs`;

export const formatTime = (t: number) => {
  const d = new Date(t);
  return d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
};
