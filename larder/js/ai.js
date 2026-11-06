// Google AI Studio (Gemini) client, called straight from the browser with the
// user's own key (localStorage -> x-goog-api-key header, nothing else).
// Features: new recipe ideas that fit your profile, pantry photo scanning,
// and importing a recipe from a photo or pasted text.
import { state, getApiKey, saveSettings, DEFAULT_MODEL } from './store.js';
import { INGREDIENTS, AISLES, DIETS, VIBES, EQUIPMENT, ALLERGENS } from './data/ingredients.js';
import { blobToBase64, similarity, toInt, toNum, uid } from './utils.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const FALLBACK_MODELS = [DEFAULT_MODEL, 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];

export class AIError extends Error {
  constructor(code, message, detail = '') { super(message); this.code = code; this.detail = detail; }
}
export const hasApiKey = () => !!getApiKey();

/* ---------- Transport --------------------------------------------------- */
async function request(path, { key, body, method = 'POST', signal, timeout = 120000 }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  let res;
  try {
    res = await fetch(`${BASE}/${path}`, {
      method,
      signal: ctrl.signal,
      headers: { 'x-goog-api-key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    if (signal?.aborted) throw new AIError('aborted', 'Cancelled.');
    if (ctrl.signal.aborted) throw new AIError('timeout', 'Gemini took too long to respond. Please try again.');
    throw new AIError('network', navigator.onLine ? 'Couldn’t reach Google AI. Check your connection.' : 'You’re offline. AI features need an internet connection.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) throw toAIError(res.status, data);
  return data;
}

function toAIError(status, data) {
  const msg = data?.error?.message || '';
  const reasons = JSON.stringify(data?.error?.details || '') + (data?.error?.status || '');
  if (/API_KEY_INVALID|API key not valid|API key expired/i.test(msg + reasons)) return new AIError('invalid_key', 'That API key isn’t valid. Check it in Settings.', msg);
  if (status === 403) {
    return /referer|referrer/i.test(msg + reasons)
      ? new AIError('forbidden', 'This key is restricted to other websites. Add this site to the key’s allowed referrers in Google Cloud Console.', msg)
      : new AIError('forbidden', 'This API key can’t use the Gemini API. Create a key in Google AI Studio.', msg);
  }
  if (status === 404 || /not found for API version|is not supported for generateContent|no longer available|not available to new users/i.test(msg)) return new AIError('model', 'The selected Gemini model isn’t available for this key.', msg);
  if (status === 429) return new AIError('quota', 'Your Gemini key hit its rate limit or quota. Wait a minute and try again.', msg);
  if (status >= 500) return new AIError('server', 'Google AI is temporarily unavailable. Please try again.', msg);
  return new AIError('bad_request', msg || `Request failed (${status}).`, msg);
}

function parseLooseJSON(text) {
  try { return JSON.parse(text); } catch { /* keep trying */ }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) { try { return JSON.parse(fenced[1]); } catch { /* keep trying */ } }
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(text.slice(a, b + 1)); } catch { /* fall through */ } }
  throw new AIError('parse', 'Gemini’s reply couldn’t be read. Please try again.');
}

function readResponse(data) {
  const cand = data?.candidates?.[0];
  if (!cand) {
    const block = data?.promptFeedback?.blockReason;
    throw new AIError('blocked', block ? `Gemini blocked this request (${block.toLowerCase()}).` : 'Gemini returned no result. Try again.');
  }
  const text = (cand.content?.parts || []).filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join('');
  if (!text.trim()) throw new AIError('empty', cand.finishReason === 'MAX_TOKENS' ? 'Gemini’s answer was cut off. Try asking for fewer recipes.' : 'Gemini returned an empty answer. Try again.');
  return parseLooseJSON(text);
}

async function callModel(model, { key, system, parts, schema, temperature, signal }) {
  const base = { contents: [{ role: 'user', parts }], generationConfig: { temperature, responseMimeType: 'application/json' } };
  if (system) base.systemInstruction = { parts: [{ text: system }] };
  const path = `models/${encodeURIComponent(model.replace(/^models\//, ''))}:generateContent`;
  if (schema) {
    try {
      return readResponse(await request(path, { key, body: { ...base, generationConfig: { ...base.generationConfig, responseJsonSchema: schema } }, signal }));
    } catch (e) {
      // The prompts also describe the JSON, so plain JSON mode is a safe fallback.
      if (!(e.code === 'bad_request' && /schema|Unknown name|Invalid JSON payload|response_json/i.test(e.detail || e.message))) throw e;
    }
  }
  return readResponse(await request(path, { key, body: base, signal }));
}

async function generateJSON({ system, parts, schema, temperature = 0.4, signal }) {
  const key = getApiKey();
  if (!key) throw new AIError('no_key', 'Add your Google AI Studio API key in Settings to use AI features.');
  const preferred = state.settings.model || DEFAULT_MODEL;
  const models = [preferred, ...FALLBACK_MODELS.filter((m) => m !== preferred)];
  let lastErr = null;
  for (const model of models) {
    try {
      const data = await callModel(model, { key, system, parts, schema, temperature, signal });
      if (model !== preferred) saveSettings({ model }, { silent: true });
      return { data, model };
    } catch (e) {
      lastErr = e;
      if (e.code !== 'model') throw e;
    }
  }
  throw lastErr;
}

const EXCLUDE = /(embedding|tts|image|live|audio|transcribe|robotics|computer-use|aqa|omni|translate|deep-research|antigravity|lyria|veo|imagen|learnlm|gemma)/i;
export async function listModels(key = getApiKey()) {
  if (!key) throw new AIError('no_key', 'Enter an API key first.');
  const all = [];
  let token = '';
  for (let page = 0; page < 5; page++) {
    const data = await request(`models?pageSize=200${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`, { key, method: 'GET', timeout: 20000 });
    all.push(...(data.models || []));
    if (!data.nextPageToken) break;
    token = data.nextPageToken;
  }
  const rank = (id) => (/latest/.test(id) ? 1000 : 0) + parseFloat((id.match(/(\d+(\.\d+)?)/) || [0, 0])[1]) * 10 + (/flash(?!-lite)/.test(id) ? 3 : /pro/.test(id) ? 2 : 1);
  return all
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent') && /gemini/i.test(m.name) && !EXCLUDE.test(m.name))
    .map((m) => ({ id: m.name.replace(/^models\//, ''), label: m.displayName || m.name }))
    .sort((a, b) => rank(b.id) - rank(a.id));
}

/* ---------- Shared recipe schema ------------------------------------------ */
const FLAG_ENUM = ['meat', 'poultry', 'beef', 'pork', 'lamb', 'fish', 'crustacean', 'mollusc', 'dairy', 'egg', 'honey', 'gluten', 'nuts', 'peanut', 'sesame', 'soy', 'mustard', 'celery', 'sulphites'];
const n = (type, extra = {}) => ({ type: [type, 'null'], ...extra });

const INGREDIENT_SCHEMA = {
  type: 'object',
  properties: {
    knownId: n('string', { description: 'An id from the known-ingredient catalogue if one fits, else null.' }),
    name: { type: 'string' },
    quantityPerServing: { type: 'number' },
    unit: { type: 'string', enum: ['g', 'ml', 'item', 'tsp', 'tbsp', 'clove', 'stick'] },
    aisle: { type: 'string', enum: Object.keys(AISLES) },
    flags: { type: 'array', items: { type: 'string', enum: FLAG_ENUM } },
    perishable: { type: 'boolean' },
    packSize: { type: 'number', description: 'Typical supermarket pack size, in the same unit.' },
    packPrice: { type: 'number', description: 'Typical price of that pack in the local currency.' },
  },
  required: ['knownId', 'name', 'quantityPerServing', 'unit', 'aisle', 'flags', 'perishable', 'packSize', 'packPrice'],
};
const RECIPE_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    emoji: { type: 'string', description: 'One food emoji that suits the dish.' },
    cuisine: { type: 'string' },
    blurb: { type: 'string', description: 'One short appetising sentence.' },
    mainProtein: { type: 'string', enum: ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'fish', 'prawn', 'tofu', 'beans', 'lentils', 'egg', 'cheese', 'veg'] },
    prepMinutes: { type: 'integer' },
    cookMinutes: { type: 'integer' },
    equipment: { type: 'array', items: { type: 'string', enum: EQUIPMENT.map((e) => e.id) } },
    vibes: { type: 'array', items: { type: 'string', enum: VIBES.map((v) => v.id) } },
    ingredients: { type: 'array', items: INGREDIENT_SCHEMA },
    steps: { type: 'array', items: { type: 'string' } },
    nutritionPerServing: {
      type: 'object',
      properties: { kcal: { type: 'integer' }, protein: { type: 'integer' }, carbs: { type: 'integer' }, fat: { type: 'integer' }, fibre: { type: 'integer' } },
      required: ['kcal', 'protein', 'carbs', 'fat', 'fibre'],
    },
  },
  required: ['name', 'emoji', 'cuisine', 'blurb', 'mainProtein', 'prepMinutes', 'cookMinutes', 'equipment', 'vibes', 'ingredients', 'steps', 'nutritionPerServing'],
};

// Compact catalogue so Gemini reuses our ingredients (and their units).
function catalogue() {
  return Object.values(INGREDIENTS).map((i) => `${i.id} (${i.unit})`).join(', ');
}

const RECIPE_RULES = `Recipe rules:
- Quantities are PER SERVING. When an ingredient matches the known catalogue, set knownId to that id and use the catalogue's unit (g, ml, item, tsp, tbsp, clove or stick). Otherwise knownId is null.
- List every herb, spice, oil and seasoning with its own amount. Never write "spices to taste" as one line.
- Steps are in the order you'd actually cook, mention timings and temperatures (°C), and include any marinating or resting time in prep/cook minutes.
- flags must list every allergen and animal product the ingredient contains (e.g. soy sauce: soy, gluten; pesto: dairy, nuts).
- Nutrition is a realistic per-serving estimate.`;

function profileText(p) {
  const diets = p.diets.map((id) => DIETS.find((d) => d.id === id)?.label).filter(Boolean);
  const allergens = p.allergens.map((id) => ALLERGENS.find((a) => a.id === id)?.label).filter(Boolean);
  const kit = p.equipment.map((id) => EQUIPMENT.find((e) => e.id === id)?.label).filter(Boolean);
  const vibes = p.vibes.map((id) => VIBES.find((v) => v.id === id)?.label).filter(Boolean);
  return [
    `Region: ${p.region === 'us' ? 'United States (USD)' : 'United Kingdom (GBP)'}`,
    `Household: ${p.people} people`,
    `Every recipe MUST be: ${diets.length ? diets.join(', ') : 'no dietary restriction'}`,
    `Must NOT contain: ${allergens.length ? allergens.join(', ') : 'no allergens listed'}`,
    `Kitchen equipment available (use nothing else): ${kit.join(', ') || 'hob only'}`,
    `Preferred styles: ${vibes.join(', ') || 'any'}`,
    `Cooking effort: ${p.effort === 'quick' ? 'quick, 30 minutes or less' : p.effort === 'keen' ? 'happy to spend time cooking' : 'balanced, under an hour'}`,
    p.kcal ? `Calorie target: about ${p.kcal} kcal per dinner serving` : '',
    p.budget ? `Weekly dinner budget: ${p.region === 'us' ? '$' : '£'}${p.budget} for ${p.days.length} dinners` : '',
  ].filter(Boolean).join('\n');
}

/* ---------- Normalise a Gemini recipe into the app's shape ------------------ */
const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

function bestKnownMatch(name) {
  let best = null, bestScore = 0;
  for (const ing of Object.values(INGREDIENTS)) {
    const s = Math.max(similarity(name, ing.name), similarity(name, ing.one), ing.usName ? similarity(name, ing.usName) : 0);
    if (s > bestScore) { best = ing; bestScore = s; }
  }
  return bestScore >= 0.86 ? best : null;
}

export function normalizeAIRecipe(raw, { source = 'ai' } = {}) {
  const ingredients = {};
  const ing = [];
  const flags = new Set();
  for (const x of Array.isArray(raw?.ingredients) ? raw.ingredients : []) {
    const qty = toNum(x.quantityPerServing, 0, 5000);
    if (!x.name || qty == null || qty <= 0) continue;
    let known = x.knownId && INGREDIENTS[x.knownId] ? INGREDIENTS[x.knownId] : null;
    if (!known) {
      const m = bestKnownMatch(x.name);
      if (m && m.unit === x.unit) known = m;
    }
    if (known) {
      ing.push([known.id, qty]);
      continue;
    }
    const key = `x:${slug(x.name)}`;
    const unit = ['g', 'ml', 'item', 'tsp', 'tbsp', 'clove', 'stick'].includes(x.unit) ? x.unit : 'item';
    const f = (Array.isArray(x.flags) ? x.flags : []).filter((v) => FLAG_ENUM.includes(v));
    f.forEach((v) => flags.add(v));
    ingredients[key] = {
      id: key,
      name: x.name.charAt(0).toUpperCase() + x.name.slice(1),
      one: x.name.toLowerCase(),
      aisle: AISLES[x.aisle] ? x.aisle : 'other',
      unit,
      pack: toNum(x.packSize, 0.1, 100000) || Math.max(qty * 4, 1),
      price: { gbp: toNum(x.packPrice, 0, 200) ?? 1.5, usd: toNum(x.packPrice, 0, 200) ?? 2.5 },
      flags: f,
      perishable: !!x.perishable,
      staple: ['tsp', 'tbsp'].includes(unit),
      usName: null,
      custom: true,
    };
    ing.push([key, qty]);
  }
  const kit = (Array.isArray(raw?.equipment) ? raw.equipment : []).filter((e) => EQUIPMENT.some((x) => x.id === e));
  const nut = raw?.nutritionPerServing || {};
  const recipe = {
    id: `c:${uid()}`,
    name: String(raw?.name || 'Untitled recipe').slice(0, 90),
    emoji: [...String(raw?.emoji || '🍽️')].slice(0, 2).join('') || '🍽️',
    cuisine: String(raw?.cuisine || 'Home cooking').slice(0, 30),
    protein: raw?.mainProtein || 'veg',
    blurb: String(raw?.blurb || '').slice(0, 200),
    prep: toInt(raw?.prepMinutes, 0, 600) ?? 10,
    cook: toInt(raw?.cookMinutes, 0, 900) ?? 20,
    vibes: (Array.isArray(raw?.vibes) ? raw.vibes : []).filter((v) => ['family', 'comfort', 'takeaway', 'classics'].includes(v)),
    needs: kit.length ? kit.map((e) => [e]) : [],
    ing,
    steps: (Array.isArray(raw?.steps) ? raw.steps : []).map(String).filter(Boolean).slice(0, 20),
    n: { kcal: toInt(nut.kcal, 0, 3000), protein: toInt(nut.protein, 0, 300), carbs: toInt(nut.carbs, 0, 500), fat: toInt(nut.fat, 0, 300), fibre: toInt(nut.fibre, 0, 100) },
    flags: [...flags],
    source,
  };
  return { recipe, ingredients };
}

/* ---------- Feature: new recipe ideas -------------------------------------- */
export async function generateRecipes({ count = 3, profile = state.profile, pantry = [], avoid = [], request: ask = '', signal } = {}) {
  const system = `You are a home-cooking recipe developer writing practical weeknight dinners for a meal-planning app. Return JSON only.\n${RECIPE_RULES}`;
  const text = [
    `Create ${count} different dinner recipes for this household.`,
    profileText(profile),
    pantry.length ? `Ingredients already at home (use some where sensible): ${pantry.join(', ')}` : '',
    avoid.length ? `Avoid repeating these dishes: ${avoid.slice(0, 40).join('; ')}` : '',
    ask ? `The cook also asked for: ${ask}` : '',
    'Keep shopping lists short and ingredients easy to find in a normal supermarket. Reuse fresh ingredients across the recipes where it makes sense to cut waste.',
    `Known-ingredient catalogue (id and unit): ${catalogue()}`,
  ].filter(Boolean).join('\n\n');
  const schema = { type: 'object', properties: { recipes: { type: 'array', items: RECIPE_SCHEMA } }, required: ['recipes'] };
  const { data, model } = await generateJSON({ system, parts: [{ text }], schema, temperature: 0.8, signal });
  return { results: (data?.recipes || []).map((r) => normalizeAIRecipe(r, { source: 'ai' })), model };
}

/* ---------- Feature: import a recipe from photo(s) or text ------------------- */
export async function importRecipe({ text = '', images = [], signal } = {}) {
  const system = `You turn recipes from cookbook photos, screenshots or pasted text into structured JSON for a meal-planning app. Return JSON only.\n${RECIPE_RULES}
- Convert the original amounts to PER SERVING by dividing by the number of servings the source makes (assume 4 if it doesn't say).
- Keep the cook's method but write the steps in your own clear words.
- If the input is not a recipe, return a recipe named "Not a recipe" with no ingredients.`;
  const parts = [{ text: `Import this recipe.${text ? `\n\n---\n${text.slice(0, 40000)}\n---` : ''}\n\nKnown-ingredient catalogue (id and unit): ${catalogue()}` }];
  for (const b of images) parts.push({ inlineData: { mimeType: b.type || 'image/jpeg', data: await blobToBase64(b) } });
  const { data, model } = await generateJSON({ system, parts, schema: RECIPE_SCHEMA, temperature: 0.2, signal });
  if (!data?.ingredients?.length || /^not a recipe$/i.test(data?.name || '')) throw new AIError('not_recipe', 'Gemini couldn’t find a recipe in that. Try a clearer photo or paste the full text.');
  return { ...normalizeAIRecipe(data, { source: 'import' }), model };
}

/* ---------- Feature: scan the fridge / cupboard ------------------------------- */
const PANTRY_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Plain grocery name, e.g. "baby spinach".' },
          knownId: n('string', { description: 'Matching id from the catalogue, or null.' }),
          useSoon: { type: 'boolean', description: 'True if it looks opened, ripe, wilting or close to its date.' },
        },
        required: ['name', 'knownId', 'useSoon'],
      },
    },
  },
  required: ['items'],
};

export async function scanPantry(images, { signal } = {}) {
  const system = 'You identify food and cooking ingredients in photos of fridges, cupboards, shelves or shopping. List each distinct ingredient once. Ignore non-food items. Don\'t guess at things you can\'t see clearly. Return JSON only.';
  const parts = [{ text: `List the ingredients you can see. Known-ingredient catalogue (id and unit): ${catalogue()}` }];
  for (const b of images) parts.push({ inlineData: { mimeType: b.type || 'image/jpeg', data: await blobToBase64(b) } });
  const { data, model } = await generateJSON({ system, parts, schema: PANTRY_SCHEMA, temperature: 0.1, signal });
  const items = (data?.items || []).map((x) => {
    let id = x.knownId && INGREDIENTS[x.knownId] ? x.knownId : null;
    if (!id && x.name) id = bestKnownMatch(x.name)?.id || null;
    return { name: String(x.name || '').trim(), id, useSoon: !!x.useSoon };
  }).filter((x) => x.name);
  const seen = new Set();
  return { items: items.filter((x) => { const k = x.id || x.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }), model };
}
