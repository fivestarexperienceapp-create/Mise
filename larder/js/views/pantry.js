// Pantry tab: what's already in the kitchen. Plans favour these ingredients
// (especially "use soon" ones) and the shopping list leaves them off.
import { state, on, addPantry, removePantry, setPantryUseSoon, thisWeek, getPlan, savePlan } from '../store.js';
import { INGREDIENTS, ingredientName } from '../data/ingredients.js';
import { generateWeek } from '../planner.js';
import { html, setHTML, plural, similarity } from '../utils.js';
import { icon, toast, confirmDialog } from '../ui.js';
import { goTab } from '../router.js';
import { openPantryScan } from './ai-flows.js';

const QUICK = ['onion', 'garlic', 'potato', 'carrot', 'egg', 'milk', 'butter', 'cheddar', 'spinach', 'bell-pepper', 'lemon', 'long-grain-rice', 'spaghetti', 'chopped-tomatoes', 'chickpeas', 'peas', 'olive-oil', 'soy-sauce', 'mixed-herbs', 'cumin', 'smoked-paprika', 'vegetable-stock'];

let root;
let visible = false;
let dirty = true;
let query = '';

export const pantryView = {
  init,
  show() { visible = true; if (dirty) render(); },
  hide() { visible = false; },
  reselect() { root.scrollTo({ top: 0, behavior: 'smooth' }); },
};

function init(el) {
  root = el;
  setHTML(root, html`
    <header class="view-head">
      <h1>Pantry</h1>
      <div class="head-actions"><button class="btn btn-primary btn-sm" data-act="scan">${icon('camera')} Scan fridge</button></div>
    </header>
    <div class="view-body">
      <form class="searchbar" data-el="form" autocomplete="off" role="search">${icon('plus')}<input data-el="q" placeholder="Add an ingredient you have" aria-label="Add an ingredient" maxlength="60"></form>
      <div data-el="suggest" class="suggest"></div>
      <div data-el="body"></div>
    </div>`);
  const q = root.querySelector('[data-el="q"]');
  q.addEventListener('input', () => { query = q.value; renderSuggest(); });
  root.querySelector('[data-el="form"]').addEventListener('submit', (e) => {
    e.preventDefault();
    const first = root.querySelector('[data-add]');
    if (first) first.click();
    else if (query.trim()) add(query.trim());
  });
  root.addEventListener('click', onClick);
  on((kind) => {
    if (['data', 'pantry', 'profile'].includes(kind)) { dirty = true; if (visible) render(); }
  });
}

function matches(text) {
  const t = text.trim().toLowerCase();
  if (t.length < 2) return [];
  return Object.values(INGREDIENTS)
    .filter((i) => !state.pantry[i.id])
    .map((i) => ({ i, s: Math.max(i.name.toLowerCase().includes(t) ? 1 : 0, i.one.toLowerCase().includes(t) ? 0.95 : 0, (i.usName || '').toLowerCase().includes(t) ? 0.9 : 0, similarity(t, i.name)) }))
    .filter((x) => x.s > 0.5)
    .sort((a, b) => b.s - a.s)
    .slice(0, 6)
    .map((x) => x.i);
}

function renderSuggest() {
  const box = root.querySelector('[data-el="suggest"]');
  const list = matches(query);
  const region = state.profile.region;
  setHTML(box, query.trim().length >= 2 ? html`<div class="chip-row" style="flex-wrap:wrap;margin-top:8px">
    ${list.map((i) => html`<button type="button" class="chip" data-add="${i.id}">${icon('plus', 'i-sm')} ${ingredientName(i, region)}</button>`)}
    ${!list.some((i) => i.name.toLowerCase() === query.trim().toLowerCase()) ? html`<button type="button" class="chip" data-add-text="${query.trim()}">${icon('plus', 'i-sm')} Add “${query.trim()}”</button>` : ''}
  </div>` : '');
}

function add(keyOrText, label) {
  addPantry(keyOrText);
  query = '';
  root.querySelector('[data-el="q"]').value = '';
  renderSuggest();
  toast(`${label || keyOrText} added to your pantry`, { iconName: 'fridge', duration: 2000 });
}

