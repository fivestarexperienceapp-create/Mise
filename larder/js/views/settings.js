// Settings: preferences summary (edit = the setup quiz), Gemini key + model,
// appearance, backup / restore / reset, install and updates.
import { state, on, saveSettings, getApiKey, setApiKey, exportBackup, importBackup, resetAll, getRecipe, DEFAULT_MODEL } from '../store.js';
import { PHOTOS } from '../data/photos.js';
import { DIETS, ALLERGENS, EQUIPMENT, VIBES } from '../data/ingredients.js';
import { storeFor } from '../data/stores.js';
import { listModels } from '../ai.js';
import { html, setHTML, shareOrDownload, readFileText, isoDate, plural } from '../utils.js';
import { icon, openSheet, toast, toastError, confirmDialog, setBusy } from '../ui.js';
import { kv, storageEstimate } from '../db.js';
import { fmtMoney } from '../units.js';
import { installState, promptInstall, checkForUpdate, APP_VERSION, onInstallChange } from '../pwa.js';
import { openOnboarding } from './onboarding.js';
import { DAY_SHORT } from './common.js';

const MODELS_KEY = 'larder.models';
const DEFAULT_MODELS = [
  { id: 'gemini-flash-latest', label: 'Gemini Flash (latest)' },
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' },
];
const cachedModels = () => { try { return JSON.parse(localStorage.getItem(MODELS_KEY) || 'null') || DEFAULT_MODELS; } catch { return DEFAULT_MODELS; } };
const labels = (ids, list) => ids.map((id) => list.find((x) => x.id === id)?.label).filter(Boolean);

let ctl = null;

