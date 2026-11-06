// Recipe detail sheet (scalable ingredients, method, nutrition, kit tips,
// add-to-plan) and full-screen cook mode with step timers.
import { state, on, getRecipe, getIngredient, toggleFavorite, setDisliked, thisWeek, getPlan, setSlot, updateSlot, deleteCustomRecipe } from '../store.js';
import { suitability, methodFor, vibeLabels, dietLabels, servingCost, totalTime } from '../planner.js';
import { html, setHTML, plural, vibrate } from '../utils.js';
import { icon, openSheet, actionSheet, toast, confirmDialog, pushOverlay, closeOverlay } from '../ui.js';
import { fmtLine, fmtMoney } from '../units.js';
import { tile, photoCredit, fmtTime, DAY_NAMES, heartIcon } from './common.js';

export function openRecipe(id, { weekKey = null, day = null, servings = null } = {}) {
  const r = getRecipe(id);
  if (!r) return null;
  let serves = servings || state.profile.people;
  const sheet = openSheet({ title: r.name, subtitle: r.cuisine, size: 'full' });

  function render() {
    const region = state.profile.region;
    const fit = suitability(r);
    const method = methodFor(r);
    const fav = state.favorites.includes(r.id);
    const slot = weekKey != null && day != null ? getPlan(weekKey)?.slots.find((s) => s.day === day) : null;
    setHTML(sheet.body, html`
      <div class="hero">${tile(r, 'lg')}</div>
      ${photoCredit(r)}
      ${r.blurb ? html`<p class="muted" style="margin-top:10px;font-size:15px;line-height:1.5">${r.blurb}</p>` : ''}
      <div class="r-meta">
        <span class="badge">${icon('clock')} ${fmtTime(totalTime(r))}${r.prep ? ` · ${r.prep} min prep` : ''}</span>
        ${r.n?.kcal ? html`<span class="badge">${icon('flame')} ${r.n.kcal} kcal</span>` : ''}
        <span class="badge">${icon('wallet')} ${fmtMoney(servingCost(r), region)} a serving</span>
        ${vibeLabels(r).map((v) => html`<span class="badge badge--accent">${v.emoji} ${v.label}</span>`)}
        ${dietLabels(r).map((d) => html`<span class="badge badge--sage">${d}</span>`)}
        ${r.source ? html`<span class="badge badge--accent">${icon('sparkles')} ${r.source === 'import' ? 'Imported' : 'AI recipe'}</span>` : ''}
      </div>
      ${!fit.ok ? html`<div class="callout callout--warn">${icon('alert')}<div><strong>Doesn’t match your preferences:</strong> ${fit.reasons.join(' · ')}</div></div>` : ''}
      ${method.ok && method.tips.length ? html`<div class="callout callout--info" style="margin-top:10px">${icon('info')}<div>${method.tips.map((t) => html`<div>${t}</div>`)}</div></div>` : ''}

      <div class="section-title">Ingredients</div>
      <div class="servings"><span><b>Servings</b></span>
        <div class="seg-mini"><button type="button" data-act="serves-" aria-label="Fewer servings">${icon('minus')}</button><b>${serves}</b><button type="button" data-act="serves+" aria-label="More servings">${icon('plus')}</button></div>
      </div>
      <ul class="ing-list">${r.ing.map(([key, qty]) => {
        const ing = getIngredient(key);
        if (!ing) return '';
        return html`<li><span>${fmtLine(ing, qty * serves, region)}</span>${state.pantry[key] ? html`<span class="have">In pantry</span>` : ''}</li>`;
      })}
        <li class="faint" style="font-size:13.5px">Plus salt and black pepper to season.</li>
      </ul>

      <div class="section-title">Method</div>
      <ol class="step-list">${r.steps.map((s) => html`<li><span>${s}</span></li>`)}</ol>

      ${r.n?.kcal ? html`<div class="section-title">Nutrition per serving (estimate)</div>
      <div class="nutri">
        <div><b>${r.n.kcal}</b><span>kcal</span></div><div><b>${r.n.protein ?? '–'}g</b><span>protein</span></div>
        <div><b>${r.n.carbs ?? '–'}g</b><span>carbs</span></div><div><b>${r.n.fat ?? '–'}g</b><span>fat</span></div>
        <div><b>${r.n.fibre ?? '–'}g</b><span>fibre</span></div>
      </div>` : ''}
      <p class="hint" style="margin-top:14px">Allergens are worked out from typical ingredients; always check product labels.</p>
      <div class="row-flex" style="margin-top:14px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" data-act="dislike">${icon('thumbs-down')} Don’t suggest this</button>
        ${r.source ? html`<button class="btn btn-ghost btn-sm" style="color:var(--danger)" data-act="delete">${icon('trash')} Delete recipe</button>` : ''}
      </div>`);
    sheet.setFooter(html`
      <button class="btn btn-secondary btn-icon-only" data-act="fav" aria-label="${fav ? 'Remove from favourites' : 'Add to favourites'}" style="color:var(--primary)">${heartIcon(fav)}</button>
      ${slot ? html`<button class="btn btn-secondary" data-act="cooked">${icon('check-circle')} ${slot.status === 'cooked' ? 'Cooked' : 'Mark cooked'}</button>`
        : html`<button class="btn btn-secondary" data-act="add">${icon('calendar')} Add to plan</button>`}
      <button class="btn btn-primary" data-act="cook">${icon('chef')} Cook</button>`);
  }

  async function onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    switch (b.dataset.act) {
      case 'serves-': serves = Math.max(1, serves - 1); render(); break;
      case 'serves+': serves = Math.min(16, serves + 1); render(); break;
      case 'fav': toast(toggleFavorite(r.id) ? 'Saved to favourites' : 'Removed from favourites', { iconName: 'heart' }); break;
      case 'dislike':
        setDisliked(r.id, true);
        toast('We won’t suggest this again', { action: 'Undo', onAction: () => setDisliked(r.id, false) });
        break;
      case 'delete': {
        if (await confirmDialog({ title: 'Delete this recipe?', message: `“${r.name}” will be removed from My recipes.`, confirmText: 'Delete', danger: true })) {
          await sheet.close();
          deleteCustomRecipe(r.id);
          toast('Recipe deleted');
        }
        break;
      }
      case 'add': {
        const wk = thisWeek();
        const plan = getPlan(wk);
        const choice = await actionSheet({
          title: 'Add to this week',
          actions: DAY_NAMES.map((d, i) => {
            const s = plan?.slots.find((x) => x.day === i);
            return { value: i, label: d, sub: s ? `Replaces ${getRecipe(s.recipeId)?.name || 'a meal'}` : 'Free night', icon: 'calendar' };
          }),
        });
        if (choice) { setSlot(wk, choice.value, r.id, serves); toast(`Added to ${DAY_NAMES[choice.value]}`, { iconName: 'calendar' }); }
        break;
      }
      case 'cooked': {
        const slot = getPlan(weekKey)?.slots.find((s) => s.day === day);
        updateSlot(weekKey, day, { status: slot?.status === 'cooked' ? 'planned' : 'cooked' });
        break;
      }
      case 'cook':
        openCook(r, serves, { onCooked: weekKey != null && day != null ? () => updateSlot(weekKey, day, { status: 'cooked' }) : null });
        break;
      default: break;
    }
  }
  sheet.body.addEventListener('click', onClick);
  sheet.foot.addEventListener('click', onClick);
  const off = on((kind) => { if (['favorites', 'pantry', 'plan', 'profile'].includes(kind) && sheet.isOpen) render(); });
  sheet.onClose = () => off();
  render();
  return sheet;
}

