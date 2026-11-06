// App state + persistence. Every mutation goes through these functions so
// data is saved (IndexedDB, localStorage fallback) and views are notified.
import { kv, initDB, requestPersistence } from './db.js';
import { INGREDIENTS } from './data/ingredients.js';
import { RECIPES } from './data/recipes.js';
import { uid, isoDate, addDays, parseISO } from './utils.js';

const SETTINGS_KEY = 'larder.settings';
const API_KEY_KEY = 'larder.geminiKey';
const DATA_KEY = 'data';
export const DEFAULT_MODEL = 'gemini-flash-latest';

const guessRegion = () => (/^en-US|^es-US/i.test(navigator.language || '') ? 'us' : 'uk');

export function defaultProfile(region = guessRegion()) {
  return {
    region,
    store: region === 'us' ? 'kroger' : 'tesco',
    people: 2,
    days: [0, 1, 2, 3, 4],
    budget: region === 'us' ? 70 : 50,
    diets: [],
    allergens: [],
    equipment: ['hob', 'oven', 'microwave'],
    vibes: ['quick', 'family'],
    effort: 'balanced',
    kcal: null,
    reuse: true,
  };
}

export const state = {
  ready: false,
  onboarded: false,
  profile: defaultProfile(),
  plans: {},
  pantry: {},
  favorites: [],
  disliked: [],
  customRecipes: [],
  customIngredients: {},
  settings: loadSettings(),
};

/* ---------- Events ---------------------------------------------------- */
const listeners = new Set();
export function on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(kind, detail) {
  for (const fn of listeners) {
    try { fn(kind, detail); } catch (e) { console.error(e); }
  }
}

/* ---------- Persistence ------------------------------------------------ */
let saveTimer = null;
let saving = Promise.resolve();
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('larder') : null;

function snapshot() {
  const { onboarded, profile, plans, pantry, favorites, disliked, customRecipes, customIngredients } = state;
  return { v: 1, onboarded, profile, plans, pantry, favorites, disliked, customRecipes, customIngredients };
}
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 60);
}
export function flush() {
  clearTimeout(saveTimer);
  saveTimer = null;
  const snap = snapshot();
  saving = saving.then(() => kv.set(DATA_KEY, snap))
    .then(() => channel?.postMessage({ type: 'data' }))
    .catch((e) => { console.error('[Larder] save failed', e); emit('error', e); });
  return saving;
}
addEventListener('pagehide', () => { if (saveTimer) flush(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && saveTimer) flush(); });

async function loadData() {
  let data = null;
  try { data = await kv.get(DATA_KEY); } catch (e) { console.warn(e); }
  state.onboarded = !!data?.onboarded;
  state.profile = { ...defaultProfile(), ...(data?.profile || {}) };
  state.plans = data?.plans || {};
  state.pantry = data?.pantry || {};
  state.favorites = data?.favorites || [];
  state.disliked = data?.disliked || [];
  state.customRecipes = data?.customRecipes || [];
  state.customIngredients = data?.customIngredients || {};
}

export async function initStore() {
  await initDB();
  await loadData();
  state.ready = true;
  channel?.addEventListener('message', async (e) => {
    if (e.data?.type === 'data') { await loadData(); emit('data'); }
  });
  emit('data');
}

/* ---------- Profile ----------------------------------------------------- */
export function setProfile(patch) {
  state.profile = { ...state.profile, ...patch };
  persist();
  emit('profile', patch);
}
export function completeOnboarding(profile) {
  state.profile = { ...state.profile, ...profile };
  state.onboarded = true;
  persist();
  emit('profile');
  requestPersistence();
}

/* ---------- Recipes & ingredients -------------------------------------- */
export const getIngredient = (key) => INGREDIENTS[key] || state.customIngredients[key] || null;
export const allRecipes = () => [...RECIPES, ...state.customRecipes];
export const getRecipe = (id) => RECIPES.find((r) => r.id === id) || state.customRecipes.find((r) => r.id === id) || null;

export function addCustomRecipe(recipe, ingredients = {}) {
  Object.assign(state.customIngredients, ingredients);
  const r = { ...recipe, id: recipe.id || `c:${uid()}`, createdAt: new Date().toISOString() };
  state.customRecipes = [r, ...state.customRecipes.filter((x) => x.id !== r.id)];
  persist();
  emit('recipes', { added: r.id });
  return r;
}
export function deleteCustomRecipe(id) {
  state.customRecipes = state.customRecipes.filter((r) => r.id !== id);
  state.favorites = state.favorites.filter((f) => f !== id);
  persist();
  emit('recipes', { deleted: id });
}

export function toggleFavorite(id) {
  const on = !state.favorites.includes(id);
  state.favorites = on ? [id, ...state.favorites] : state.favorites.filter((f) => f !== id);
  if (on) state.disliked = state.disliked.filter((d) => d !== id);
  persist();
  emit('favorites', { id, on });
  return on;
}
export function setDisliked(id, on = true) {
  state.disliked = on ? [...new Set([id, ...state.disliked])] : state.disliked.filter((d) => d !== id);
  if (on) state.favorites = state.favorites.filter((f) => f !== id);
  persist();
  emit('favorites', { id });
}

/* ---------- Weeks & plans ----------------------------------------------- */
export function weekStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  return isoDate(addDays(d, -day));
}
export const thisWeek = () => weekStart();
export const shiftWeek = (key, n) => isoDate(addDays(parseISO(key), n * 7));
export const dayDate = (key, dayIndex) => addDays(parseISO(key), dayIndex);

export const getPlan = (key) => state.plans[key] || null;

