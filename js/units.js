// Quantity and money formatting. Quantities are stored metric; the US region
// shows ounces / pounds / cups.
import { REGIONS } from './data/stores.js';

const FRACTIONS = [[0.125, '⅛'], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾']];

export function nice(n) {
  if (n == null || !Number.isFinite(n)) return '';
  if (n >= 10) return String(Math.round(n));
  const whole = Math.floor(n + 1e-9);
  const frac = n - whole;
  if (frac < 0.07) return String(whole || (n > 0 ? '⅛' : '0'));
  if (frac > 0.93) return String(whole + 1);
  let best = FRACTIONS[0];
  for (const f of FRACTIONS) if (Math.abs(f[0] - frac) < Math.abs(best[0] - frac)) best = f;
  return whole ? `${whole}${best[1]}` : best[1];
}

const roundTo = (n, step) => Math.max(step, Math.round(n / step) * step);

// Amount with unit, e.g. "450 g", "1.2 kg", "8 oz", "1½ tsp".
export function fmtAmount(qty, unit, region = 'uk') {
  if (qty == null) return '';
  switch (unit) {
    case 'g':
      if (region === 'us') {
        const oz = qty / 28.35;
        return oz >= 16 ? `${(oz / 16).toFixed(oz >= 160 ? 0 : 1).replace(/\.0$/, '')} lb` : `${nice(roundTo(oz, 0.25))} oz`;
      }
      return qty >= 1000 ? `${(qty / 1000).toFixed(qty >= 10000 ? 0 : 1).replace(/\.0$/, '')} kg` : `${roundTo(qty, qty < 20 ? 1 : 5)} g`;
    case 'ml':
      if (region === 'us') {
        if (qty < 45) return `${nice(roundTo(qty / 14.79, 0.5))} tbsp`;
        return `${nice(roundTo(qty / 236.6, 0.25))} cup${qty / 236.6 > 1.1 ? 's' : ''}`;
      }
      return qty >= 1000 ? `${(qty / 1000).toFixed(1).replace(/\.0$/, '')} L` : `${roundTo(qty, qty < 50 ? 5 : 10)} ml`;
    case 'tsp': return `${nice(qty)} tsp`;
    case 'tbsp': return `${nice(qty)} tbsp`;
    default: return nice(qty);
  }
}

// A recipe line: "150 g chicken thigh" / "½ red onion" / "2 garlic cloves".
export function fmtLine(ing, qty, region = 'uk', displayName = null) {
  const name = displayName || (region === 'us' && ing.usName ? ing.usName.toLowerCase().replace(/ \(.*\)$/, '') : ing.one);
  if (ing.unit === 'item' || ing.unit === 'clove' || ing.unit === 'stick') {
    const plural = qty > 1.01;
    let word = name;
    if (plural && ing.unit === 'clove') word = 'garlic cloves';
    else if (plural && ing.unit === 'stick') word = 'celery sticks';
    else if (plural && !/s$/.test(word)) word = word.replace(/(ch|sh|x)$/, '$1e') + 's';
    return `${nice(qty)} ${word}`;
  }
  return `${fmtAmount(qty, ing.unit, region)} ${name}`;
}

export function fmtMoney(amount, region = 'uk', { round = false } = {}) {
  const r = REGIONS[region] || REGIONS.uk;
  if (amount == null || !Number.isFinite(amount)) return '–';
  return new Intl.NumberFormat(r.locale, { style: 'currency', currency: r.currency, maximumFractionDigits: round ? 0 : 2, minimumFractionDigits: round ? 0 : 2 }).format(amount);
}
export const currencySymbol = (region) => (REGIONS[region] || REGIONS.uk).symbol;