/* ---------- Cook mode ------------------------------------------------------- */
const TIME_RE = /(\d+)(?:\s*[–-]\s*(\d+))?\s*(hours?|hrs?|h|minutes?|mins?|min)\b/gi;

function timersIn(text) {
  const out = [];
  for (const m of text.matchAll(TIME_RE)) {
    const n = +(m[2] || m[1]);
    const mins = /^h/i.test(m[3]) ? n * 60 : n;
    if (mins > 0 && mins <= 600) out.push({ label: m[0], seconds: mins * 60 });
  }
  return out;
}

export function openCook(r, serves, { onCooked } = {}) {
  let step = 0;
  const timers = new Map(); // label -> { end, remaining, handle }
  let wakeLock = null;
  const el = document.createElement('div');
  el.className = 'cook';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', `Cooking ${r.name}`);
  document.getElementById('scan-root').append(el);
  const entry = pushOverlay(teardown);

  async function keepAwake() {
    try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* not supported */ }
  }
  // The browser drops the wake lock when the page is hidden; take it back on return.
  const onVis = () => { if (document.visibilityState === 'visible') keepAwake(); };
  document.addEventListener('visibilitychange', onVis);
  keepAwake();

  function teardown() {
    for (const t of timers.values()) clearInterval(t.handle);
    try { wakeLock?.release(); } catch { /* ignore */ }
    document.removeEventListener('visibilitychange', onVis);
    el.remove();
  }

  const fmtClock = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, '0')}`;

  function beep() {
    vibrate([200, 100, 200]);
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.35, 0.7].forEach((t) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.2, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + t);
        o.stop(ctx.currentTime + t + 0.3);
      });
    } catch { /* audio blocked */ }
  }

  function toggleTimer(label, seconds) {
    const t = timers.get(label);
    if (t) { clearInterval(t.handle); timers.delete(label); render(); return; }
    const end = Date.now() + seconds * 1000;
    const handle = setInterval(() => {
      const left = Math.round((end - Date.now()) / 1000);
      const chip = el.querySelector(`[data-timer="${CSS.escape(label)}"] span`);
      if (chip) chip.textContent = left > 0 ? fmtClock(left) : 'Done!';
      if (left <= 0) {
        clearInterval(handle);
        timers.delete(label);
        beep();
        toast(`Timer done: ${label}`, { iconName: 'timer', duration: 8000 });
        render();
      }
    }, 500);
    timers.set(label, { end, handle });
    render();
  }

  function render() {
    const region = state.profile.region;
    const text = r.steps[step] || '';
    const found = timersIn(text);
    const last = step === r.steps.length - 1;
    setHTML(el, html`
      <div class="cook-top">
        <button class="icon-btn filled" data-act="close" aria-label="Exit cook mode">${icon('x')}</button>
        <div class="row-main"><div class="row-title">${r.name}</div><div class="row-sub">${plural(serves, 'serving')}</div></div>
        <button class="icon-btn filled" data-act="ings" aria-label="Show ingredients">${icon('clipboard')}</button>
      </div>
      <div class="cook-progress" aria-hidden="true">${r.steps.map((_, n) => html`<i class="${n <= step ? 'done' : ''}"></i>`)}</div>
      <div class="cook-body" aria-live="polite">
        <div class="cook-step-no">Step ${step + 1} of ${r.steps.length}</div>
        <div class="cook-text">${text}</div>
        ${found.length || timers.size ? html`<div class="timers">
          ${found.map((t) => {
            const running = timers.get(t.label);
            return html`<button class="timer-chip ${running ? 'running' : ''}" data-timer="${t.label}" data-seconds="${t.seconds}">${icon(running ? 'pause' : 'timer')}<span>${running ? fmtClock(Math.round((running.end - Date.now()) / 1000)) : `Start ${t.label} timer`}</span></button>`;
          })}
          ${[...timers.entries()].filter(([label]) => !found.some((f) => f.label === label)).map(([label, t]) => html`<button class="timer-chip running" data-timer="${label}" data-seconds="0">${icon('pause')}<span>${fmtClock(Math.round((t.end - Date.now()) / 1000))}</span></button>`)}
        </div>` : ''}
        <details class="more"><summary>Ingredients ${icon('chevron-down', 'i-sm')}</summary>
          <ul class="ing-list">${r.ing.map(([key, qty]) => { const ing = getIngredient(key); return ing ? html`<li>${fmtLine(ing, qty * serves, region)}</li>` : ''; })}</ul>
        </details>
      </div>
      <div class="cook-foot">
        <button class="btn btn-secondary btn-lg" data-act="prev" ${step === 0 ? 'disabled' : ''}>${icon('chevron-left')} Back</button>
        ${last ? html`<button class="btn btn-primary btn-lg" data-act="done">${icon('check')} Done</button>`
          : html`<button class="btn btn-primary btn-lg" data-act="next">Next ${icon('chevron-right')}</button>`}
      </div>`);
  }

  el.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-timer]');
    if (t) { toggleTimer(t.dataset.timer, +t.dataset.seconds); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    switch (b.dataset.act) {
      case 'close': closeOverlay(entry); break;
      case 'prev': step = Math.max(0, step - 1); render(); break;
      case 'next': step = Math.min(r.steps.length - 1, step + 1); render(); break;
      case 'ings': el.querySelector('details.more')?.toggleAttribute('open'); break;
      case 'done':
        await closeOverlay(entry);
        if (onCooked) { onCooked(); toast('Marked as cooked. Enjoy!', { iconName: 'check' }); } else toast('Enjoy your dinner!');
        break;
      default: break;
    }
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { step = Math.min(r.steps.length - 1, step + 1); render(); }
    if (e.key === 'ArrowLeft') { step = Math.max(0, step - 1); render(); }
  });
  render();
}
