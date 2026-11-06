// The planning engine: suitability (diet, allergens, kit, calories), cost
// estimates, week generation with ingredient reuse and budget repair, and
// swap suggestions. Runs fully offline on the built-in recipe library.
import { state, allRecipes, getIngredient, getRecipe, recentRecipeIds } from './store.js';
import { DIETS, VIBES } from './data/ingredients.js';
import { storeFor } from './data/stores.js';
import { fmtMoney } from './units.js';

/* ---------- Recipe facts --------------------------------------------------- */
export const totalTime = (r) => (r.prep || 0) + (r.cook || 0);
const isSlow = (r) => (r.needs || []).some((g) => g.includes('slowcooker'));
// Hands-on time is what matters for effort; slow-cooker dishes are mostly waiting.
export const effortTime = (r) => (isSlow(r) && r.cook > 90 ? r.prep : totalTime(r));

export function flagsOf(r) {
  const flags = new Set(r.flags || []);
  for (const [key] of r.ing) for (const f of getIngredient(key)?.flags || []) flags.add(f);
  return flags;
}

export function vibesOf(r) {
  const v = new Set(r.vibes || []);
  if (totalTime(r) <= 30) v.add('quick');
  if (r.n?.kcal && r.n.kcal <= 500) v.add('lowcal');
  if (r.n?.protein >= 35) v.add('protein');
  if (r.n?.fibre >= 10) v.add('fibre');
  return v;
}
export const vibeLabels = (r) => VIBES.filter((v) => vibesOf(r).has(v.id));

export function dietLabels(r) {
  const flags = flagsOf(r);
  return DIETS.filter((d) => (d.blocks ? !d.blocks.some((b) => flags.has(b)) : (r.n?.carbs ?? 99) <= d.maxCarbs))
    .filter((d) => !['no-pork', 'no-red-meat'].includes(d.id))
    .map((d) => d.label);
}

// Which bit of kit you'd use, and tips when it's an alternative.
export function methodFor(r, equipment = state.profile.equipment) {
  const have = new Set(equipment);
  const used = [];
  const tips = [];
  for (const group of r.needs || []) {
    const pick = group.find((e) => have.has(e));
    if (!pick) return { ok: false, missing: group };
    used.push(pick);
    if (pick !== group[0] && r.adapt?.[pick]) tips.push(r.adapt[pick]);
  }
  return { ok: true, used, tips };
}

export function suitability(r, profile = state.profile) {
  const reasons = [];
  const flags = flagsOf(r);
  for (const id of profile.diets) {
    const d = DIETS.find((x) => x.id === id);
    if (!d) continue;
    if (d.blocks?.some((b) => flags.has(b))) reasons.push(`Not ${d.label.toLowerCase()}`);
    if (d.maxCarbs && (r.n?.carbs ?? 0) > d.maxCarbs) reasons.push('Higher in carbs');
  }
  const hits = profile.allergens.filter((a) => flags.has(a));
  if (hits.length) reasons.push(`Contains ${hits.join(', ')}`);
  const m = methodFor(r, profile.equipment);
  if (!m.ok) reasons.push(`Needs ${m.missing.join(' or ')}`);
  if (profile.kcal && r.n?.kcal > profile.kcal * 1.15) reasons.push('Above your calorie target');
  return { ok: !reasons.length, reasons };
}

/* ---------- Cost ------------------------------------------------------------- */
const regionKey = (region) => (region === 'us' ? 'usd' : 'gbp');
export function packPrice(ing, region = state.profile.region, store = storeFor(region, state.profile.store)) {
  return (ing.price?.[regionKey(region)] ?? 0) * (store?.index ?? 1);
}

// Cost of what one serving actually uses (proportional to the pack).
export function servingCost(r, profile = state.profile) {
  const store = storeFor(profile.region, profile.store);
  let total = 0;
  for (const [key, qty] of r.ing) {
    const ing = getIngredient(key);
    if (ing?.pack) total += (qty / ing.pack) * packPrice(ing, profile.region, store);
  }
  return total;
}

