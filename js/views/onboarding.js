// Setup quiz: where you shop, who you feed and when, budget, diet and
// allergies, kitchen kit, effort, styles, calorie target and what's already
// in the cupboard. Also used from Settings to edit preferences.
import { state, defaultProfile, completeOnboarding, setProfile, addPantry, thisWeek, getPlan, savePlan } from '../store.js';
import { DIETS, ALLERGENS, EQUIPMENT, VIBES, INGREDIENTS } from '../data/ingredients.js';
import { STORES, REGIONS } from '../data/stores.js';
import { generateWeek, candidates } from '../planner.js';
import { html, raw, setHTML, plural } from '../utils.js';
import { icon, pushOverlay, closeOverlay, toast } from '../ui.js';
import { currencySymbol, fmtMoney } from '../units.js';
import { DAY_SHORT } from './common.js';

const EFFORT = [
  { id: 'quick', label: 'Quick & easy', e: '⚡', hint: '30 minutes or less' },
  { id: 'balanced', label: 'Balanced', e: '🍳', hint: 'Up to about an hour' },
  { id: 'keen', label: 'I love to cook', e: '👩‍🍳', hint: 'Happy to take my time' },
];
const DIET_EMOJI = { vegetarian: '🥕', vegan: '🌱', pescatarian: '🐟', 'gluten-free': '🌾', 'dairy-free': '🥛', 'no-pork': '🐖', 'no-red-meat': '🥩', 'low-carb': '🥬' };
const KIT_EMOJI = { hob: '🔥', oven: '♨️', airfryer: '🌀', microwave: '📟', slowcooker: '🍲', grill: '🥓' };
const PANTRY_QUICK = ['onion', 'garlic', 'potato', 'carrot', 'egg', 'milk', 'butter', 'cheddar', 'long-grain-rice', 'basmati-rice', 'spaghetti', 'penne', 'chopped-tomatoes', 'chickpeas', 'peas', 'spinach', 'bell-pepper', 'lemon', 'olive-oil', 'vegetable-oil', 'soy-sauce', 'honey', 'mixed-herbs', 'smoked-paprika', 'cumin', 'curry-powder', 'chilli-flakes', 'tomato-puree', 'vegetable-stock', 'chicken-stock'];

