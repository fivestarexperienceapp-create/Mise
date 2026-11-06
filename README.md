# Larder 🧺 Weekly dinner planner

Larder is a mobile-first Progressive Web App that plans a week of dinners in about a minute. It works to your budget, follows every dietary need in your household's profile, reuses fresh ingredients across the week, starts from what's already in your kitchen, and produces one merged shopping list sorted by supermarket aisle. Google Gemini (with your own API key) adds an AI chef, fridge scanning and recipe import.

It is plain HTML, CSS and JavaScript (ES modules) with **no build step**: push the folder to GitHub and it runs on GitHub Pages. The planner, the 45-recipe library, shopping lists and pantry all work offline without a key.

> "Larder" is a placeholder name; change it in `manifest.webmanifest`, `index.html` and the README.

---

## Features

| | |
|---|---|
| **Setup quiz** | Region and supermarket (UK or US chains), household size, which nights to plan, weekly budget, diets (vegetarian, vegan, pescatarian, gluten-free, dairy-free, no pork, no red meat, lower carb), 13 allergens, kitchen kit (hob, oven, air fryer, microwave, slow cooker, grill), effort level, meal styles, calorie target and pantry staples. Editable any time in Settings. |
| **Photo-first layout** | Every built-in recipe has a real food photo. The Plan tab shows a seven-day strip (planned, cooked, skipped and today at a glance) above a large photo card for each night with one-tap **Swap** and **Cook**. Recipes is a two-column photo grid, and each recipe opens on a full-width photo. Photos are openly licensed from Wikimedia Commons and credited under each photo, in **Settings → Photo credits** and in `CREDITS.md`. |
| **Weekly plan** | Generates dinners for your chosen nights. Every meal satisfies *all* selected diets and allergen exclusions, fits your kit (with air-fryer, microwave or hob alternatives where they work), favours your styles and favourites, avoids repeats from the last two weeks, varies proteins and cuisines, and stays under budget (it swaps pricier meals for cheaper matches when needed). A budget meter shows estimated spend, average calories and cost per serving. |
| **Swap, lock, cook, skip** | Swap any night from ranked suggestions that explain why ("uses your spinach", "reuses peppers", "saves £1.80"), or search everything. Lock meals so a new plan keeps them, mark meals cooked (shown clearly on the card), skip nights (removed from the list), change servings per meal, or tell it never to suggest a dish again. Plan this week and up to four weeks ahead. |
| **Shopping list** | One list merged from every planned meal, scaled to servings, rounded up to whole packs and items, minus your pantry, grouped by aisle in your store's typical order, with estimated prices and which nights use each item. Cupboard staples sit in their own "check you have these" section. Tick-off progress, your own extras, a **lock** so menu edits can't change it unexpectedly, and **copy/share as plain text** for any notes or list app. |
| **Recipes** | 45 original weeknight dinners with per-serving quantities (every herb and spice listed with its own amount), step-by-step methods in cooking order, prep and cook times, estimated nutrition (kcal, protein, carbs, fat, fibre), diet labels, cost per serving and kit tips. Servings scale the ingredients. Browse by style or cuisine, search by dish or ingredient, and keep favourites. |
| **Cook mode** | Full-screen steps with large text, one-tap timers detected from each step ("simmer for 8 min"), ingredients on hand, and the screen kept awake while you cook. "Done" marks the meal as cooked. |
| **Pantry** | Add what you have (type, quick-add, or scan with AI). Plans favour those ingredients, especially ones you flag **use soon**, and the shopping list leaves them off. Use "Re-plan around my pantry" to rebuild the week. |
| **AI chef (Gemini)** | Creates new recipes for your exact profile (diet, allergies, kit, effort, budget, pantry) plus an optional request like "something with the leftover rice". Ingredients are mapped onto the library for prices and aisles; ideas that break your filters are discarded. Ideas are saved to My recipes and can go straight into a night. |
| **Fridge scan (Gemini vision)** | Photograph your fridge or cupboard (live camera or upload). Gemini lists the ingredients and flags ones that look like they need using; you review them before they're added to the pantry. |
| **Recipe import (Gemini)** | Photograph a cookbook page or recipe card, or paste a recipe from anywhere. It's converted to per-serving amounts in the app's format and saved to My recipes, ready to plan and shop. |
| **PWA** | Installable with maskable icons and shortcuts (Plan, Shopping, Scan my fridge), offline via a service worker, Android back button closes sheets, light/dark themes. Data stays on the device in IndexedDB, with a localStorage fallback. |

## Project structure

```
larder/
├── index.html              App shell + icon sprite
├── manifest.webmanifest    PWA manifest
├── sw.js                   Service worker (network-first, offline fallback)
├── css/base.css            UI kit: layout, buttons, forms, sheets, toasts, camera
├── css/app.css             Theme tokens (light/dark) + meal-planner components
├── icons/                  App icons (SVG sources + PNG sizes)
├── img/recipes/            45 recipe photos (800×600 JPEG, ~4 MB total)
├── CREDITS.md              Photographer and license for every photo
├── js/
│   ├── app.js              Bootstrap, theme, first-run setup, shortcuts
│   ├── router.js           Hash tabs: #/plan #/shop #/recipes #/pantry
│   ├── store.js            State, persistence, plans, lists, pantry, settings
│   ├── planner.js          Filters, costs, week generation, budget repair, swaps
│   ├── shopping.js         Merged list: packs, pantry, aisles, plain-text export
│   ├── units.js            Metric / US quantities, fractions, currency
│   ├── ai.js               Gemini REST client: AI chef, fridge scan, recipe import
│   ├── db.js · ui.js · pwa.js · utils.js
│   ├── data/
│   │   ├── ingredients.js  ~110 ingredients: aisle, pack size, prices, diet & allergen flags
│   │   ├── recipes.js      Recipe library
│   │   ├── photos.js       Recipe id → photo file, author, license, source page
│   │   └── stores.js       Supermarkets, price index, aisle order
│   └── views/              onboarding, plan, swap, recipe (+ cook mode), shop,
│                           recipes, pantry, ai-flows (camera), settings, common
├── .github/workflows/deploy.yml
└── .nojekyll
```

