// AI camera flows: a reusable photo capture screen (live camera with upload
// fallback), fridge/cupboard scanning into the pantry, and importing a recipe
// from a photo or pasted text.
import { state, addPantry, addCustomRecipe } from '../store.js';
import { INGREDIENTS, ingredientName } from '../data/ingredients.js';
import { scanPantry, importRecipe, hasApiKey } from '../ai.js';
import { html, setHTML, resizeImage, plural, vibrate } from '../utils.js';
import { icon, openSheet, actionSheet, toast, toastError, pushOverlay, closeOverlay, setBusy } from '../ui.js';
import { openRecipe } from './recipe.js';
import { openSettings } from './settings.js';
import { goTab } from '../router.js';

/* ---------- Scan menu (centre tab button) ------------------------------------ */
export async function openScanMenu() {
  const choice = await actionSheet({
    title: 'Scan with AI',
    subtitle: hasApiKey() ? 'Powered by your Gemini key' : 'Needs a free Gemini API key (Settings)',
    actions: [
      { value: 'pantry', label: 'Scan fridge or cupboard', sub: 'Add what you have to your pantry', icon: 'fridge' },
      { value: 'photo', label: 'Import a recipe from a photo', sub: 'Cookbook page, card or screenshot', icon: 'camera' },
      { value: 'text', label: 'Paste a recipe', sub: 'From a website, message or notes', icon: 'clipboard' },
    ],
  });
  if (choice?.value === 'pantry') openPantryScan();
  if (choice?.value === 'photo') openImportRecipe({ mode: 'photo' });
  if (choice?.value === 'text') openImportRecipe({ mode: 'text' });
}

function needKey() {
  if (hasApiKey()) return false;
  toast('Add your Gemini API key to use AI scanning.', { tone: 'error', action: 'Settings', onAction: () => openSettings({ focus: 'apikey' }) });
  openSettings({ focus: 'apikey' });
  return true;
}