export function openOnboarding({ edit = false, onDone } = {}) {
  const draft = structuredClone(edit ? state.profile : { ...defaultProfile(), ...state.profile });
  const pantryPicks = new Set(Object.keys(state.pantry));
  const steps = edit ? ['shop', 'household', 'budget', 'diet', 'kitchen', 'style'] : ['welcome', 'shop', 'household', 'budget', 'diet', 'kitchen', 'style', 'pantry'];
  let i = 0;
  const el = document.createElement('div');
  el.className = 'ob';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', edit ? 'Edit preferences' : 'Set up Larder');
  document.getElementById('scan-root').append(el);
  const entry = pushOverlay(() => el.remove());

  const opt = (pressed, attrs, e, label, hint) => html`<button type="button" class="opt" aria-pressed="${String(!!pressed)}" ${attrs}>${e ? html`<span class="e">${e}</span>` : ''}<span>${label}${hint ? html`<small>${hint}</small>` : ''}</span></button>`;

  function body(step) {
    const region = draft.region;
    switch (step) {
      case 'welcome':
        return html`<div class="ob-hero">🧺</div>
          <h1 style="text-align:center">Dinner, sorted for the week</h1>
          <p class="lead" style="text-align:center">Answer a few quick questions and Larder plans your dinners, works to your budget and builds one tidy shopping list by aisle.</p>
          <div class="callout callout--sage">${icon('leaf')}<div>Plans reuse ingredients across the week and start with what you already have, so less food goes in the bin.</div></div>`;
      case 'shop':
        return html`<h1>Where do you shop?</h1><p class="lead">We use it to estimate prices and sort your list in a typical aisle order.</p>
          <div class="seg seg-block" data-group="region">${Object.values(REGIONS).map((r) => html`<button type="button" data-val="${r.id}" aria-pressed="${String(region === r.id)}">${r.id === 'uk' ? '🇬🇧' : '🇺🇸'} ${r.label}</button>`)}</div>
          <div class="q-label">Supermarket</div>
          <div class="opt-grid" data-group="store">${STORES[region].map((s) => opt(draft.store === s.id, raw(`data-val="${s.id}"`), '', s.name, s.index < 0.9 ? 'Budget prices' : s.index > 1.15 ? 'Premium' : ''))}</div>`;
      case 'household':
        return html`<h1>Who are you cooking for?</h1><p class="lead">Portions and the shopping list scale to your household.</p>
          <div class="big-number"><button type="button" data-act="people-" aria-label="Fewer people">${icon('minus', 'i-lg')}</button><b>${draft.people}</b><button type="button" data-act="people+" aria-label="More people">${icon('plus', 'i-lg')}</button></div>
          <p class="muted" style="text-align:center;margin-top:-8px">${draft.people === 1 ? 'Just me' : `${draft.people} people`}</p>
          <div class="q-label">Which nights should we plan?</div>
          <div class="day-toggles" data-group="days">${DAY_SHORT.map((d, n) => html`<button type="button" data-val="${n}" aria-pressed="${String(draft.days.includes(n))}">${d}</button>`)}</div>
          <p class="hint" style="margin-top:8px">${plural(draft.days.length, 'dinner')} a week. You can cook just the ones you want.</p>`;
      case 'budget': {
        const max = region === 'us' ? 250 : 200;
        return html`<h1>What’s your weekly budget?</h1><p class="lead">For the dinners on your plan. Larder picks recipes and shares ingredients to stay under it.</p>
          <div class="big-number"><b>${draft.budget ? `${currencySymbol(region)}${draft.budget}` : 'Any'}</b></div>
          <input class="range" type="range" min="15" max="${max}" step="5" value="${draft.budget || 60}" data-el="budget" aria-label="Weekly budget" ${!draft.budget ? 'disabled' : ''}>
          <div class="range-labels"><span>${currencySymbol(region)}15</span><span>${currencySymbol(region)}${max}</span></div>
          <label class="check-row" style="border:0;margin-top:12px"><input type="checkbox" data-el="nobudget" ${!draft.budget ? 'checked' : ''}><span>No budget, just plan great dinners</span></label>
          ${draft.budget ? html`<p class="hint">About ${fmtMoney(draft.budget / Math.max(1, draft.days.length) / draft.people, region)} per serving.</p>` : ''}`;
      }
      case 'diet':
        return html`<h1>Any dietary needs?</h1><p class="lead">Pick all that apply. Every meal on your plan follows all of them.</p>
          <div class="opt-grid" data-group="diets">${DIETS.map((d) => opt(draft.diets.includes(d.id), raw(`data-val="${d.id}"`), DIET_EMOJI[d.id], d.label))}</div>
          <div class="q-label">Allergies or ingredients to avoid</div>
          <div class="chip-row" style="flex-wrap:wrap" data-group="allergens">${ALLERGENS.map((a) => html`<button type="button" class="chip ${draft.allergens.includes(a.id) ? 'is-on' : ''}" data-val="${a.id}">${a.label}</button>`)}</div>
          <p class="hint" style="margin-top:10px">Allergen info comes from typical products. Always check labels, as brands vary.</p>`;
      case 'kitchen':
        return html`<h1>What’s in your kitchen?</h1><p class="lead">Recipes adapt to your kit, with air fryer or microwave alternatives where they work.</p>
          <div class="opt-grid" data-group="equipment">${EQUIPMENT.map((e) => opt(draft.equipment.includes(e.id), raw(`data-val="${e.id}"`), KIT_EMOJI[e.id], region === 'us' && e.us ? e.us : e.label))}</div>
          <div class="q-label">How much effort on a weeknight?</div>
          <div class="opt-grid one" data-group="effort">${EFFORT.map((e) => opt(draft.effort === e.id, raw(`data-val="${e.id}"`), e.e, e.label, e.hint))}</div>`;
      case 'style':
        return html`<h1>What sounds good?</h1><p class="lead">Pick a few styles and we’ll lean your plan towards them.</p>
          <div class="opt-grid" data-group="vibes">${VIBES.map((v) => opt(draft.vibes.includes(v.id), raw(`data-val="${v.id}"`), v.emoji, v.label, v.hint))}</div>
          <div class="q-label">Calorie target per dinner</div>
          <div class="chip-row" style="flex-wrap:wrap" data-group="kcal">${[null, 400, 500, 600, 700].map((k) => html`<button type="button" class="chip ${draft.kcal === k ? 'is-on' : ''}" data-val="${k ?? ''}">${k ? `~${k} kcal` : 'No target'}</button>`)}</div>`;
      case 'pantry':
        return html`<h1>Anything already in?</h1><p class="lead">Tap what you have. Larder plans around it and leaves it off your list.</p>
          <div class="quick-add" data-group="pantry">${PANTRY_QUICK.map((k) => html`<button type="button" class="chip ${pantryPicks.has(k) ? 'is-on' : ''}" data-val="${k}">${pantryPicks.has(k) ? icon('check', 'i-sm') : ''}${INGREDIENTS[k].name.replace(/ \(.*\)$/, '')}</button>`)}</div>
          <p class="hint" style="margin-top:12px">You can add more any time from the Pantry tab, or scan your fridge with AI.</p>`;
      case 'generating':
        return html`<div class="generating"><div class="pot">🍲</div><h1>Planning your week…</h1><p class="muted">Matching ${plural(candidates(draft).length, 'recipe')} to your tastes and budget.</p></div>`;
      default: return '';
    }
  }

  function render() {
    const step = steps[i] || 'generating';
    const pct = Math.round((i / steps.length) * 100);
    setHTML(el, html`
      <div class="ob-top">
        ${i > 0 && step !== 'generating' ? html`<button class="icon-btn filled" data-act="back" aria-label="Back">${icon('chevron-left')}</button>` : html`<span style="width:40px"></span>`}
        <div class="ob-progress" aria-hidden="true"><i style="width:${pct}%"></i></div>
        ${edit ? html`<button class="icon-btn filled" data-act="close" aria-label="Close">${icon('x')}</button>` : step !== 'generating' && step !== 'welcome' ? html`<button class="btn btn-ghost btn-sm" data-act="skip">Skip</button>` : html`<span style="width:40px"></span>`}
      </div>
      <div class="ob-body">${body(step)}</div>
      ${step === 'generating' ? '' : html`<div class="ob-foot">
        ${step === 'welcome' ? html`<button class="btn btn-secondary btn-lg" data-act="explore">Look around first</button>` : ''}
        <button class="btn btn-primary btn-lg" data-act="next" ${valid(step) ? '' : 'disabled'}>${step === 'welcome' ? 'Get started' : i === steps.length - 1 ? (edit ? 'Save preferences' : 'Plan my week') : 'Continue'}</button>
      </div>`}`);
    el.querySelector('.ob-body').scrollTop = 0;
  }
  const valid = (step) => (step === 'household' ? draft.days.length > 0 : true);

  async function finish() {
    if (edit) {
      setProfile(draft);
      await closeOverlay(entry);
      toast('Preferences saved');
      onDone?.(draft);
      return;
    }
    i = steps.length;
    render();
    completeOnboarding(draft);
    for (const k of pantryPicks) if (!state.pantry[k]) addPantry(k);
    const week = thisWeek();
    if (!getPlan(week)?.slots?.length) {
      await new Promise((r) => setTimeout(r, 900));
      const res = generateWeek({ weekKey: week });
      savePlan(week, res.slots);
    }
    await closeOverlay(entry);
    onDone?.(draft);
  }

  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const group = b.closest('[data-group]')?.dataset.group;
    if (group && b.dataset.val != null) {
      const v = b.dataset.val;
      if (group === 'region') { draft.region = v; draft.store = STORES[v][0].id; draft.budget = draft.budget ? (v === 'us' ? 70 : 50) : null; }
      else if (group === 'store' || group === 'effort') draft[group] = v;
      else if (group === 'days') { const d = +v; draft.days = draft.days.includes(d) ? draft.days.filter((x) => x !== d) : [...draft.days, d].sort(); }
      else if (group === 'kcal') draft.kcal = v ? +v : null;
      else if (group === 'pantry') { if (pantryPicks.has(v)) pantryPicks.delete(v); else pantryPicks.add(v); }
      else {
        const list = draft[group];
        draft[group] = list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
        if (group === 'diets' && v === 'vegan' && draft.diets.includes('vegan') && !draft.diets.includes('vegetarian')) draft.diets.push('vegetarian');
      }
      render();
      return;
    }
    switch (b.dataset.act) {
      case 'next': if (i >= steps.length - 1) finish(); else { i++; render(); } break;
      case 'back': i = Math.max(0, i - 1); render(); break;
      case 'skip': case 'explore': finish(); break;
      case 'close': closeOverlay(entry); break;
      case 'people-': draft.people = Math.max(1, draft.people - 1); render(); break;
      case 'people+': draft.people = Math.min(12, draft.people + 1); render(); break;
      default: break;
    }
  });
  el.addEventListener('input', (e) => {
    if (e.target.dataset.el === 'budget') {
      draft.budget = +e.target.value;
      el.querySelector('.big-number b').textContent = `${currencySymbol(draft.region)}${draft.budget}`;
    }
  });
  el.addEventListener('change', (e) => {
    if (e.target.dataset.el === 'budget') render();
    if (e.target.dataset.el === 'nobudget') { draft.budget = e.target.checked ? null : (draft.region === 'us' ? 70 : 50); render(); }
  });
  render();
}