// Ingredient needs across slots: key -> { qty, uses: [{ day, recipe, qty }] }
export function needMap(slots) {
  const need = new Map();
  for (const s of slots) {
    if (s.status === 'skipped') continue;
    const r = getRecipe(s.recipeId);
    if (!r) continue;
    for (const [key, qty] of r.ing) {
      const e = need.get(key) || { qty: 0, uses: [] };
      e.qty += qty * s.servings;
      e.uses.push({ day: s.day, recipeId: r.id, name: r.name, qty: qty * s.servings });
      need.set(key, e);
    }
  }
  return need;
}

// What you'd spend this week: whole packs of fresh items, a proportional
// share of cupboard staples, nothing for items already in your pantry.
export function weekCost(slots, profile = state.profile) {
  const store = storeFor(profile.region, profile.store);
  let total = 0;
  for (const [key, e] of needMap(slots)) {
    if (state.pantry[key]) continue;
    const ing = getIngredient(key);
    if (!ing?.pack) continue;
    const price = packPrice(ing, profile.region, store);
    total += ing.staple ? (e.qty / ing.pack) * price : Math.ceil(e.qty / ing.pack - 1e-6) * price;
  }
  return total;
}

/* ---------- Scoring ---------------------------------------------------------- */
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function score(r, ctx) {
  const { profile, chosen, need, recent, rand, jitter, perMealBudget } = ctx;
  let s = 1 + rand() * jitter;
  const vibes = vibesOf(r);
  s += 1.1 * Math.min(2, profile.vibes.filter((v) => vibes.has(v)).length);
  if (state.favorites.includes(r.id)) s += 1.2;
  if (recent.has(r.id)) s -= 2.5;

  const t = effortTime(r);
  if (profile.effort === 'quick') s += t <= 30 ? 0.6 : -1.5 * ((t - 30) / 30);
  else if (profile.effort === 'balanced') s += t > 60 ? -1 : 0;
  else if (profile.effort === 'keen' && t >= 35) s += 0.4;

  if (profile.kcal && r.n?.kcal) s -= Math.max(0, (r.n.kcal - profile.kcal) / profile.kcal) * 3;

  const servings = profile.people;
  for (const [key, qty] of r.ing) {
    const ing = getIngredient(key);
    if (!ing) continue;
    const p = state.pantry[key];
    if (p && !ing.staple) s += p.useSoon ? 1.4 : ing.perishable ? 0.8 : 0.25;
    if (profile.reuse && ing.perishable && !ing.staple && !p) {
      const e = need.get(key);
      if (e) {
        const leftover = Math.ceil(e.qty / ing.pack - 1e-6) * ing.pack - e.qty;
        s += leftover >= qty * servings * 0.6 ? 1.0 : 0.35;
      }
    }
  }

  const proteins = chosen.map((c) => c.protein);
  const cuisines = chosen.map((c) => c.cuisine);
  s -= 1.0 * proteins.filter((p) => p === r.protein).length;
  if (cuisines.filter((c) => c === r.cuisine).length >= 2) s -= 0.8;

  if (perMealBudget) {
    const inc = ctx.costWith(r) - ctx.baseCost;
    s -= Math.max(0, (inc - perMealBudget) / perMealBudget) * 1.6;
    s += Math.max(0, (perMealBudget - inc) / perMealBudget) * 0.4;
  }
  return s;
}

function buildCtx(slots, profile, weekKey, opts) {
  const chosen = slots.map((s) => getRecipe(s.recipeId)).filter(Boolean);
  const need = needMap(slots);
  const baseCost = weekCost(slots, profile);
  const nDays = Math.max(1, profile.days.length);
  return {
    profile,
    chosen,
    need,
    recent: new Set(recentRecipeIds(weekKey)),
    rand: opts.rand,
    jitter: opts.jitter ?? 0.8,
    perMealBudget: profile.budget ? profile.budget / nDays : null,
    baseCost,
    costWith: (r) => weekCost([...slots, { day: -1, recipeId: r.id, servings: profile.people, status: 'planned' }], profile),
  };
}

export function candidates(profile = state.profile) {
  return allRecipes().filter((r) => suitability(r, profile).ok && !state.disliked.includes(r.id));
}

