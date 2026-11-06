// Plan tab: the week's dinners with a budget meter, swap / lock / cooked /
// skip per night, regenerate (keeping locked and cooked meals) and week nav.
import { state, on, thisWeek, shiftWeek, dayDate, getPlan, savePlan, updateSlot, removeSlot, getRecipe, setDisliked } from '../store.js';
import { generateWeek, weekCost } from '../planner.js';
import { html, setHTML, plural, avg } from '../utils.js';
import { icon, actionSheet, toast, confirmDialog, emptyArt } from '../ui.js';
import { fmtMoney } from '../units.js';
import { tile, metaLine, DAY_NAMES, DAY_SHORT } from './common.js';
import { openRecipe } from './recipe.js';
import { openSwap, openAIChef } from './swap.js';
import { openSettings } from './settings.js';
import { goTab } from '../router.js';

let root;
let visible = false;
let dirty = true;
let week = thisWeek();
let notes = [];

export const planView = {
  init,
  show() { visible = true; if (dirty) render(); },
  hide() { visible = false; },
  reselect() { week = thisWeek(); render(); root.scrollTo({ top: 0, behavior: 'smooth' }); },
};

function init(el) {
  root = el;
  root.addEventListener('click', onClick);
  on((kind) => {
    if (['data', 'plan', 'profile', 'pantry', 'recipes'].includes(kind)) { dirty = true; if (visible) render(); }
  });
}

function weekLabel(key) {
  const a = dayDate(key, 0), b = dayDate(key, 6);
  const df = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
  const range = df.formatRange ? df.formatRange(a, b) : `${df.format(a)} – ${df.format(b)}`;
  const now = thisWeek();
  const rel = key === now ? 'This week' : key === shiftWeek(now, 1) ? 'Next week' : key === shiftWeek(now, -1) ? 'Last week' : '';
  return { range, rel };
}

function render() {
  dirty = false;
  const p = state.profile;
  const plan = getPlan(week);
  const slots = plan?.slots || [];
  const { range, rel } = weekLabel(week);
  const isCurrent = week === thisWeek();
  const todayIdx = (new Date().getDay() + 6) % 7;
  const nights = [...new Set([...p.days, ...slots.map((s) => s.day)])].sort((a, b) => a - b);
  const active = slots.filter((s) => s.status !== 'skipped');
  const cost = weekCost(slots);
  const kcal = avg(active.map((s) => getRecipe(s.recipeId)?.n?.kcal).filter(Boolean));
  const servings = active.reduce((n, s) => n + s.servings, 0);
  const over = p.budget && cost > p.budget;
  const cooked = slots.filter((s) => s.status === 'cooked').length;

  setHTML(root, html`
    <header class="view-head">
      <h1>${rel || 'Your plan'}</h1>
      <div class="head-actions">
        <button class="icon-btn" data-act="ai" aria-label="AI chef" title="AI chef">${icon('sparkles')}</button>
        <button class="icon-btn" data-act="settings" aria-label="Settings" title="Settings">${icon('settings')}</button>
      </div>
    </header>
    <div class="view-body">
      <div class="week-nav">
        <button class="icon-btn filled" data-act="prev" aria-label="Previous week">${icon('chevron-left')}</button>
        <div class="label">${range}<small>${plural(p.people, 'person', 'people')} · ${plural(p.days.length, 'dinner')}</small></div>
        <button class="icon-btn filled" data-act="next" aria-label="Next week" ${week >= shiftWeek(thisWeek(), 4) ? 'disabled' : ''}>${icon('chevron-right')}</button>
      </div>

      ${!slots.length ? html`
        <div class="card card-pad" style="text-align:center;padding:26px 18px">
          ${emptyArt()}
          <h2 style="font-size:22px;margin-top:4px">${rel === 'This week' ? 'Let’s plan this week' : `Plan ${range}`}</h2>
          <p class="muted" style="margin:6px auto 18px;max-width:34ch">${plural(p.days.length, 'dinner')} for ${plural(p.people, 'person', 'people')}${p.budget ? `, under ${fmtMoney(p.budget, p.region, { round: true })}` : ''}. Takes a second, and you can swap anything.</p>
          <button class="btn btn-primary btn-lg" data-act="generate">${icon('sparkles')} Plan my week</button>
          <div class="row-flex" style="justify-content:center;margin-top:10px;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" data-act="prefs">${icon('settings')} Preferences</button>
            <button class="btn btn-ghost btn-sm" data-act="pick-own">${icon('book')} Pick recipes myself</button>
          </div>
        </div>` : html`
        <div class="card summary-card">
          <div>
            <div class="meter-row"><span>Estimated shop</span><span><b>${fmtMoney(cost, p.region)}</b>${p.budget ? ` of ${fmtMoney(p.budget, p.region, { round: true })}` : ''}</span></div>
            ${p.budget ? html`<div class="meter ${over ? 'over' : ''}" role="meter" aria-valuemin="0" aria-valuemax="${p.budget}" aria-valuenow="${cost.toFixed(2)}" aria-label="Spend against budget"><i style="width:${Math.min(100, (cost / p.budget) * 100).toFixed(1)}%"></i></div>` : ''}
          </div>
          <div class="summary-stats">
            <div><b>${active.length}</b><span>${active.length === 1 ? 'dinner' : 'dinners'}</span></div>
            <div><b>${kcal ? Math.round(kcal) : '–'}</b><span>avg kcal</span></div>
            <div><b>${servings ? fmtMoney(cost / servings, p.region) : '–'}</b><span>per serving</span></div>
          </div>
        </div>
        ${over ? html`<div class="callout callout--warn" style="margin-top:10px">${icon('wallet')}<div>About ${fmtMoney(cost - p.budget, p.region)} over budget. Swap a meal (suggestions show savings) or skip a night.</div></div>` : ''}
        ${notes.map((n) => html`<div class="callout" style="margin-top:10px">${icon('info')}<div>${n}</div></div>`)}
        ${cooked ? html`<p class="hint" style="margin:10px 4px 0">${icon('check-circle', 'i-sm')} ${cooked} of ${active.length} cooked this week</p>` : ''}
      `}

      ${slots.length ? html`<div class="days">${nights.map((d) => dayCard(d, slots.find((s) => s.day === d), isCurrent && d === todayIdx))}</div>
        <div class="plan-actions">
          <button class="btn btn-secondary" data-act="regenerate">${icon('refresh')} New plan</button>
          <button class="btn btn-primary" data-act="shop">${icon('cart')} Shopping list</button>
        </div>
        <button class="btn btn-ghost btn-block" style="margin-top:6px" data-act="add-night">${icon('plus')} Add another night</button>` : ''}
    </div>`);
}

