// Larder bootstrap: theme, persistence, views, routing, first-run setup,
// PWA registration and home-screen shortcuts.
import { initStore, state, on } from './store.js';
import { initRouter, registerView, goTab } from './router.js';
import { planView } from './views/plan.js';
import { shopView } from './views/shop.js';
import { recipesView } from './views/recipes.js';
import { pantryView } from './views/pantry.js';
import { openOnboarding } from './views/onboarding.js';
import { openScanMenu, openPantryScan } from './views/ai-flows.js';
import { initPWA } from './pwa.js';
import { toast } from './ui.js';

function applyTheme() {
  const t = state.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#15110e' : '#faf6f0'));
}

async function boot() {
  applyTheme();
  initPWA();
  await initStore();

  const views = { plan: planView, shop: shopView, recipes: recipesView, pantry: pantryView };
  for (const [name, view] of Object.entries(views)) {
    view.init(document.getElementById(`view-${name}`));
    registerView(name, view);
  }
  initRouter();
  document.querySelector('.tab-scan').addEventListener('click', () => openScanMenu());

  on((kind, detail) => {
    if (kind === 'settings' && detail && 'theme' in detail) applyTheme();
    if (kind === 'error') toast(detail?.message || 'Your data couldn’t be saved on this device.', { tone: 'error' });
    if (kind === 'data' && !state.onboarded && !document.querySelector('.ob')) openOnboarding({ onDone: () => goTab('plan') });
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  window.addEventListener('offline', () => toast('You’re offline. Planning still works; AI features need a connection.', { iconName: 'info' }));

  const params = new URLSearchParams(location.search);
  const action = params.get('action');
  if (params.has('action') || params.has('source')) history.replaceState(history.state, '', location.pathname + location.hash);

  if (!state.onboarded) openOnboarding({ onDone: () => goTab('plan') });
  else if (action === 'scan') openPantryScan();
  else if (action === 'shop') goTab('shop');

  document.getElementById('app').removeAttribute('aria-busy');
}

boot().catch((err) => {
  console.error('[Larder] failed to start', err);
  const views = document.getElementById('views');
  if (views) views.innerHTML = `<div class="empty" style="padding-top:20vh"><h2>Larder couldn’t start</h2><p>${String(err?.message || err).replace(/[<>&]/g, '')}</p><div class="actions"><button class="btn btn-primary" onclick="location.reload()">Reload</button></div></div>`;
});
