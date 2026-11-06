// Shared bits for rendering recipes consistently across views.
import { state } from '../store.js';
import { PHOTOS } from '../data/photos.js';
import { html, raw } from '../utils.js';
import { icon } from '../ui.js';
import { totalTime, servingCost } from '../planner.js';
import { fmtMoney } from '../units.js';

const HUES = { Mexican: 22, Spanish: 12, Italian: 8, Indian: 38, Thai: 95, Chinese: 0, Japanese: 350, Asian: 340, British: 30, 'Middle Eastern': 45, Greek: 200, European: 28, American: 15 };
export function hueFor(r) {
  if (HUES[r.cuisine] != null) return HUES[r.cuisine];
  let h = 0;
  for (const c of String(r.cuisine || r.name)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export const photoFor = (r) => PHOTOS[r?.id] || null;

// Recipe image: the bundled photo when there is one, otherwise an emoji tile
// (AI-created and imported recipes). size: '' | 'sm' | 'md' | 'lg' | 'cover'
export function tile(r, size = '') {
  const p = photoFor(r);
  if (p) return html`<img class="photo ${size}" src="${p.src}" alt="${r.name}" loading="lazy" decoding="async" width="800" height="600">`;
  return html`<span class="tile-emoji ${size}" style="--h:${hueFor(r)}" role="img" aria-label="${r.name}">${r.emoji || '🍽️'}</span>`;
}

export function photoCredit(r) {
  const p = photoFor(r);
  if (!p) return '';
  return html`<p class="photo-credit">Photo: <a href="${p.page}" target="_blank" rel="noopener">${p.author}</a>${p.licenseUrl ? html`, <a href="${p.licenseUrl}" target="_blank" rel="noopener">${p.license}</a>` : html`, ${p.license}`}, via Wikimedia Commons</p>`;
}

export function fmtTime(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function metaLine(r, { cost = true } = {}) {
  return html`<div class="meta-line">
    <span>${icon('clock')}${fmtTime(totalTime(r))}</span>
    ${r.n?.kcal ? html`<span>${icon('flame')}${r.n.kcal} kcal</span>` : ''}
    ${cost ? html`<span>${icon('wallet')}${fmtMoney(servingCost(r), state.profile.region)}/serving</span>` : ''}
  </div>`;
}

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const heartIcon = (on) => raw(`<svg class="i" aria-hidden="true" style="${on ? 'fill:currentColor' : ''}"><use href="#i-heart"/></svg>`);
