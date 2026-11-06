// Shopping tab: one merged list for the week, grouped by aisle, with tick-off
// progress, pantry items set aside, extras, a lock, and copy/share as text.
import { state, on, thisWeek, shiftWeek, getPlan, toggleChecked, clearChecked, addExtra, removeExtra, lockList, setProfile } from '../store.js';
import { STORES } from '../data/stores.js';
import { buildList, listAsText } from '../shopping.js';
import { html, setHTML, plural } from '../utils.js';
import { icon, actionSheet, toast, emptyArt } from '../ui.js';
import { fmtMoney } from '../units.js';
import { goTab } from '../router.js';

let root;
let visible = false;
let dirty = true;
let week = thisWeek();

export const shopView = {
  init,
  show() { visible = true; if (dirty) render(); },
  hide() { visible = false; },
  reselect() { root.scrollTo({ top: 0, behavior: 'smooth' }); },
};

function init(el) {
  root = el;
  root.addEventListener('click', onClick);
  root.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = e.target.querySelector('input');
    const v = input.value.trim();
    if (!v) return;
    addExtra(week, v);
    input.value = '';
    requestAnimationFrame(() => root.querySelector('[data-el="extra"]')?.focus());
  });
  on((kind) => {
    if (['data', 'plan', 'list', 'profile', 'pantry'].includes(kind)) { dirty = true; if (visible) render(); }
  });
}

function currentList(plan) {
  const live = buildList(plan);
  const locked = plan?.list?.locked;
  if (!locked) return { list: live, locked: null, stale: false };
  return { list: { ...live, sections: locked.items.sections, pantryItems: locked.items.pantryItems, total: locked.items.total, count: locked.items.count }, locked, stale: locked.planUpdatedAt !== plan.updatedAt };
}

function render() {
  dirty = false;
  const p = state.profile;
  const now = thisWeek();
  const next = shiftWeek(now, 1);
  const hasNext = !!getPlan(next)?.slots?.length;
  const plan = getPlan(week);
  const head = html`<header class="view-head">
      <h1>Shopping</h1>
      <div class="head-actions">
        <button class="icon-btn" data-act="share" aria-label="Copy or share list" title="Copy or share">${icon('share')}</button>
        <button class="icon-btn" data-act="more" aria-label="List options" title="Options">${icon('more')}</button>
      </div>
    </header>`;
  const weekChips = hasNext || week !== now ? html`<div class="seg seg-block" style="margin-bottom:12px">
      <button type="button" data-act="week" data-week="${now}" aria-pressed="${String(week === now)}">This week</button>
      <button type="button" data-act="week" data-week="${next}" aria-pressed="${String(week === next)}">Next week</button>
    </div>` : '';

  if (!plan?.slots?.length || !plan.slots.some((s) => s.status !== 'skipped')) {
    setHTML(root, html`${head}<div class="view-body">${weekChips}
      <div class="empty">${emptyArt()}<h2>No list yet</h2><p>Plan your week and every ingredient lands here, merged and sorted by aisle.</p>
      <div class="actions"><button class="btn btn-primary" data-act="plan">${icon('calendar')} Go to plan</button></div></div>
      ${extrasBlock(plan)}</div>`);
    return;
  }

  const { list, locked, stale } = currentList(plan);
  const checked = plan.list?.checked || {};
  const extras = plan.list?.extras || [];
  const all = [...list.sections.flatMap((s) => s.items.map((i) => i.key)), ...extras.map((e) => e.id)];
  const done = all.filter((k) => checked[k]).length;
  const pct = all.length ? Math.round((done / all.length) * 100) : 0;

  setHTML(root, html`${head}<div class="view-body">
    ${weekChips}
    <div class="card shop-summary">
      <div class="ring" style="--p:${pct}"><span>${pct}%</span></div>
      <div class="row-main">
        <div class="row-title">${plural(list.count + extras.length, 'item')} · ${fmtMoney(list.total, p.region)}</div>
        <div class="row-sub">Estimated at ${list.store.name} · ${done} ticked off</div>
      </div>
      <button class="chip" data-act="store">${icon('store')} ${list.store.name}</button>
    </div>
    ${locked ? html`<div class="callout ${stale ? 'callout--warn' : 'callout--sage'}" style="margin-top:10px">${icon('lock')}<div>
        ${stale ? html`<strong>Your menu changed since you locked this list.</strong> It still shows the locked version.<div class="row-flex" style="margin-top:8px"><button class="btn btn-secondary btn-sm" data-act="relock">Update list</button><button class="btn btn-ghost btn-sm" data-act="unlock">Unlock</button></div>`
          : html`<strong>List locked.</strong> Menu changes won’t alter it until you unlock. <button class="link-btn" data-act="unlock">Unlock</button>`}
      </div></div>` : ''}

    ${list.sections.map((s) => html`
      <div class="aisle-head"><h3>${s.label}</h3><span>${s.items.filter((i) => checked[i.key]).length}/${s.items.length}</span></div>
      <div class="shop-group">${s.items.map((it) => html`
        <button type="button" class="shop-item ${checked[it.key] ? 'is-checked' : ''}" data-check="${it.key}" aria-pressed="${String(!!checked[it.key])}">
          <span class="check">${icon('check')}</span>
          <div class="row-main">
            <div class="row-title">${it.name}</div>
            <div class="row-sub">${it.amount}${it.packLabel ? ` · buy ${it.packLabel}` : ''}</div>
            <div class="uses">${it.uses.map((u) => u.dayLabel).join(', ')}: ${[...new Set(it.uses.map((u) => u.name))].join(', ')}</div>
          </div>
          <span class="price">${fmtMoney(it.price, p.region)}</span>
        </button>`)}
      </div>`)}

    ${extrasBlock(plan, checked)}

    ${list.pantryItems.length ? html`<details class="table-view" style="margin-top:18px"><summary>${icon('fridge', 'i-sm')} Already in your pantry (${list.pantryItems.length})</summary>
      <div class="list-plain" style="margin-top:6px">${list.pantryItems.map((it) => html`<div class="row"><div class="row-main"><div class="row-title">${it.name}</div><div class="row-sub">Need ${it.amount}. Check you have enough</div></div></div>`)}</div>
    </details>` : ''}
    <p class="hint" style="margin:16px 4px 0">Prices are estimates for a typical ${list.store.name} shop and will vary. Cupboard staples are costed by how much you use.</p>
  </div>`);
}

