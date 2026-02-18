/**
 * Translation Audit Script
 * Extracts t('...') keys from src/, compares with ar/en/hi/bn locale files, outputs gap table.
 * Usage: node scripts/translation-audit.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const LOCALES_DIR = path.join(ROOT, 'src', 'locales');
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const LOCALE_FILES = ['ar.json', 'en.json', 'hi.json', 'bn.json'];
const LANG_CODES = ['ar', 'en', 'hi', 'bn'];

// Regex: t('key') or t("key") or t(`key`) — capture first argument only
const T_KEY_REGEX = /t\s*\(\s*['"`]([^'"`]+)['"`]/g;

/**
 * Recursively list files under dir with given extensions.
 */
function listFiles(dir, exts, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && e.name !== '.git') listFiles(full, exts, files);
    } else if (exts.has(path.extname(e.name))) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Extract translation keys from file content. Returns [{ key, file, line }].
 */
function extractKeys(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const results = [];
  const seenInFile = new Set();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    T_KEY_REGEX.lastIndex = 0;
    while ((m = T_KEY_REGEX.exec(line)) !== null) {
      const key = m[1].trim();
      if (!key || key.includes(' ')) continue;
      // Skip path-like or non-i18n keys (e.g. import paths, template vars, CSS)
      if (key.includes('/') || key.startsWith('..') || key.startsWith('.') || key.includes('${') || key.length <= 2) continue;
      if (!key.includes('.')) continue; // expect namespace.key
      if (!seenInFile.has(key)) {
        seenInFile.add(key);
        results.push({ key, file: path.relative(ROOT, filePath), line: i + 1 });
      }
    }
  }
  return results;
}

/**
 * Flatten nested object to dot keys. Only leaf values (string/number/boolean) get a key.
 */
function flatten(obj, prefix = '', out = {}) {
  if (obj === null || obj === undefined) return out;
  if (typeof obj !== 'object') {
    out[prefix] = obj;
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && (typeof v !== 'object' || Object.keys(v).length === 0 || typeof Object.values(v)[0] === 'object')) {
      const hasStringLeaf = JSON.stringify(v).match(/"[^"]*"/);
      if (hasStringLeaf || typeof Object.values(v)[0] !== 'object') {
        flatten(v, next, out);
      } else {
        flatten(v, next, out);
      }
    } else {
      out[next] = v;
    }
  }
  return out;
}

/** Simpler flatten: any path that leads to a non-object value gets the key. */
function flattenLeaves(obj, prefix = '', out = {}) {
  if (obj === null || obj === undefined) return out;
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    out[prefix] = obj;
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      flattenLeaves(v, next, out);
    } else {
      out[next] = v;
    }
  }
  return out;
}

function loadLocale(lang) {
  const p = path.join(LOCALES_DIR, `${lang}.json`);
  if (!fs.existsSync(p)) return {};
  const raw = fs.readFileSync(p, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Failed to parse ${p}:`, e.message);
    return {};
  }
}

function main() {
  const allOccurrences = [];
  const files = listFiles(SRC_DIR, EXTENSIONS);
  for (const f of files) {
    const hits = extractKeys(f);
    allOccurrences.push(...hits);
  }

  // Unique keys with one occurrence (file:line) for table
  const keyToFirst = new Map();
  for (const { key, file, line } of allOccurrences) {
    if (!keyToFirst.has(key)) keyToFirst.set(key, { file, line });
  }
  const keys = [...keyToFirst.keys()].sort();

  const flattened = {};
  for (const lang of LANG_CODES) {
    flattened[lang] = flattenLeaves(loadLocale(lang));
  }

  const rows = [];
  const missingByLang = { ar: 0, en: 0, hi: 0, bn: 0 };
  for (const key of keys) {
    const occ = keyToFirst.get(key);
    const fileLine = `${occ.file}:${occ.line}`;
    const status = {};
    for (const lang of LANG_CODES) {
      const has = key in flattened[lang];
      status[lang] = has ? 'OK' : 'MISSING';
      if (!has) missingByLang[lang]++;
    }
    rows.push({ key, fileLine, ...status });
  }

  const tableLines = [
    '| Key | File:Line | ar | en | hi | bn |',
    '|-----|-----------|----|----|-----|-----|'
  ];
  for (const r of rows) {
    tableLines.push(`| ${r.key} | ${r.fileLine} | ${r.ar} | ${r.en} | ${r.hi} | ${r.bn} |`);
  }

  const reportMd = [
    '# Translation Gaps Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Total keys used in src: ${keys.length}`,
    '',
    '## Summary (missing count per language)',
    '',
    `| Language | Missing |`,
    `|----------|---------|`,
    `| ar | ${missingByLang.ar} |`,
    `| en | ${missingByLang.en} |`,
    `| hi | ${missingByLang.hi} |`,
    `| bn | ${missingByLang.bn} |`,
    '',
    '## Table (Key | File:Line | ar | en | hi | bn)',
    '',
    ...tableLines,
    ''
  ].join('\n');

  const reportPath = path.join(__dirname, 'translation-gaps-report.md');
  fs.writeFileSync(reportPath, reportMd, 'utf8');

  console.log('Translation audit done.');
  console.log(`Total keys: ${keys.length}`);
  console.log('Missing per language:', missingByLang);
  console.log(`Report written to: ${path.relative(ROOT, reportPath)}`);
  console.log('\n--- Table (first 30 rows) ---\n');
  console.log(tableLines.slice(0, 32).join('\n'));
}

main();