/* ---------- Photo capture -------------------------------------------------------- */
// Resolves with an array of image Blobs, or null if cancelled.
export function capturePhotos({ title = 'Take a photo', hint = 'Fit everything in the frame', max = 3, cta = 'Use photos' } = {}) {
  return new Promise((resolve) => {
    let stream = null, photos = [], mode = 'starting', result = null;
    const el = document.createElement('div');
    el.className = 'scan';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', title);
    setHTML(el, html`
      <div class="scan-stage"><video class="scan-video" playsinline muted autoplay></video><img class="scan-photo" alt="" hidden><div class="scan-guide" hidden><i></i><i></i><i></i><i></i></div></div>
      <div class="scan-top"><button class="icon-btn" type="button" data-act="close" aria-label="Close">${icon('x')}</button><div class="scan-title">${title}</div><span style="width:40px"></span></div>
      <div class="scan-middle" data-el="middle"></div>
      <div class="scan-bottom"><div class="scan-tray" data-el="tray"></div><div class="scan-controls" data-el="controls"></div></div>
      <input type="file" accept="image/*" multiple hidden data-el="file">
      <input type="file" accept="image/*" capture="environment" hidden data-el="camera">`);
    document.getElementById('scan-root').append(el);
    const entry = pushOverlay(() => {
      stopCamera();
      photos.forEach((p) => URL.revokeObjectURL(p.url));
      el.remove();
      resolve(result);
    });

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) { setMode('nocam'); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } }, audio: false });
        if (!el.isConnected) { stopCamera(); return; }
        const v = el.querySelector('video');
        v.srcObject = stream;
        await v.play().catch(() => {});
        setMode('camera');
      } catch (e) {
        if (el.isConnected) setMode('nocam', e?.name === 'NotAllowedError');
      }
    }
    function stopCamera() { stream?.getTracks().forEach((t) => t.stop()); stream = null; }

    function addPhoto(blob) {
      if (photos.length >= max) { toast(`Up to ${max} photos`); return; }
      photos.push({ blob, url: URL.createObjectURL(blob) });
      stopCamera();
      setMode('review');
    }

    async function capture() {
      const v = el.querySelector('video');
      if (!v?.videoWidth) return;
      const c = document.createElement('canvas');
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext('2d').drawImage(v, 0, 0);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
      if (!blob) return;
      vibrate(15);
      const flash = document.createElement('div');
      flash.className = 'scan-flash';
      el.append(flash);
      setTimeout(() => flash.remove(), 400);
      addPhoto(blob);
    }

    function setMode(next, denied = false) {
      mode = next;
      const v = el.querySelector('video'), img = el.querySelector('.scan-photo');
      v.hidden = !['camera', 'starting'].includes(mode);
      img.hidden = mode !== 'review';
      if (mode === 'review') img.src = photos[photos.length - 1].url;
      el.querySelector('.scan-guide').hidden = mode !== 'camera';
      const middle = el.querySelector('[data-el="middle"]'), controls = el.querySelector('[data-el="controls"]');
      if (mode === 'starting') { setHTML(middle, html`<div class="scan-hint">Starting camera…</div>`); setHTML(controls, ''); }
      if (mode === 'camera') {
        setHTML(middle, html`<div class="scan-hint">${hint}</div>`);
        setHTML(controls, html`<button class="scan-side" type="button" data-act="library"><span class="ico">${icon('image')}</span>Library</button>
          <button class="shutter" type="button" data-act="capture" aria-label="Take photo"></button><span></span>`);
      }
      if (mode === 'nocam') {
        setHTML(middle, html`<div class="scan-nocam"><div class="dropzone" data-el="drop">${icon('camera')}<b style="color:#fff">Add a photo</b>
          <span style="font-size:13.5px">${denied ? 'Camera access is blocked, so choose or take a photo instead.' : 'Take a photo, pick one from your library, or drop an image here.'}</span></div>
          <div class="row-flex" style="justify-content:center;flex-wrap:wrap"><button class="btn btn-primary" type="button" data-act="native">${icon('camera')} Take photo</button><button class="btn btn-secondary" type="button" data-act="library">${icon('image')} Choose photo</button></div></div>`);
        setHTML(controls, '');
        const drop = el.querySelector('[data-el="drop"]');
        ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
        ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('is-over')));
        drop.addEventListener('drop', (e) => { e.preventDefault(); [...(e.dataTransfer.files || [])].filter((f) => f.type.startsWith('image/')).slice(0, max).forEach(addPhoto); });
      }
      if (mode === 'review') {
        setHTML(middle, '');
        setHTML(controls, html`<button class="scan-side" type="button" data-act="more"><span class="ico">${icon('plus')}</span>${photos.length < max ? 'Add photo' : 'Retake'}</button>
          <button class="btn btn-ai scan-analyze" type="button" data-act="use">${icon('sparkles')} ${cta}</button><span></span>`);
      }
      setHTML(el.querySelector('[data-el="tray"]'), mode === 'review' ? html`${photos.map((p, i) => html`<div class="thumb"><img src="${p.url}" alt="Photo ${i + 1}"><button type="button" data-remove="${i}" aria-label="Remove photo ${i + 1}">${icon('x')}</button></div>`)}` : '');
    }

    const onFiles = (e) => {
      [...(e.target.files || [])].filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name)).slice(0, max - photos.length).forEach(addPhoto);
      e.target.value = '';
    };
    el.querySelector('[data-el="file"]').addEventListener('change', onFiles);
    el.querySelector('[data-el="camera"]').addEventListener('change', onFiles);
    el.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-remove]');
      if (rm) {
        const [p] = photos.splice(+rm.dataset.remove, 1);
        URL.revokeObjectURL(p.url);
        if (photos.length) setMode('review'); else { setMode('starting'); startCamera(); }
        return;
      }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'close') closeOverlay(entry);
      if (act === 'capture') capture();
      if (act === 'library') el.querySelector('[data-el="file"]').click();
      if (act === 'native') el.querySelector('[data-el="camera"]').click();
      if (act === 'more') {
        if (photos.length >= max) { const p = photos.pop(); URL.revokeObjectURL(p.url); }
        setMode('starting');
        startCamera();
      }
      if (act === 'use') { result = photos.map((p) => p.blob); closeOverlay(entry); }
    });
    setMode('starting');
    startCamera();
  });
}

