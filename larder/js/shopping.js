// Builds the week's shopping list: one merged list from every planned meal,
// scaled to servings, rounded to whole packs, minus pantry items, grouped by
// aisle in the order of the chosen supermarket.
import { state, getIngredient } from './store.js';
import { AISLES, ingredientName } from './data/ingredients.js';
import { storeFor } from './data/stores.js';
import { needMap, packPrice } from './planner.js';
import { fmtAmount, fmtMoney } from './units.js';

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function buildList(plan, profile = state.profile) {
  const region = profile.region;
  const store = storeFor(region, profile.store);
  const order = store.order;
  const groups = new Map();
  const pantryItems = [];
  let total = 0;

  const staples = [];
  for (const [key, e] of needMap(plan?.slots || [])) {
    const ing = getIngredient(key);
    if (!ing) continue;
    const packs = Math.max(1, Math.ceil(e.qty / ing.pack - 1e-6));
    const price = packPrice(ing, region, store);
    const cost = ing.staple ? (e.qty / ing.pack) * price : packs * price;
    const counted = ['item', 'clove', 'stick'].includes(ing.unit);
    const whole = Math.ceil(e.qty - 1e-6); // you can't buy ¾ of an onion
    const item = {
      key,
      name: ingredientName(ing, region),
      amount: counted ? `${whole}${ing.unit === 'clove' ? ' cloves' : ing.unit === 'stick' ? ' sticks' : ''}` : fmtAmount(e.qty, ing.unit, region),
      packs,
      packLabel: counted
        ? (ing.unit === 'clove' ? `${packs} bulb${packs > 1 ? 's' : ''}` : ing.unit === 'stick' ? `${packs} head${packs > 1 ? 's' : ''}` : ing.pack > 1 ? `${packs} × pack of ${ing.pack}` : null)
        : ['tsp', 'tbsp'].includes(ing.unit)
          ? `${packs} ${packs > 1 ? 'jars or bottles' : 'jar or bottle'}`
          : `${packs} × ${fmtAmount(ing.pack, ing.unit, region)}`,
      price: packs * price,
      staple: !!ing.staple,
      uses: e.uses.map((u) => ({ ...u, dayLabel: DAY_SHORT[u.day] })),
      aisle: AISLES[ing.aisle] ? ing.aisle : 'other',
    };
    if (state.pantry[key]) { pantryItems.push(item); continue; }
    total += cost;
    if (item.staple) { staples.push(item); continue; }
    const g = groups.get(item.aisle) || [];
    g.push(item);
    groups.set(item.aisle, g);
  }

  const sections = order.filter((a) => groups.has(a)).map((a) => ({
    aisle: a,
    label: AISLES[a][region] || AISLES[a].uk,
    items: groups.get(a).sort((x, y) => x.name.localeCompare(y.name)),
  }));
  for (const [a, items] of groups) if (!order.includes(a)) sections.push({ aisle: a, label: AISLES[a]?.[region] || 'Other', items });
  // Cupboard staples last: most kitchens have them, so check before buying.
  if (staples.length) {
    sections.push({
      aisle: 'staples',
      label: region === 'us' ? 'Pantry staples: check you have these' : 'Cupboard staples: check you have these',
      staples: true,
      items: staples.sort((x, y) => order.indexOf(x.aisle) - order.indexOf(y.aisle) || x.name.localeCompare(y.name)),
    });
  }
  return { sections, pantryItems, total, store, count: sections.reduce((n, s) => n + s.items.length, 0) };
}

// Plain-text version for sharing or pasting into another list app.
export function listAsText(list, extras = [], checked = {}, { title = 'Shopping list', region = state.profile.region } = {}) {
  const lines = [`${title} (${list.store.name})`, ''];
  for (const s of list.sections) {
    lines.push(s.label.toUpperCase());
    for (const it of s.items) lines.push(`${checked[it.key] ? '[x]' : '[ ]'} ${it.name}: ${it.amount}${it.packLabel ? ` (${it.packLabel})` : ''}`);
    lines.push('');
  }
  if (extras.length) {
    lines.push('EXTRAS');
    for (const e of extras) lines.push(`${checked[e.id] ? '[x]' : '[ ]'} ${e.name}`);
    lines.push('');
  }
  lines.push(`Estimated total: ${fmtMoney(list.total, region)}`);
  return lines.join('\n');
}
