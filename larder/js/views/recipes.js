// Recipes tab: browse and search the library by style and cuisine, with
// favourites and your own imported / AI recipes.
import { state, on, allRecipes } from '../store.js';
import { VIBES } from '../data/ingredients.js';
import { suitability, vibesOf } from '../planner.js';
import { html, setHTML, debounce, plural } from '../utils.js';
import { icon } from '../ui.js';
import { tile, metaLine, heartIcon } from './common.js';
import { openRecipe } from './recipe.js';
import { openAIChef } from './swap.js';
import { openImportRecipe } from './ai-flows.js';

let root;
let visible = false;
let dirty = true;
const f = { scope: 'foryou', vibe: null, cuisine: null, q: '' };

export const recipesView = {
  init,
  show() { visible = true; if (dirty) renderAll(); },
  hide() { visible = false; },
  reselect() { root.scrollTo({ top: 0, behavior: 'smooth' }); },
};

function init(el) {
  root = el;
  setHTML(root, html`
    <header class="view-head">
      <h1>Recipes</h1>
      <div class="head-actions">
        <button class="icon-btn" data-act="import" aria-label="Import a recipe" title="Import a recipe">${icon('upload')}</button>
        <button class="btn btn-primary btn-sm" data-act="ai">${icon('sparkles')} AI chef</button>
      </div>
    </header>
    <div class="view-body">
      <div class="searchbar" role="search">${icon('search')}<input type="search" data-el="q" placeholder="Search dishes, cuisines, ingredients" autocomplete="off" aria-label="Search recipes"></div>
      <div data-el="filters" style="margin-top:10px;display:grid;gap:8px"></div>
      <div data-el="grid" aria-live="polite"></div>
    </div>`);
  root.querySelector('[data-el="q"]').addEventListener('input', debounce((e) => { f.q = e.target.value; renderGrid(); }, 150));
  root.addEventListener('click', onClick);
  on((kind) => {
    if (['data', 'recipes', 'favorites', 'profile'].includes(kind)) { dirty = true; if (visible) renderAll(); }
  });
}

function renderAll() {
  dirty = false;
  renderFilters();
  renderGrid();
}

function renderFilters() {
  const cuisines = [...new Set(allRecipes().map((r) => r.cuisine))].sort();
  const mine = state.customRecipes.length;
  setHTML(root.querySelector('[data-el="filters"]'), html`
    <div class="seg seg-block">
      ${[['foryou', 'For you'], ['all', 'All'], ['favs', 'Favourites'], ...(mine ? [['mine', 'Mine']] : [])].map(([id, label]) => html`<button type="button" data-scope="${id}" aria-pressed="${String(f.scope === id)}">${label}</button>`)}
    </div>
    <div class="chip-row">${VIBES.map((v) => html`<button type="button" class="chip ${f.vibe === v.id ? 'is-on' : ''}" data-vibe="${v.id}">${v.emoji} ${v.label}</button>`)}</div>
    <div class="chip-row">${cuisines.map((c) => html`<button type="button" class="chip ${f.cuisine === c ? 'is-on' : ''}" data-cuisine="${c}">${c}</button>`)}</div>`);
}

function renderGrid() {
  const ql = f.q.trim().toLowerCase();
  const list = allRecipes().filter((r) => {
    if (f.scope === 'foryou' && (!suitability(r).ok || state.disliked.includes(r.id))) return false;
    if (f.scope === 'favs' && !state.favorites.includes(r.id)) return false;
    if (f.scope === 'mine' && !r.source) return false;
    if (f.vibe && !vibesOf(r).has(f.vibe)) return false;
    if (f.cuisine && r.cuisine !== f.cuisine) return false;
    if (ql) {
      const hay = `${r.name} ${r.cuisine} ${r.blurb || ''} ${r.ing.map(([k]) => k.replace(/^x:/, '')).join(' ')}`.toLowerCase();
      if (!ql.split(/\s+/).every((t) => hay.includes(t))) return false;
    }
    return true;
  });
  const grid = root.querySelector('[data-el="grid"]');
  if (!list.length) {
    setHTML(grid, html`<div class="empty"><div style="font-size:48px">${f.scope === 'favs' ? '💛' : '🔍'}</div>
      <h2>${f.scope === 'favs' ? 'No favourites yet' : 'Nothing matches'}</h2>
      <p>${f.scope === 'favs' ? 'Tap the heart on any recipe to save it here.' : f.scope === 'foryou' ? 'Try “All” to include recipes outside your preferences, or ask the AI chef.' : 'Try a different search or filter.'}</p>
      <div class="actions"><button class="btn btn-secondary" data-act="ai">${icon('sparkles')} Ask the AI chef</button></div></div>`);
    return;
  }
  setHTML(grid, html`<div class="group-head" style="margin:14px 4px 8px"><h3>${plural(list.length, 'recipe')}</h3><span>${f.scope === 'foryou' ? 'matching your preferences' : ''}</span></div>
    <div class="rgrid">${list.map((r) => {
      const fit = f.scope === 'foryou' ? { ok: true } : suitability(r);
      return html`<button type="button" class="rcard ${fit.ok ? '' : 'is-unsuitable'}" data-open="${r.id}" aria-label="${r.name}">
        ${tile(r)}
        ${state.favorites.includes(r.id) ? html`<span class="fav" aria-label="Favourite">${heartIcon(true)}</span>` : ''}
        <div class="row-title">${r.name}</div>
        ${metaLine(r, { cost: false })}
        ${r.source ? html`<span class="badge badge--accent" style="justify-self:start">${icon('sparkles')} ${r.source === 'import' ? 'Imported' : 'AI'}</span>` : ''}
      </button>`;
    })}</div>`);
}

function onClick(e) {
  const open = e.target.closest('[data-open]');
  if (open) { openRecipe(open.dataset.open); return; }
  const sc = e.target.closest('[data-scope]');
  if (sc) { f.scope = sc.dataset.scope; renderAll(); return; }
  const v = e.target.closest('[data-vibe]');
  if (v) { f.vibe = f.vibe === v.dataset.vibe ? null : v.dataset.vibe; renderAll(); return; }
  const c = e.target.closest('[data-cuisine]');
  if (c) { f.cuisine = f.cuisine === c.dataset.cuisine ? null : c.dataset.cuisine; renderAll(); return; }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'ai') openAIChef();
  if (act === 'import') openImportRecipe();
}