## Run it locally

Serve the folder (ES modules, the camera and service workers need `http://localhost` or HTTPS):

```bash
python -m http.server 8080
```

```bash
npx serve .
```

Open <http://localhost:8080>. The setup quiz runs on first launch; "Look around first" skips it with sensible defaults.

## Connect Google Gemini (optional)

1. Create a free key at **<https://aistudio.google.com/apikey>**.
2. In Larder go to **Settings → AI (Google Gemini)**, paste the key and tap **Save & test**. Larder checks the key and lists the models available to it.
3. The default model, `gemini-flash-latest`, tracks Google's newest Flash model; if it isn't available to your key, Larder falls back through `gemini-3.8-flash`, `gemini-3.6-flash` and `gemini-3.5-flash`.

The key is stored only in this browser's `localStorage` and sent only to `generativelanguage.googleapis.com` (in the `x-goog-api-key` header). There is no backend. For safety, restrict the key in Google Cloud Console to your site (HTTP referrer `https://<you>.github.io/*`) and to the Generative Language API, and remove it on shared devices. On Google's free tier, prompts and photos may be used to improve Google's products.

## Deploy to GitHub Pages

```bash
cd larder
```

```bash
git init
```

```bash
git add .
```

```bash
git commit -m "Initial commit: Larder meal planner PWA"
```

```bash
git branch -M main
```

```bash
git remote add origin https://github.com/<your-username>/larder.git
```

```bash
git push -u origin main
```

Then in the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**. The included workflow deploys on every push to `main`. (Or choose **Deploy from a branch → main / root** and delete `.github/workflows`.)

The app will be at `https://<your-username>.github.io/larder/`. On a phone: Android Chrome → **Install app**; iPhone Safari → Share → **Add to Home Screen**.

The service worker is network-first, so new deploys show up the next time the app opens online. If you add or rename files, add them to `SHELL` in `sw.js` and bump `VERSION`.

## How estimates work

- **Prices:** each ingredient has a typical pack size and mid-range pack price (GBP and USD), scaled by a per-store price index in `js/data/stores.js`. The weekly estimate counts whole packs of fresh items (so sharing ingredients across meals really does lower it), a proportional share of cupboard staples, and nothing for pantry items. Real prices vary; edit the data files to match your shop.
- **Aisle order:** a typical layout per store type, editable in `stores.js`.
- **Nutrition:** per-serving estimates for each recipe.
- **Allergens:** derived from typical products for each ingredient (e.g. soy sauce contains gluten and soya). Brands differ, so always check labels. AI-created recipes are re-checked against your filters, but treat them with the same care.

## Data & privacy

Everything (profile, plans, lists, pantry, favourites, your recipes) stays on the device. Back up or move devices with **Settings → Export backup** and **Restore backup**. Network requests only go to Google Gemini, and only when you use an AI feature. There's no analytics or tracking.

## Customise

- **Recipes:** add objects to `js/data/recipes.js` (quantities per serving, using ingredient ids from `ingredients.js`). Diet labels, allergens, costs and the shopping list are all derived automatically.
- **Photos:** save a 4:3 JPEG (800×600 works well) to `img/recipes/<recipe-id>.jpg`, add an entry with its author and license to `js/data/photos.js` and a row to `CREDITS.md`, then add the file to `PHOTOS` in `sw.js` and bump `VERSION`. Recipes without a photo (including AI-created and imported ones) show a coloured emoji tile instead.
- **Ingredients & prices:** `js/data/ingredients.js`. **Stores:** `js/data/stores.js`.
- **Theme:** tokens at the top of `css/app.css`. **Icons:** `icons/icon.svg`, `icons/maskable.svg`.
- **AI prompts and schemas:** `js/ai.js`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "No recipes match all of your preferences" | Too many filters combined (e.g. vegan + gluten-free + no hob). Relax one in Settings, or use the AI chef. |
| Plan is over budget | Swap the priciest meal (suggestions show savings), skip a night, or choose a budget supermarket. |
| Camera doesn't start | Allow camera access and use HTTPS or localhost; otherwise use **Choose photo**. |
| "That API key isn't valid" / "restricted" | Re-copy the key, or add your Pages URL to the key's allowed referrers. |
| "Rate limit or quota reached" | Wait a minute; free-tier limits reset quickly. |

## License

Add a license of your choice for the code before publishing.

The photos in `img/recipes/` are **not** covered by that license. Each one keeps its own Creative Commons or public-domain license, listed in `CREDITS.md`. CC BY and CC BY-SA photos require the credit to stay visible, so keep the credit line under each photo and the Photo credits screen if you redistribute the app. Don't replace them with photos from other apps or stores unless you have the rights.