function extrasBlock(plan, checked = plan?.list?.checked || {}) {
  const extras = plan?.list?.extras || [];
  return html`<div class="aisle-head"><h3>Extras</h3><span>${extras.length ? `${extras.filter((e) => checked[e.id]).length}/${extras.length}` : ''}</span></div>
    ${extras.length ? html`<div class="shop-group">${extras.map((e) => html`
      <div class="shop-item ${checked[e.id] ? 'is-checked' : ''}" style="padding-right:4px">
        <button type="button" class="row-hit" data-check="${e.id}" aria-pressed="${String(!!checked[e.id])}"><span class="check">${icon('check')}</span><div class="row-main"><div class="row-title">${e.name}</div></div></button>
        <button type="button" class="icon-btn" data-remove="${e.id}" aria-label="Remove ${e.name}">${icon('x')}</button>
      </div>`)}</div>` : ''}
    <form class="add-row" autocomplete="off"><input class="input" data-el="extra" placeholder="Add milk, bin bags, snacks…" maxlength="80" aria-label="Add an item"><button class="btn btn-secondary" type="submit">${icon('plus')} Add</button></form>`;
}

// Plain text so the list moves easily into Notes, Reminders, WhatsApp, etc.
async function exportList(plan, { share }) {
  const { list } = currentList(plan);
  const text = listAsText(list, plan.list?.extras || [], plan.list?.checked || {}, { title: 'Shopping list' });
  if (share && navigator.share) {
    try { await navigator.share({ title: 'Shopping list', text }); return; } catch (err) { if (err?.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('List copied. Paste it into any notes or list app', { iconName: 'copy' });
  } catch {
    toast('Couldn’t copy the list on this device.', { tone: 'error' });
  }
}

async function onClick(e) {
  const c = e.target.closest('[data-check]');
  if (c) { toggleChecked(week, c.dataset.check); return; }
  const rm = e.target.closest('[data-remove]');
  if (rm) { removeExtra(week, rm.dataset.remove); return; }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const plan = getPlan(week);
  switch (b.dataset.act) {
    case 'plan': goTab('plan'); break;
    case 'week': week = b.dataset.week; render(); break;
    case 'store': {
      const p = state.profile;
      const choice = await actionSheet({ title: 'Where are you shopping?', subtitle: 'Changes prices and aisle order', actions: STORES[p.region].map((s) => ({ value: s.id, label: s.name, checked: s.id === p.store, icon: 'store' })) });
      if (choice) setProfile({ store: choice.value });
      break;
    }
    case 'share': if (plan) exportList(plan, { share: matchMedia('(pointer: coarse)').matches }); break;
    case 'more': {
      const locked = !!plan?.list?.locked;
      const choice = await actionSheet({
        title: 'Shopping list',
        actions: [
          { value: 'lock', label: locked ? 'Unlock list' : 'Lock list', sub: locked ? 'Follow menu changes again' : 'Freeze it so menu edits don’t change it', icon: locked ? 'unlock' : 'lock' },
          { value: 'clear', label: 'Untick everything', icon: 'refresh' },
          { value: 'copy', label: 'Copy as text', icon: 'copy' },
        ],
      });
      if (choice?.value === 'lock') { if (locked) lockList(week, null); else lockList(week, buildList(plan)); toast(locked ? 'List unlocked' : 'List locked', { iconName: 'lock' }); }
      if (choice?.value === 'clear') clearChecked(week);
      if (choice?.value === 'copy' && plan) exportList(plan, { share: false });
      break;
    }
    case 'relock': lockList(week, buildList(plan)); toast('List updated and locked', { iconName: 'lock' }); break;
    case 'unlock': lockList(week, null); break;
    default: break;
  }
}