/* ---------- Pantry scan ------------------------------------------------------------ */
export async function openPantryScan() {
  if (needKey()) return;
  const photos = await capturePhotos({ title: 'Scan fridge or cupboard', hint: 'Open the door and get the shelves in view', cta: 'Find ingredients' });
  if (!photos?.length) return;
  const s = openSheet({ title: 'Ingredients found', subtitle: 'Gemini is looking at your photos…', size: 'full' });
  setHTML(s.body, html`<div class="loading-row" style="margin-top:30px"><span class="spinner"></span> Spotting ingredients…</div>${[1, 2, 3, 4].map(() => html`<div class="skeleton" style="height:48px;margin-top:8px"></div>`)}`);
  const ctrl = new AbortController();
  s.onClose = () => ctrl.abort();
  let items;
  try {
    const images = await Promise.all(photos.map((b) => resizeImage(b, 1600, 0.85)));
    ({ items } = await scanPantry(images, { signal: ctrl.signal }));
  } catch (e) {
    if (e.code === 'aborted') return;
    s.setTitle('Couldn’t scan that', '');
    setHTML(s.body, html`<div class="callout callout--danger" style="margin-top:10px">${icon('alert')}<div>${e.message}</div></div>`);
    if (['no_key', 'invalid_key', 'forbidden'].includes(e.code)) openSettings({ focus: 'apikey' });
    return;
  }
  if (!s.isOpen) return;
  if (!items.length) {
    s.setTitle('Nothing spotted', '');
    setHTML(s.body, html`<div class="empty"><div style="font-size:48px">🔦</div><h2>No ingredients found</h2><p>Try a brighter, closer photo of the shelves.</p></div>`);
    return;
  }
  const region = state.profile.region;
  s.setTitle('Ingredients found', `${plural(items.length, 'item')}. Untick anything that’s wrong`);
  setHTML(s.body, html`<div class="list-plain">${items.map((it, i) => {
    const label = it.id ? ingredientName(INGREDIENTS[it.id], region) : it.name;
    const already = it.id && state.pantry[it.id];
    return html`<label class="check-row"><input type="checkbox" data-i="${i}" ${already ? '' : 'checked'}>
      <div class="row-main"><div class="row-title">${label}</div><div class="row-sub">${already ? 'Already in your pantry' : it.id ? 'Matched to the recipe library' : 'Added as you named it'}</div></div>
      <button type="button" class="chip ${it.useSoon ? 'is-on' : ''}" data-soon="${i}">⏰ Use soon</button></label>`;
  })}</div>`);
  s.setFooter(html`<button class="btn btn-primary" data-act="add">${icon('plus')} Add to pantry</button>`);
  s.body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-soon]');
    if (!b) return;
    e.preventDefault();
    const it = items[+b.dataset.soon];
    it.useSoon = !it.useSoon;
    b.classList.toggle('is-on', it.useSoon);
  });
  s.foot.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-act="add"]')) return;
    const chosen = [...s.body.querySelectorAll('[data-i]:checked')].map((c) => items[+c.dataset.i]);
    chosen.forEach((it) => addPantry(it.id || it.name, { useSoon: it.useSoon, name: it.id ? undefined : it.name }));
    await s.close();
    goTab('pantry');
    toast(`${plural(chosen.length, 'ingredient')} added to your pantry`, { iconName: 'fridge' });
  });
}

/* ---------- Recipe import ------------------------------------------------------------ */
export function openImportRecipe({ mode = 'photo' } = {}) {
  if (needKey()) return;
  const s = openSheet({ title: 'Import a recipe', subtitle: 'Gemini turns it into a plannable recipe', size: 'full' });
  let tab = mode;
  let ctrl = null;
  s.onClose = () => ctrl?.abort();

  function render() {
    setHTML(s.body, html`
      <div class="seg seg-block" style="margin:4px 0 16px">
        <button type="button" data-tab="photo" aria-pressed="${String(tab === 'photo')}">${icon('camera', 'i-sm')} Photo</button>
        <button type="button" data-tab="text" aria-pressed="${String(tab === 'text')}">${icon('clipboard', 'i-sm')} Paste text</button>
      </div>
      ${tab === 'photo' ? html`
        <div class="dropzone">${icon('camera')}<b>Snap a cookbook page or recipe card</b><span style="font-size:13.5px">Or pick a screenshot. Up to 3 photos for long recipes.</span>
          <button class="btn btn-primary" data-act="shoot" style="margin-top:6px">${icon('camera')} Take or choose photos</button></div>`
        : html`<div class="field"><label for="imp-text">Paste the recipe</label>
          <textarea class="textarea" id="imp-text" rows="10" placeholder="Paste the ingredients and method from a website, message or your notes."></textarea></div>
          <button class="btn btn-ai btn-block" style="margin-top:12px" data-act="parse">${icon('sparkles')} Import recipe</button>`}
      <p class="hint" style="margin-top:12px">Quantities are converted to per-serving amounts, matched to the ingredient library for prices and aisles, and saved to My recipes so you can add it to any plan.</p>`);
  }

  async function run(input, btn) {
    ctrl = new AbortController();
    if (btn) setBusy(btn, true, 'Reading recipe…');
    else setHTML(s.body, html`<div class="loading-row" style="margin-top:30px"><span class="spinner"></span> Reading your recipe…</div>`);
    try {
      const { recipe, ingredients } = await importRecipe({ ...input, signal: ctrl.signal });
      const saved = addCustomRecipe(recipe, ingredients);
      await s.close();
      toast(`“${saved.name}” saved to My recipes`, { iconName: 'sparkles' });
      openRecipe(saved.id);
    } catch (e) {
      if (e.code === 'aborted') return;
      toastError(e);
      if (['no_key', 'invalid_key', 'forbidden'].includes(e.code)) openSettings({ focus: 'apikey' });
      if (s.isOpen) render();
    }
  }

  s.body.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; render(); return; }
    const act = e.target.closest('[data-act]');
    if (act?.dataset.act === 'shoot') {
      const photos = await capturePhotos({ title: 'Photograph the recipe', hint: 'Fill the frame with the page', cta: 'Import recipe' });
      if (!photos?.length || !s.isOpen) return;
      const images = await Promise.all(photos.map((b) => resizeImage(b, 2048, 0.88)));
      run({ images });
    }
    if (act?.dataset.act === 'parse') {
      const text = s.body.querySelector('#imp-text').value.trim();
      if (text.length < 40) { toast('Paste the full recipe, including ingredients and method.', { tone: 'error' }); return; }
      run({ text }, act);
    }
  });
  render();
}
