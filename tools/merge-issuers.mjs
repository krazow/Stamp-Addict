// Merges data/issuers/*.json (one file per region) into
// docs/js/data/issuers.json, checking every entry and removing duplicates.
// Run: node tools/merge-issuers.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const DIR = new URL('../data/issuers/', import.meta.url);
const OUT = new URL('../docs/js/data/issuers.json', import.meta.url);
const KEYS = ['id', 'name', 'aliases', 'type', 'region', 'subregion', 'from', 'to', 'parent', 'successor', 'catalog', 'notes'];
const TYPES = ['country', 'colony', 'territory', 'protectorate', 'mandate', 'occupation', 'city_state', 'princely_state', 'state', 'local', 'agency', 'other'];
const SUB = {
  Americas: ['North America', 'Central America', 'Caribbean', 'South America'],
  Europe: ['Western Europe', 'Northern Europe', 'Central Europe', 'Eastern Europe', 'Southern Europe'],
  Africa: ['North Africa', 'West Africa', 'Central Africa', 'East Africa', 'Southern Africa', 'Indian Ocean'],
  Asia: ['Middle East', 'Central Asia', 'South Asia', 'East Asia', 'Southeast Asia'],
  Oceania: ['Oceania'], 'Atlantic & Antarctic': ['Atlantic', 'Antarctic'], International: ['International'],
};
const CATALOGS = ['scott', 'stanley_gibbons', 'michel', 'yvert_tellier', 'sakura', 'facit', 'unitrade', 'acsc', 'zumstein', 'edifil', 'sassone', 'nvph', 'afa', 'fischer', 'ank', 'hellas', 'zagorski', 'pofis', 'rhm', 'gj', 'cob', 'other'];
// Catalogue choices settled after the region lists were made.
const CATALOG_OVERRIDES = {
  belgium: 'cob', 'congo-free-state': 'cob', 'belgian-congo': 'cob', 'ruanda-urundi': 'cob',
  'belgian-occupation-german-east-africa': 'cob', 'belgian-occupation-germany': 'cob',
};
// Region fixes settled after the region lists were made.
const PLACE_OVERRIDES = { bermuda: ['Americas', 'North America'] };
const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const problems = [];
const fixed = [];
const byId = new Map();
const byName = new Map();
const perFile = {};

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()) {
  let list;
  try { list = JSON.parse(readFileSync(new URL(file, DIR), 'utf8')); } catch (e) { problems.push(`${file}: not valid JSON (${e.message})`); continue; }
  perFile[file] = list.length;
  for (const raw of list) {
    const e = Object.fromEntries(KEYS.map((k) => [k, raw[k] ?? (k === 'aliases' ? [] : null)]));
    const where = `${file}: ${e.id ?? e.name}`;
    if (!e.id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.id)) { problems.push(`${where}: bad id`); continue; }
    if (!e.name) { problems.push(`${where}: no name`); continue; }
    if (!TYPES.includes(e.type)) { fixed.push(`${where}: type ${e.type} -> other`); e.type = 'other'; }
    if (PLACE_OVERRIDES[e.id]) [e.region, e.subregion] = PLACE_OVERRIDES[e.id];
    if (e.region === 'Polar' || e.region === 'Atlantic' || e.region === 'Antarctic') e.region = 'Atlantic & Antarctic';
    if (!SUB[e.region]) { problems.push(`${where}: bad region ${e.region}`); continue; }
    if (!SUB[e.region].includes(e.subregion)) {
      const home = Object.entries(SUB).find(([, subs]) => subs.includes(e.subregion));
      if (home) { fixed.push(`${where}: region ${e.region} -> ${home[0]} (to match ${e.subregion})`); e.region = home[0]; }
      else { fixed.push(`${where}: subregion ${e.subregion} -> ${SUB[e.region][0]}`); e.subregion = SUB[e.region][0]; }
    }
    if (CATALOG_OVERRIDES[e.id]) e.catalog = CATALOG_OVERRIDES[e.id];
    if (!CATALOGS.includes(e.catalog)) { fixed.push(`${where}: catalog ${e.catalog} -> scott`); e.catalog = 'scott'; }
    for (const k of ['from', 'to']) {
      if (e[k] !== null && (!Number.isInteger(e[k]) || e[k] < 1840 || e[k] > 2026)) { fixed.push(`${where}: ${k} ${e[k]} -> null`); e[k] = null; }
    }
    if (e.from && e.to && e.to < e.from) { fixed.push(`${where}: to before from, swapped`); [e.from, e.to] = [e.to, e.from]; }
    e.aliases = [...new Set((Array.isArray(e.aliases) ? e.aliases : []).map(String).map((a) => a.trim()).filter((a) => a && fold(a) !== fold(e.name)))].slice(0, 8);

    const dupe = byId.get(e.id) ?? byName.get(`${fold(e.name)}|${e.from ?? ''}`);
    if (dupe) {
      // Same issuer from two regions' files: keep the first, add any new names.
      dupe.aliases = [...new Set([...dupe.aliases, ...e.aliases, ...(fold(e.name) !== fold(dupe.name) ? [e.name] : [])])].slice(0, 8);
      fixed.push(`${where}: duplicate of ${dupe.id}, merged`);
      continue;
    }
    byId.set(e.id, e);
    byName.set(`${fold(e.name)}|${e.from ?? ''}`, e);
  }
}

const all = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
// Same name used twice (e.g. two eras): make sure people can tell them apart.
const names = new Map();
for (const e of all) names.set(fold(e.name), (names.get(fold(e.name)) ?? 0) + 1);
const sameName = all.filter((e) => names.get(fold(e.name)) > 1).map((e) => `${e.name} (${e.id}, ${e.from ?? '?'}–${e.to ?? ''})`);
const known = new Set(all.flatMap((e) => [fold(e.name), ...e.aliases.map(fold)]));
const unresolved = all.filter((e) => e.successor && !known.has(fold(e.successor))).map((e) => `${e.name} -> ${e.successor}`);

writeFileSync(OUT, '[\n' + all.map((e) => JSON.stringify(e)).join(',\n') + '\n]\n');
const count = (k) => Object.entries(all.reduce((m, e) => ({ ...m, [e[k]]: (m[e[k]] ?? 0) + 1 }), {})).map(([a, b]) => `${a} ${b}`).join(', ');
console.log(`Files: ${JSON.stringify(perFile)}`);
console.log(`Merged: ${all.length} issuers`);
console.log(`By region: ${count('region')}`);
console.log(`By type: ${count('type')}`);
console.log(`Problems (skipped): ${problems.length}`); problems.forEach((p) => console.log('  ' + p));
console.log(`Fixed: ${fixed.length}`); fixed.slice(0, 60).forEach((p) => console.log('  ' + p));
console.log(`Same name, different entries: ${sameName.length}`); sameName.slice(0, 30).forEach((p) => console.log('  ' + p));
console.log(`Successors not in the list: ${unresolved.length}`); unresolved.slice(0, 40).forEach((p) => console.log('  ' + p));