export function savePlan(key, slots, extra = {}) {
  const prev = state.plans[key];
  state.plans[key] = {
    weekStart: key,
    createdAt: prev?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    slots,
    list: prev?.list || { checked: {}, extras: [], locked: null },
    ...extra,
  };
  persist();
  emit('plan', { week: key });
  return state.plans[key];
}

export function updateSlot(key, day, patch) {
  const plan = state.plans[key];
  if (!plan) return null;
  plan.slots = plan.slots.map((s) => (s.day === day ? { ...s, ...patch } : s));
  plan.updatedAt = new Date().toISOString();
  persist();
  emit('plan', { week: key, day });
  return plan;
}

export function removeSlot(key, day) {
  const plan = state.plans[key];
  if (!plan) return;
  plan.slots = plan.slots.filter((s) => s.day !== day);
  plan.updatedAt = new Date().toISOString();
  persist();
  emit('plan', { week: key, day });
}

export function setSlot(key, day, recipeId, servings) {
  const plan = state.plans[key] || savePlan(key, []);
  const existing = plan.slots.find((s) => s.day === day);
  const slot = { day, recipeId, servings: servings || existing?.servings || state.profile.people, status: 'planned', locked: existing?.locked || false };
  plan.slots = [...plan.slots.filter((s) => s.day !== day), slot].sort((a, b) => a.day - b.day);
  plan.updatedAt = new Date().toISOString();
  persist();
  emit('plan', { week: key, day });
  return slot;
}

export function deletePlan(key) {
  delete state.plans[key];
  persist();
  emit('plan', { week: key });
}

// Recently planned recipe ids (for variety), newest first.
export function recentRecipeIds(beforeKey, weeks = 2) {
  const ids = [];
  for (let i = 1; i <= weeks; i++) {
    const p = state.plans[shiftWeek(beforeKey, -i)];
    if (p) ids.push(...p.slots.map((s) => s.recipeId));
  }
  return ids;
}

/* ---------- Shopping list state ----------------------------------------- */
function listOf(key) {
  const plan = state.plans[key] || savePlan(key, []);
  plan.list ||= { checked: {}, extras: [], locked: null };
  return plan.list;
}
export function toggleChecked(key, itemKey) {
  const list = listOf(key);
  list.checked[itemKey] = !list.checked[itemKey];
  persist();
  emit('list', { week: key });
}
export function clearChecked(key) {
  listOf(key).checked = {};
  persist();
  emit('list', { week: key });
}
export function addExtra(key, name) {
  const list = listOf(key);
  const item = { id: `e:${uid()}`, name: String(name).trim().slice(0, 80) };
  list.extras = [...list.extras, item];
  persist();
  emit('list', { week: key });
  return item;
}
export function removeExtra(key, id) {
  const list = listOf(key);
  list.extras = list.extras.filter((e) => e.id !== id);
  delete list.checked[id];
  persist();
  emit('list', { week: key });
}
export function lockList(key, snapshotItems) {
  listOf(key).locked = snapshotItems ? { at: new Date().toISOString(), planUpdatedAt: state.plans[key].updatedAt, items: snapshotItems } : null;
  persist();
  emit('list', { week: key });
}

/* ---------- Pantry --------------------------------------------------------- */
export function addPantry(keyOrName, { useSoon = false, name } = {}) {
  const key = INGREDIENTS[keyOrName] || state.customIngredients[keyOrName] ? keyOrName : `x:${String(keyOrName).trim().toLowerCase()}`;
  const ing = getIngredient(key);
  state.pantry[key] = { name: name || ing?.name || String(keyOrName).trim(), addedAt: new Date().toISOString(), useSoon };
  persist();
  emit('pantry', { key });
  return key;
}
export function setPantryUseSoon(key, useSoon) {
  if (!state.pantry[key]) return;
  state.pantry[key].useSoon = useSoon;
  persist();
  emit('pantry', { key });
}
export function removePantry(key) {
  delete state.pantry[key];
  persist();
  emit('pantry', { key });
}
export const inPantry = (key) => !!state.pantry[key];

/* ---------- Import / export / reset -------------------------------------- */
export const exportBackup = () => ({ app: 'Larder', schema: 1, exportedAt: new Date().toISOString(), ...snapshot() });
export function importBackup(data) {
  if (!data || data.app !== 'Larder') throw new Error("This file isn't a Larder backup.");
  state.onboarded = !!data.onboarded;
  state.profile = { ...defaultProfile(), ...(data.profile || {}) };
  state.plans = data.plans || {};
  state.pantry = data.pantry || {};
  state.favorites = data.favorites || [];
  state.disliked = data.disliked || [];
  state.customRecipes = data.customRecipes || [];
  state.customIngredients = data.customIngredients || {};
  persist();
  emit('data');
}
export async function resetAll() {
  state.onboarded = false;
  state.profile = defaultProfile();
  state.plans = {};
  state.pantry = {};
  state.favorites = [];
  state.disliked = [];
  state.customRecipes = [];
  state.customIngredients = {};
  await flush();
  emit('data');
}

/* ---------- Settings & API key ------------------------------------------- */
export function loadSettings() {
  try { return { model: DEFAULT_MODEL, theme: 'system', ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return { model: DEFAULT_MODEL, theme: 'system' }; }
}
export function saveSettings(patch, { silent = false } = {}) {
  Object.assign(state.settings, patch);
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings)); } catch { /* private mode */ }
  if (!silent) emit('settings', patch);
}
export function getApiKey() {
  try { return localStorage.getItem(API_KEY_KEY) || ''; } catch { return ''; }
}
export function setApiKey(key) {
  try {
    if (key) localStorage.setItem(API_KEY_KEY, key.trim());
    else localStorage.removeItem(API_KEY_KEY);
  } catch { /* storage unavailable */ }
  emit('settings', { apiKey: true });
}