function render() {
  dirty = false;
  const region = state.profile.region;
  const entries = Object.entries(state.pantry).map(([key, p]) => ({ key, ...p, label: INGREDIENTS[key] ? ingredientName(INGREDIENTS[key], region) : p.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const soon = entries.filter((e) => e.useSoon);
  const rest = entries.filter((e) => !e.useSoon);
  const quick = QUICK.filter((k) => !state.pantry[k]);
  const chip = (e) => html`<span class="pchip ${e.useSoon ? 'soon' : ''}">
      <button type="button" data-soon="${e.key}" style="width:auto;padding:0;opacity:1" aria-label="${e.useSoon ? 'Unmark' : 'Mark'} ${e.label} as use soon">${e.useSoon ? '⏰ ' : ''}${e.label}</button>
      <button type="button" data-remove="${e.key}" aria-label="Remove ${e.label}">${icon('x')}</button>
    </span>`;

  setHTML(root.querySelector('[data-el="body"]'), html`
    ${entries.length ? html`
      <div class="callout callout--sage" style="margin-top:14px">${icon('leaf')}<div>Your plans favour these ingredients and your shopping list leaves them off. Tap an item to mark it <strong>use soon</strong> and it gets top priority.</div></div>
      ${soon.length ? html`<div class="section-title">Use soon</div><div class="pantry-chips">${soon.map(chip)}</div>` : ''}
      <div class="section-title">In your kitchen · ${entries.length}</div>
      <div class="pantry-chips">${rest.map(chip)}</div>
      <div class="plan-actions" style="margin-top:18px">
        <button class="btn btn-primary" data-act="replan">${icon('sparkles')} Re-plan around my pantry</button>
      </div>
      <button class="btn btn-ghost btn-block btn-sm" style="margin-top:6px;color:var(--danger)" data-act="clear">${icon('trash')} Clear pantry</button>`
    : html`<div class="empty" style="padding-top:26px"><div style="font-size:56px">🧺</div><h2>What’s in your kitchen?</h2>
      <p>Add ingredients you already have, or scan your fridge with AI. Larder will cook around them and keep them off your list.</p>
      <div class="actions"><button class="btn btn-primary" data-act="scan">${icon('camera')} Scan fridge or cupboard</button></div></div>`}
    ${quick.length ? html`<div class="section-title">Quick add</div>
      <div class="quick-add">${quick.map((k) => html`<button type="button" class="chip" data-add="${k}">${icon('plus', 'i-sm')} ${ingredientName(INGREDIENTS[k], region).replace(/ \(.*\)$/, '')}</button>`)}</div>` : ''}`);
}

async function onClick(e) {
  const a = e.target.closest('[data-add]');
  if (a) { const ing = INGREDIENTS[a.dataset.add]; add(a.dataset.add, ing ? ingredientName(ing, state.profile.region) : a.dataset.add); return; }
  const at = e.target.closest('[data-add-text]');
  if (at) { add(at.dataset.addText); return; }
  const s = e.target.closest('[data-soon]');
  if (s) { setPantryUseSoon(s.dataset.soon, !state.pantry[s.dataset.soon]?.useSoon); return; }
  const r = e.target.closest('[data-remove]');
  if (r) { removePantry(r.dataset.remove); return; }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'scan') openPantryScan();
  if (act === 'clear' && await confirmDialog({ title: 'Clear your pantry?', message: 'This removes every item. Your plans and recipes are not affected.', confirmText: 'Clear', danger: true })) {
    Object.keys(state.pantry).forEach(removePantry);
  }
  if (act === 'replan') {
    const week = thisWeek();
    const plan = getPlan(week);
    const keep = (plan?.slots || []).filter((x) => x.locked || x.status === 'cooked');
    if (plan?.slots?.length && !(await confirmDialog({ title: 'Re-plan this week?', message: `Unlocked dinners are replaced with ones that use what you have${keep.length ? `. ${plural(keep.length, 'locked or cooked meal')} stay` : ''}.`, confirmText: 'Re-plan' }))) return;
    const res = generateWeek({ weekKey: week, keep });
    savePlan(week, res.slots);
    goTab('plan');
    toast('New plan built around your pantry', { iconName: 'leaf' });
  }
}
