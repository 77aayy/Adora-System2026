/**
 * Sync missing root namespaces from en to hi and bn so all 4 locales have same structure.
 * Run once: node scripts/sync-locale-missing-roots.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOCALES = path.join(ROOT, 'src', 'locales');

const MISSING_ROOTS = [
  'aboutUs', 'billing', 'chatSettings', 'demoLink', 'emergencyAlerts',
  'goldenAlert', 'guestMessaging', 'healthReport', 'owner', 'pricing', 'system'
];

function load(name) {
  const p = path.join(LOCALES, name);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function save(name, data) {
  const p = path.join(LOCALES, name);
  fs.writeFileSync(p, JSON.stringify(data, null, 4), 'utf8');
}

const en = load('en.json');
let hi = load('hi.json');
let bn = load('bn.json');

let addedHi = 0, addedBn = 0;
for (const k of MISSING_ROOTS) {
  if (!(k in hi) && k in en) {
    hi[k] = en[k];
    addedHi++;
  }
  if (!(k in bn) && k in en) {
    bn[k] = en[k];
    addedBn++;
  }
}

save('hi.json', hi);
save('bn.json', bn);
console.log('Synced missing roots from en: hi +' + addedHi + ', bn +' + addedBn);