function dayCard(d, slot, isToday) {
  const date = dayDate(week, d).getDate();
  const label = html`<div class="day-label ${isToday ? 'is-today' : ''}"><b>${DAY_SHORT[d]}</b><span>${date}</span></div>`;
  if (!slot) {
    return html`<div class="day-card">${label}<button class="day-empty" data-act="fill" data-day="${d}"><span class="tile-emoji sm">＋</span>Add a dinner</button></div>`;
  }
  const r = getRecipe(slot.recipeId);
  if (!r) return html`<div class="day-card">${label}<button class="day-empty" data-act="fill" data-day="${d}">Recipe missing. Tap to choose another.</button></div>`;
  const cls = slot.status === 'cooked' ? 'is-cooked' : slot.status === 'skipped' ? 'is-skipped' : '';
  return html`<div class="day-card ${cls}">
    ${label}
    <button class="day-main" data-act="open" data-day="${d}" aria-label="${DAY_NAMES[d]}: ${r.name}">
      ${tile(r, 'sm')}
      <div class="row-main">
        <div class="row-title">${r.name}</div>
        ${slot.status === 'skipped' ? html`<div class="meta-line"><span>Skipped. Not on your list</span></div>` : metaLine(r)}
        ${slot.status === 'cooked' ? html`<span class="status-pill">${icon('check')} Cooked</span>` : ''}
        ${slot.locked && slot.status !== 'cooked' ? html`<span class="status-pill lock">${icon('lock')} Locked</span>` : ''}
        ${slot.servings !== state.profile.people ? html`<span class="status-pill lock">${icon('users')} ${slot.servings}</span>` : ''}
      </div>
    </button>
    <div class="day-actions">
      <button class="icon-btn" data-act="swap" data-day="${d}" aria-label="Swap ${DAY_NAMES[d]}" title="Swap" ${slot.status === 'cooked' ? 'disabled' : ''}>${icon('shuffle')}</button>
      <button class="icon-btn" data-act="more" data-day="${d}" aria-label="More options for ${DAY_NAMES[d]}" title="More">${icon('more')}</button>
    </div>
  </div>`;
}

function generate({ keepAll = false } = {}) {
  const plan = getPlan(week);
  const keep = (plan?.slots || []).filter((s) => keepAll || s.locked || s.status === 'cooked');
  const res = generateWeek({ weekKey: week, keep });
  savePlan(week, res.slots);
  notes = res.notes.filter((n) => !/over budget/.test(n));
  return res;
}

