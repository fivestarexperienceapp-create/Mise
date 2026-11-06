// Swap a night's dinner (ranked suggestions + search) and the AI chef sheet
// that asks Gemini for new recipes that fit your profile.
import { state, getPlan, getRecipe, setSlot, addCustomRecipe, allRecipes } from '../store.js';
import { swapOptions, suitability } from '../planner.js';
import { generateRecipes, hasApiKey } from '../ai.js';
import { html, setHTML, debounce, plural } from '../utils.js';
import { icon, openSheet, toast, toastError, setBusy } from '../ui.js';
import { tile, metaLine, DAY_NAMES } from './common.js';
import { openRecipe } from './recipe.js';
import { openSettings } from './settings.js';

export function openSwap(weekKey, day) {
  const plan = getPlan(weekKey);
  const current = plan?.slots.find((s) => s.day === day);
  const s = openSheet({
    title: current ? `Swap ${DAY_NAMES[day]}’s dinner` : `Dinner for ${DAY_NAMES[day]}`,
    subtitle: current ? `Currently: ${getRecipe(current.recipeId)?.name || ''}` : 'Pick something that fits your week',
    size: 'full',
  });
  let q = '';

  function choose(id) {
    setSlot(weekKey, day, id, current?.servings);
    s.close();
    toast(`${DAY_NAMES[day]}: ${getRecipe(id)?.name}`, { iconName: 'shuffle' });
  }

  function render() {
    const slots = plan?.slots || [];
    const base = current ? slots : [...slots, { day, recipeId: '__none__', servings: state.profile.people, status: 'skipped' }];
    const opts = swapOptions(base, day, { weekKey, n: 6 });
    const ql = q.trim().toLowerCase();
    const inPlan = new Set(slots.map((x) => x.recipeId));
    const results = ql ? allRecipes().filter((r) => !inPlan.has(r.id) && `${r.name} ${r.cuisine}`.toLowerCase().includes(ql)).slice(0, 20) : [];
    setHTML(s.body, html`
      <div class="searchbar" style="margin:2px 0 12px">${icon('search')}<input type="search" data-el="q" placeholder="Search all recipes" value="${q}" autocomplete="off" aria-label="Search recipes"></div>
      ${ql ? html`<div class="stack" style="gap:8px">${results.length ? results.map((r) => option(r, [], suitability(r))) : html`<p class="muted" style="padding:10px 4px">No recipes match “${q}”.</p>`}</div>`
        : html`<div class="section-title" style="margin-top:4px">Best fits for your week</div>
          <div class="stack" style="gap:8px">${opts.length ? opts.map((o) => option(o.recipe, o.reasons, { ok: true })) : html`<p class="muted">No other recipes match your preferences.</p>`}</div>
          <button class="btn btn-ai btn-block" style="margin-top:16px" data-act="ai">${icon('sparkles')} Ask AI for something new</button>`}`);
  }

  function option(r, reasons, fit) {
    return html`<div class="swap-opt">
      <button type="button" class="row-hit" data-pick="${r.id}">
        ${tile(r, 'sm')}
        <div class="row-main"><div class="row-title" style="white-space:normal">${r.name}</div>${metaLine(r)}
          ${reasons.length || !fit.ok ? html`<div class="reason-row">${!fit.ok ? html`<span class="badge" style="background:var(--warn-soft);color:var(--warn-ink)">${fit.reasons[0]}</span>` : ''}${reasons.map((x) => html`<span class="badge badge--sage">${x}</span>`)}</div>` : ''}
        </div>
      </button>
      <button type="button" class="icon-btn" data-view="${r.id}" aria-label="View recipe">${icon('chevron-right')}</button>
    </div>`;
  }

  s.body.addEventListener('click', async (e) => {
    const pick = e.target.closest('[data-pick]');
    if (pick) { choose(pick.dataset.pick); return; }
    const v = e.target.closest('[data-view]');
    if (v) { openRecipe(v.dataset.view); return; }
    if (e.target.closest('[data-act="ai"]')) {
      const picked = await openAIChef({ day, weekKey, pickMode: true });
      if (picked && s.isOpen) choose(picked);
    }
  });
  s.body.addEventListener('input', debounce((e) => {
    if (e.target.matches('[data-el="q"]')) {
      q = e.target.value;
      render();
      const input = s.body.querySelector('[data-el="q"]');
      input.focus();
      input.setSelectionRange(q.length, q.length);
    }
  }, 200));
  render();
  return s;
}