export function openSettings({ focus = null } = {}) {
  if (ctl?.isOpen) { focusField(ctl, focus); return ctl; }
  const s = openSheet({ title: 'Settings', size: 'full' });
  ctl = s;
  let showKey = false;

  function render() {
    const p = state.profile;
    const key = getApiKey();
    const models = cachedModels();
    const model = state.settings.model || DEFAULT_MODEL;
    if (!models.some((m) => m.id === model)) models.unshift({ id: model, label: model });
    const inst = installState();
    const row = (ic, title, value) => html`<div class="settings-row"><span class="row-icon">${icon(ic)}</span><div class="row-main"><div class="row-title">${title}</div><div class="row-sub">${value}</div></div></div>`;
    setHTML(s.body, html`
      <div class="section-title" style="margin-top:4px" data-el="prefs">Your preferences</div>
      <section class="card card-pad" style="padding-top:2px;padding-bottom:2px">
        ${row('store', 'Supermarket', `${storeFor(p.region, p.store).name} · ${p.region === 'us' ? 'United States' : 'United Kingdom'}`)}
        ${row('users', 'Household', `${plural(p.people, 'person', 'people')} · ${p.days.map((d) => DAY_SHORT[d]).join(', ') || 'no nights'}`)}
        ${row('wallet', 'Weekly budget', p.budget ? fmtMoney(p.budget, p.region, { round: true }) : 'No budget')}
        ${row('leaf', 'Diet & allergies', [...labels(p.diets, DIETS), ...labels(p.allergens, ALLERGENS).map((a) => `no ${a.toLowerCase()}`)].join(', ') || 'No restrictions')}
        ${row('utensils', 'Kitchen', `${labels(p.equipment, EQUIPMENT).join(', ') || 'Hob only'} · ${p.effort === 'quick' ? 'quick & easy' : p.effort === 'keen' ? 'loves to cook' : 'balanced effort'}`)}
        ${row('sparkles', 'Styles', [...labels(p.vibes, VIBES), p.kcal ? `~${p.kcal} kcal` : ''].filter(Boolean).join(', ') || 'Anything goes')}
      </section>
      <button class="btn btn-secondary btn-block" style="margin-top:10px" data-act="edit-prefs">${icon('edit')} Edit preferences</button>

      <div class="section-title">AI (Google Gemini)</div>
      <section class="card card-pad">
        <div class="row-flex"><span class="row-icon" style="background:linear-gradient(120deg,#2a78d6,#7b5cf0 55%,#d0509a);color:#fff">${icon('sparkles')}</span>
          <div class="row-main"><div class="row-title">Gemini</div><div class="row-sub" style="white-space:normal">AI chef, fridge scanning and recipe import</div></div>
          <span class="badge ${key ? 'badge--sage' : ''}">${key ? 'Key saved' : 'No key'}</span></div>
        <div class="field" style="margin-top:14px"><label for="st-key">Google AI Studio API key</label>
          <div class="input-wrap"><input class="input" id="st-key" type="${showKey ? 'text' : 'password'}" autocomplete="off" spellcheck="false" autocapitalize="off" placeholder="Paste your key" value="${key}">
          <button class="icon-btn" type="button" data-act="toggle-key" aria-label="${showKey ? 'Hide key' : 'Show key'}">${icon(showKey ? 'eye-off' : 'eye')}</button></div>
          <p class="hint">Free key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>. Stored only in this browser’s local storage and sent only to Google’s Gemini API. The planner itself works without it.</p></div>
        <div class="row-flex" style="margin-top:12px;flex-wrap:wrap"><button class="btn btn-primary btn-sm" data-act="save-key">${icon('key')} Save &amp; test</button>
          ${key ? html`<button class="btn btn-ghost btn-sm" data-act="remove-key">Remove key</button>` : ''}</div>
        <div data-el="key-status" aria-live="polite" style="margin-top:10px"></div>
        <div class="field" style="margin-top:8px"><label for="st-model">Model</label>
          <select class="select" id="st-model">${models.map((m) => html`<option value="${m.id}" ${m.id === model ? 'selected' : ''}>${m.label}</option>`)}</select>
          <p class="hint">“Flash (latest)” follows Google’s newest Flash model. Larder falls back automatically if a model isn’t available.</p></div>
      </section>

      <div class="section-title">Appearance</div>
      <section class="card card-pad" style="padding-top:4px;padding-bottom:4px">
        <div class="settings-row"><div class="row-main"><div class="row-title">Theme</div></div>
          <div class="seg" data-group="theme">${['system', 'light', 'dark'].map((t) => html`<button type="button" data-val="${t}" aria-pressed="${String(state.settings.theme === t)}">${t[0].toUpperCase() + t.slice(1)}</button>`)}</div></div>
      </section>

      <div class="section-title">Your data</div>
      <section class="card" style="overflow:hidden"><div class="list-plain" style="padding:0 12px">
        ${action('export', 'download', 'Export backup', 'Plans, pantry, favourites and your recipes as a JSON file')}
        ${action('import', 'upload', 'Restore backup', 'Replace everything with a Larder backup file')}
        ${action('reset', 'trash', 'Start over', 'Delete all data on this device and redo setup', true)}
      </div></section>
      <input type="file" accept=".json,application/json" hidden data-el="restore">
      <p class="hint" data-el="storage" style="margin:8px 4px 0"></p>

      <div class="section-title">App</div>
      <section class="card" style="overflow:hidden"><div class="list-plain" style="padding:0 12px">
        ${inst === 'available' ? action('install', 'phone-app', 'Install Larder', 'Add to your home screen and use it offline') : ''}
        ${inst === 'ios' ? html`<div class="row"><span class="row-icon">${icon('phone-app')}</span><div class="row-main"><div class="row-title">Install on iPhone or iPad</div><div class="row-sub" style="white-space:normal">In Safari tap Share then “Add to Home Screen”.</div></div></div>` : ''}
        ${inst === 'installed' ? html`<div class="row"><span class="row-icon">${icon('check')}</span><div class="row-main"><div class="row-title">Installed</div><div class="row-sub">Running as an app</div></div></div>` : ''}
        ${action('update', 'refresh', 'Check for updates', `Version ${APP_VERSION}`)}
        ${action('credits', 'image', 'Photo credits', 'Recipe photos from Wikimedia Commons photographers')}
      </div></section>
      <p class="hint" style="margin:14px 4px 4px;line-height:1.6">Recipes, prices and nutrition are estimates. Always check allergen labels. Your data stays on this device.</p>`);
    showStorage();
  }

  function action(act, ic, title, sub, danger = false) {
    return html`<button class="row" type="button" data-act="${act}">
      <span class="row-icon" style="${danger ? 'background:var(--danger-soft);color:var(--danger)' : ''}">${icon(ic)}</span>
      <div class="row-main"><div class="row-title" style="${danger ? 'color:var(--danger)' : ''}">${title}</div><div class="row-sub" style="white-space:normal">${sub}</div></div>${icon('chevron-right', 'faint')}</button>`;
  }

  async function showStorage() {
    const el = s.body.querySelector('[data-el="storage"]');
    const est = await storageEstimate();
    if (!el) return;
    const weeks = Object.values(state.plans).filter((p) => p.slots?.length).length;
    el.textContent = `${plural(weeks, 'planned week')} · ${plural(Object.keys(state.pantry).length, 'pantry item')} · ${plural(state.customRecipes.length, 'saved recipe')} · stored in ${kv.backend === 'indexeddb' ? 'IndexedDB' : kv.backend === 'localstorage' ? 'local storage' : 'memory only'}${est?.usage != null ? ` · ${(est.usage / 1048576).toFixed(1)} MB` : ''}`;
  }

  function keyStatus(kind, text) {
    const el = s.body.querySelector('[data-el="key-status"]');
    if (!el) return;
    setHTML(el, text ? html`<div class="callout ${kind === 'ok' ? 'callout--sage' : kind === 'err' ? 'callout--danger' : 'callout--info'}">${icon(kind === 'ok' ? 'check' : kind === 'err' ? 'alert' : 'info')}<div>${text}</div></div>` : '');
  }

  async function saveKey(btn) {
    const key = s.body.querySelector('#st-key').value.trim();
    if (!key) { keyStatus('err', 'Paste your API key first.'); return; }
    setBusy(btn, true, 'Testing…');
    try {
      const models = await listModels(key);
      setApiKey(key);
      if (models.length) localStorage.setItem(MODELS_KEY, JSON.stringify(models.slice(0, 40)));
      render();
      keyStatus('ok', `Connected. ${plural(models.length, 'Gemini model')} available to your key.`);
    } catch (e) {
      if (e.code === 'network' || e.code === 'timeout') { setApiKey(key); render(); keyStatus('info', 'Key saved, but it couldn’t be checked because you seem to be offline.'); return; }
      setBusy(btn, false);
      keyStatus('err', e.code === 'invalid_key' ? 'Google rejected this key. Copy it again from AI Studio and make sure nothing is cut off.' : e.message);
    }
  }

  s.body.addEventListener('click', async (e) => {
    const seg = e.target.closest('[data-group="theme"] [data-val]');
    if (seg) { saveSettings({ theme: seg.dataset.val }); render(); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    switch (b.dataset.act) {
      case 'edit-prefs': openOnboarding({ edit: true }); break;
      case 'toggle-key': { const v = s.body.querySelector('#st-key').value; showKey = !showKey; render(); s.body.querySelector('#st-key').value = v; break; }
      case 'save-key': saveKey(b); break;
      case 'remove-key':
        if (await confirmDialog({ title: 'Remove API key?', message: 'AI features stop working until you add a key again. Planning still works.', confirmText: 'Remove', danger: true })) { setApiKey(''); render(); }
        break;
      case 'export': await shareOrDownload(`larder-backup-${isoDate()}.json`, JSON.stringify(exportBackup(), null, 1), 'application/json'); break;
      case 'import': s.body.querySelector('[data-el="restore"]').click(); break;
      case 'reset':
        if (await confirmDialog({ title: 'Start over?', message: 'This deletes your plans, pantry, favourites and saved recipes on this device. Export a backup first if you might want them.', confirmText: 'Delete everything', danger: true })) {
          await s.close();
          await resetAll(); // app.js reopens the setup quiz when data is reset
        }
        break;
      case 'install': await promptInstall(); render(); break;
      case 'credits': openCredits(); break;
      case 'update': {
        setBusy(b, true);
        try { toast((await checkForUpdate()) ? 'Update downloading. It applies next time you open Larder.' : 'You’re on the latest version.'); } catch { toast('Couldn’t check for updates.', { tone: 'error' }); }
        setBusy(b, false);
        break;
      }
      default: break;
    }
  });
  s.body.addEventListener('change', async (e) => {
    if (e.target.id === 'st-model') { saveSettings({ model: e.target.value }); toast(`Model set to ${e.target.value}`); }
    if (e.target.dataset.el === 'restore' && e.target.files?.[0]) {
      try {
        const data = JSON.parse(await readFileText(e.target.files[0]));
        if (await confirmDialog({ title: 'Restore this backup?', message: 'Everything currently on this device is replaced by the backup.', confirmText: 'Restore' })) {
          importBackup(data);
          render();
          toast('Backup restored', { iconName: 'download' });
        }
      } catch (err) { toastError(err, 'That file couldn’t be read.'); }
      e.target.value = '';
    }
  });
  s.body.addEventListener('keydown', (e) => { if (e.target.id === 'st-key' && e.key === 'Enter') { e.preventDefault(); saveKey(s.body.querySelector('[data-act="save-key"]')); } });
  const off = on((kind) => { if (['profile', 'data'].includes(kind) && s.isOpen) render(); });
  const offInstall = onInstallChange(render);
  s.onClose = () => { off(); offInstall(); ctl = null; };
  render();
  focusField(s, focus);
  return s;
}

function openCredits() {
  const rows = Object.entries(PHOTOS)
    .map(([id, p]) => ({ id, p, name: getRecipe(id)?.name || id }))
    .sort((a, b) => a.name.localeCompare(b.name));
  openSheet({
    title: 'Photo credits',
    subtitle: 'Openly licensed photos from Wikimedia Commons',
    size: 'full',
    body: html`<p class="hint" style="margin-bottom:10px">Photos were cropped and resized for the app. Share-alike (CC BY-SA) photos are shared under the same license.</p>
      <div class="list-plain">${rows.map(({ id, p, name }) => html`<div class="row">
        <img class="photo sm" src="${p.src}" alt="" loading="lazy">
        <div class="row-main"><div class="row-title">${name}</div>
          <div class="row-sub" style="white-space:normal"><a href="${p.page}" target="_blank" rel="noopener">${p.author}</a> · ${p.licenseUrl ? html`<a href="${p.licenseUrl}" target="_blank" rel="noopener">${p.license}</a>` : p.license}</div></div>
      </div>`)}</div>`,
  });
}

function focusField(s, focus) {
  if (!focus) return;
  setTimeout(() => {
    const el = focus === 'apikey' ? s.body.querySelector('#st-key') : s.body.querySelector('[data-el="prefs"]');
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (focus === 'apikey') el?.focus({ preventScroll: true });
  }, 380);
}
