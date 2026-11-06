/* Larder service worker
 * The app's own files are network-first with a 3.5 s timeout, falling back to
 * the cache, so online users always get the latest deploy and the planner
 * works fully offline. AI requests go straight to the network.
 * Bump VERSION when you add or rename files in SHELL.
 */
const VERSION = '1.1.0';
const SHELL_CACHE = `larder-shell-${VERSION}`;

const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/base.css', './css/app.css',
  './js/app.js', './js/router.js', './js/utils.js', './js/db.js', './js/ui.js', './js/pwa.js',
  './js/store.js', './js/planner.js', './js/shopping.js', './js/units.js', './js/ai.js',
  './js/data/ingredients.js', './js/data/recipes.js', './js/data/stores.js', './js/data/photos.js',
  './js/views/common.js', './js/views/onboarding.js', './js/views/plan.js', './js/views/swap.js',
  './js/views/recipe.js', './js/views/shop.js', './js/views/recipes.js', './js/views/pantry.js',
  './js/views/ai-flows.js', './js/views/settings.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './icons/maskable-192.png', './icons/maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png',
];

// Recipe photos (~4 MB): precached too, but a failure here doesn't block install.
const PHOTOS = [
  './img/recipes/bean-enchiladas.jpg',
  './img/recipes/beef-broccoli.jpg',
  './img/recipes/burrito-bowls.jpg',
  './img/recipes/caesar-wraps.jpg',
  './img/recipes/cauli-tacos.jpg',
  './img/recipes/chicken-chorizo-rice.jpg',
  './img/recipes/chicken-noodle-soup.jpg',
  './img/recipes/chickpea-curry.jpg',
  './img/recipes/chickpea-feta-bowls.jpg',
  './img/recipes/cod-butter-beans.jpg',
  './img/recipes/cottage-pie.jpg',
  './img/recipes/crispy-gnocchi.jpg',
  './img/recipes/fish-tacos.jpg',
  './img/recipes/flatbread-pizzas.jpg',
  './img/recipes/greek-chicken.jpg',
  './img/recipes/halloumi-couscous.jpg',
  './img/recipes/honey-garlic-salmon.jpg',
  './img/recipes/kedgeree.jpg',
  './img/recipes/lamb-kofta.jpg',
  './img/recipes/lentil-shepherds-pie.jpg',
  './img/recipes/mushroom-stroganoff.jpg',
  './img/recipes/pesto-pasta.jpg',
  './img/recipes/pesto-salmon.jpg',
  './img/recipes/pork-apple-burgers.jpg',
  './img/recipes/pork-ginger-stirfry.jpg',
  './img/recipes/prawn-coconut-curry.jpg',
  './img/recipes/prawn-linguine.jpg',
  './img/recipes/red-lentil-dal.jpg',
  './img/recipes/sausage-casserole.jpg',
  './img/recipes/shakshuka.jpg',
  './img/recipes/sheet-pan-fajitas.jpg',
  './img/recipes/slow-chilli.jpg',
  './img/recipes/spag-bol.jpg',
  './img/recipes/spicy-bean-pasta.jpg',
  './img/recipes/squash-risotto.jpg',
  './img/recipes/teriyaki-chicken.jpg',
  './img/recipes/teriyaki-tofu.jpg',
  './img/recipes/thai-green-curry.jpg',
  './img/recipes/tikka-traybake.jpg',
  './img/recipes/tofu-satay.jpg',
  './img/recipes/tuna-jacket.jpg',
  './img/recipes/turkey-meatballs.jpg',
  './img/recipes/tuscan-chicken.jpg',
  './img/recipes/veg-fried-rice.jpg',
  './img/recipes/veggie-chilli.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })));
    await Promise.allSettled(PHOTOS.map((u) => cache.add(u)));

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('larder-shell-') && k !== SHELL_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(networkFirst(event));
});

async function networkFirst(event) {
  const req = event.request;
  const isNav = req.mode === 'navigate';
  const cache = await caches.open(SHELL_CACHE);
  const key = isNav ? './index.html' : req;
  const network = (async () => {
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') await cache.put(key, res.clone());
    return res;
  })();
  network.catch(() => {});
  event.waitUntil(network.catch(() => {}));
  const cached = await cache.match(key, { ignoreSearch: true });
  if (!cached) return network;
  try {
    return await Promise.race([network, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3500))]);
  } catch {
    return cached;
  }
}