// Resolves with the id of a recipe the user picked (pickMode), else null.
export function openAIChef({ weekKey = null, day = null, pickMode = false } = {}) {
  return new Promise((resolve) => {
    let result = null;
    let busy = null;
    let made = [];
    const s = openSheet({
      title: 'AI chef',
      subtitle: 'New recipes that fit your diet, kit and budget',
      size: 'full',
      onClose: () => { busy?.abort(); resolve(result); },
    });

    function render() {
      if (!hasApiKey()) {
        setHTML(s.body, html`<div class="empty"><div style="font-size:56px">👩‍🍳</div><h2>Connect Gemini</h2>
          <p>Add your free Google AI Studio key in Settings and the AI chef can invent recipes around your preferences and pantry.</p>
          <div class="actions"><button class="btn btn-primary" data-act="key">${icon('key')} Add API key</button></div></div>`);
        return;
      }
      setHTML(s.body, html`
        <div class="field"><label for="ai-ask">Anything in particular? (optional)</label>
          <input class="input" id="ai-ask" placeholder="e.g. something with the leftover rice, a cosy curry, kid-friendly" maxlength="200" value="${s.body.querySelector('#ai-ask')?.value || ''}"></div>
        <div class="row-flex" style="margin-top:12px">
          <span class="muted" style="font-size:14px">Ideas</span>
          <div class="seg" data-el="count"><button type="button" data-n="1">1</button><button type="button" data-n="2" aria-pressed="true">2</button><button type="button" data-n="3">3</button></div>
          <span class="spacer"></span>
          <button class="btn btn-ai" data-act="go">${icon('sparkles')} Create</button>
        </div>
        <p class="hint" style="margin-top:8px">Uses your diet, allergies, kitchen kit, budget and pantry. AI can make mistakes; check allergens on labels.</p>
        <div data-el="out" class="stack" style="gap:10px;margin-top:16px">${made.map(card)}</div>`);
    }

    function card(r) {
      const fit = suitability(r);
      return html`<div class="card card-pad" style="display:grid;gap:10px">
        <div class="row-flex" style="align-items:flex-start">${tile(r, 'sm')}<div class="row-main"><div class="row-title" style="white-space:normal">${r.name}</div>${metaLine(r)}</div></div>
        ${r.blurb ? html`<p class="muted" style="font-size:14px">${r.blurb}</p>` : ''}
        ${!fit.ok ? html`<div class="callout callout--warn">${icon('alert')}<div>${fit.reasons.join(' · ')}</div></div>` : ''}
        <div class="row-flex"><button class="btn btn-secondary btn-sm" data-view="${r.id}">View recipe</button>
          ${pickMode ? html`<button class="btn btn-primary btn-sm" data-pick="${r.id}">${icon('calendar')} Use for ${DAY_NAMES[day]}</button>` : html`<span class="badge badge--sage">${icon('check')} Saved to My recipes</span>`}</div>
      </div>`;
    }

    s.body.addEventListener('click', async (e) => {
      const seg = e.target.closest('[data-n]');
      if (seg) { seg.parentElement.querySelectorAll('[data-n]').forEach((b) => b.setAttribute('aria-pressed', String(b === seg))); return; }
      const pick = e.target.closest('[data-pick]');
      if (pick) { result = pick.dataset.pick; s.close(); return; }
      const v = e.target.closest('[data-view]');
      if (v) { openRecipe(v.dataset.view, { weekKey, day }); return; }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'key') openSettings({ focus: 'apikey' });
      if (act === 'go') {
        const btn = e.target.closest('[data-act]');
        const count = +(s.body.querySelector('[data-n][aria-pressed="true"]')?.dataset.n || 2);
        const ask = s.body.querySelector('#ai-ask').value.trim();
        setBusy(btn, true, 'Cooking up ideas…');
        busy = new AbortController();
        try {
          const pantry = Object.values(state.pantry).map((p) => p.name);
          const avoid = allRecipes().map((r) => r.name);
          const { results } = await generateRecipes({ count, pantry, avoid, request: ask, signal: busy.signal });
          // Double-check Gemini against your diet and allergies before keeping anything.
          const usable = results.filter(({ recipe }) => recipe.ing.length && recipe.steps.length);
          const safe = usable.filter(({ recipe, ingredients }) => {
            const flags = new Set([...(recipe.flags || []), ...recipe.ing.flatMap(([k]) => ingredients[k]?.flags || [])]);
            return suitability({ ...recipe, flags: [...flags] }).ok;
          });
          const dropped = usable.length - safe.length;
          const saved = safe.map(({ recipe, ingredients }) => addCustomRecipe(recipe, ingredients));
          made = [...saved, ...made];
          if (!saved.length) toast(dropped ? 'Gemini’s ideas didn’t fit your diet or allergies, so they were discarded. Try again.' : 'Gemini didn’t return usable recipes. Try again.', { tone: 'error' });
          else toast(`${plural(saved.length, 'new recipe')} saved to My recipes${dropped ? ` (${dropped} discarded for not fitting your diet)` : ''}`, { iconName: 'sparkles' });
          render();
        } catch (err) {
          if (err.code !== 'aborted') {
            if (['no_key', 'invalid_key', 'forbidden'].includes(err.code)) openSettings({ focus: 'apikey' });
            toastError(err);
          }
          setBusy(btn, false);
        } finally { busy = null; }
      }
    });
    render();
  });
}