/* ---------- Week generation ------------------------------------------------ */
// keep: slots to preserve (locked or cooked). Returns { slots, cost, overBudget, notes }.
export function generateWeek({ weekKey, profile = state.profile, keep = [], seed = Date.now(), jitter } = {}) {
  const rand = mulberry(seed);
  const pool = candidates(profile);
  let slots = keep.map((s) => ({ ...s }));
  const keptDays = new Set(slots.map((s) => s.day));
  const days = [...profile.days].sort((a, b) => a - b).filter((d) => !keptDays.has(d));
  const notes = [];
  if (!pool.length) return { slots, cost: weekCost(slots, profile), overBudget: false, notes: ['No recipes match all of your preferences. Try relaxing a filter in Settings.'] };

  for (const day of days) {
    const used = new Set(slots.map((s) => s.recipeId));
    const ctx = buildCtx(slots, profile, weekKey, { rand, jitter });
    let best = null, bestScore = -Infinity;
    for (const r of pool) {
      if (used.has(r.id)) continue;
      const sc = score(r, ctx);
      if (sc > bestScore) { best = r; bestScore = sc; }
    }
    if (!best) { notes.push('Ran out of matching recipes for some nights.'); break; }
    slots.push({ day, recipeId: best.id, servings: profile.people, status: 'planned', locked: false });
  }
  slots.sort((a, b) => a.day - b.day);

  // Budget repair: swap the costliest unlocked meals for cheaper matches.
  let cost = weekCost(slots, profile);
  if (profile.budget) {
    for (let iter = 0; iter < 14 && cost > profile.budget; iter++) {
      let bestSwap = null;
      const used = new Set(slots.map((s) => s.recipeId));
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        if (s.locked || s.status === 'cooked' || keptDays.has(s.day)) continue;
        for (const r of pool) {
          if (used.has(r.id)) continue;
          const trial = slots.map((x, j) => (j === i ? { ...x, recipeId: r.id } : x));
          const c = weekCost(trial, profile);
          if (c < cost - 0.01 && (!bestSwap || c < bestSwap.cost)) bestSwap = { i, id: r.id, cost: c };
        }
      }
      if (!bestSwap) break;
      slots[bestSwap.i] = { ...slots[bestSwap.i], recipeId: bestSwap.id };
      cost = bestSwap.cost;
    }
  }
  const overBudget = !!profile.budget && cost > profile.budget + 0.01;
  if (overBudget) notes.push(`About ${fmtMoney(cost - profile.budget, profile.region)} over budget. Swap a meal or skip a night to bring it down.`);
  return { slots, cost, overBudget, notes };
}

/* ---------- Swap suggestions -------------------------------------------------- */
export function swapOptions(slots, day, { profile = state.profile, weekKey, n = 6, seed = Date.now() } = {}) {
  const current = slots.find((s) => s.day === day);
  const others = slots.filter((s) => s.day !== day);
  const ctx = buildCtx(others, profile, weekKey, { rand: mulberry(seed), jitter: 0.25 });
  const nowCost = weekCost(slots, profile);
  const inPlan = new Set(slots.map((s) => s.recipeId));
  return candidates(profile)
    .filter((r) => !inPlan.has(r.id))
    .map((r) => {
      const trial = [...others, { ...current, recipeId: r.id, status: 'planned' }];
      const delta = weekCost(trial, profile) - nowCost;
      return { recipe: r, score: score(r, ctx), delta, reasons: reasonsFor(r, ctx, delta, profile) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

function reasonsFor(r, ctx, delta, profile) {
  const out = [];
  const pantryHits = r.ing.map(([k]) => k).filter((k) => state.pantry[k] && !getIngredient(k)?.staple);
  if (pantryHits.length) out.push(`Uses your ${getIngredient(pantryHits[0])?.one || 'pantry items'}`);
  const shared = r.ing.map(([k]) => k).filter((k) => !state.pantry[k] && ctx.need.has(k) && getIngredient(k)?.perishable && !getIngredient(k)?.staple);
  if (shared.length) out.push(`Reuses ${getIngredient(shared[0])?.one}`);
  if (delta < -0.25) out.push(`Saves ${fmtMoney(-delta, profile.region)}`);
  else if (delta > 0.25) out.push(`+${fmtMoney(delta, profile.region)}`);
  const v = vibesOf(r);
  const matched = profile.vibes.filter((x) => v.has(x));
  if (matched.length) out.push(VIBES.find((x) => x.id === matched[0])?.label);
  return out.slice(0, 3);
}