async function onClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const d = b.dataset.day != null ? +b.dataset.day : null;
  const plan = getPlan(week);
  const slot = d != null ? plan?.slots.find((s) => s.day === d) : null;
  switch (b.dataset.act) {
    case 'prev': week = shiftWeek(week, -1); notes = []; render(); break;
    case 'next': week = shiftWeek(week, 1); notes = []; render(); break;
    case 'settings': openSettings(); break;
    case 'prefs': openSettings({ focus: 'prefs' }); break;
    case 'ai': openAIChef({ weekKey: week }); break;
    case 'generate': {
      const res = generate();
      toast(`${plural(res.slots.length, 'dinner')} planned`, { iconName: 'sparkles' });
      break;
    }
    case 'regenerate': {
      const kept = (plan?.slots || []).filter((s) => s.locked || s.status === 'cooked').length;
      const ok = await confirmDialog({
        title: 'Make a new plan?',
        message: kept ? `Locked and cooked meals (${kept}) stay put. Everything else is replaced.` : 'Every dinner this week will be replaced. Lock any you want to keep first.',
        confirmText: 'New plan',
      });
      if (ok) { generate(); toast('Fresh plan ready', { iconName: 'refresh' }); }
      break;
    }
    case 'pick-own': goTab('recipes'); toast('Tap a recipe, then “Add to plan”.', { iconName: 'book' }); break;
    case 'shop': goTab('shop'); break;
    case 'open': if (slot) openRecipe(slot.recipeId, { weekKey: week, day: d, servings: slot.servings }); break;
    case 'swap': case 'fill': openSwap(week, d); break;
    case 'add-night': {
      const free = [0, 1, 2, 3, 4, 5, 6].filter((x) => !plan?.slots.some((s) => s.day === x));
      if (!free.length) { toast('Every night already has a dinner.'); break; }
      const choice = await actionSheet({ title: 'Add a night', actions: free.map((x) => ({ value: x, label: DAY_NAMES[x], icon: 'calendar' })) });
      if (choice) openSwap(week, choice.value);
      break;
    }
    case 'more': {
      if (!slot) break;
      const r = getRecipe(slot.recipeId);
      const choice = await actionSheet({
        title: `${DAY_NAMES[d]} · ${r?.name || ''}`,
        actions: [
          { value: 'cooked', label: slot.status === 'cooked' ? 'Mark as not cooked' : 'Mark as cooked', icon: 'check-circle' },
          { value: 'lock', label: slot.locked ? 'Unlock' : 'Lock this meal', sub: 'Locked meals survive a new plan', icon: slot.locked ? 'unlock' : 'lock' },
          { value: 'skip', label: slot.status === 'skipped' ? 'Cook this after all' : 'Skip this night', sub: 'Skipped meals leave the shopping list', icon: 'skip' },
          { value: 'servings', label: `Servings: ${slot.servings}`, sub: 'Cooking for more or fewer?', icon: 'users' },
          { value: 'never', label: 'Never suggest this again', icon: 'thumbs-down' },
          { value: 'remove', label: 'Remove from plan', icon: 'trash', danger: true },
        ],
      });
      if (!choice) break;
      if (choice.value === 'cooked') updateSlot(week, d, { status: slot.status === 'cooked' ? 'planned' : 'cooked' });
      if (choice.value === 'lock') { updateSlot(week, d, { locked: !slot.locked }); toast(slot.locked ? 'Unlocked' : 'Locked. It stays when you make a new plan', { iconName: 'lock' }); }
      if (choice.value === 'skip') updateSlot(week, d, { status: slot.status === 'skipped' ? 'planned' : 'skipped' });
      if (choice.value === 'servings') {
        const n = await actionSheet({ title: 'Servings', actions: [1, 2, 3, 4, 5, 6, 8].map((x) => ({ value: x, label: plural(x, 'serving'), checked: x === slot.servings })) });
        if (n) updateSlot(week, d, { servings: n.value });
      }
      if (choice.value === 'never') { setDisliked(slot.recipeId, true); openSwap(week, d); }
      if (choice.value === 'remove') {
        const prev = { ...slot };
        removeSlot(week, d);
        toast('Removed from plan', { action: 'Undo', onAction: () => savePlan(week, [...getPlan(week).slots, prev].sort((a, b) => a.day - b.day)) });
      }
      break;
    }
    default: break;
  }
}
