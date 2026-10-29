// Static/pure UI and fixture checks only. No app boot, HTTP requests or Prisma client.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../apps/web/node_modules/typescript');
const React = require('../apps/web/node_modules/react');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let checks = 0;
function check(name, fn) { fn(); checks++; console.log('PASS ' + name); }
function load(file, imports) {
  const result = { exports: {} };
  const js = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(js, { exports: result.exports, module: result, require: (name) => {
    if (name in imports) return imports[name];
    throw Error('Unexpected import (no I/O allowed): ' + name);
  } }, { filename: file });
  return result.exports;
}
const { scheduleError } = load('apps/web/src/lib/sessionSchedule.ts', {});
const now = Date.parse('2026-10-29T00:00:00Z');
const plan = { startDate: '2026-10-30T00:00:00Z', endDate: '2026-11-02T00:00:00Z' };
for (const [at, expected] of [
  ['invalid', 'session.invalidDate'], ['2026-10-28T08:00:00Z', 'hai.pastTime'],
  ['2026-10-29T16:59:59Z', 'hai.planDates'], ['2026-10-29T17:00:00Z', null],
  ['2026-11-02T08:00:00Z', null], ['2026-11-02T16:59:59Z', null], ['2026-11-02T17:00:00Z', 'hai.planDates'],
]) check('frontend date validation ' + at, () => assert.equal(scheduleError(at, plan, now), expected));
check('open-ended frontend plan', () => assert.equal(scheduleError('2027-01-01T10:00:00Z', { ...plan, endDate: null }, now), null));

function flatten(d, p = '', result = {}) { for (const [k, v] of Object.entries(d)) typeof v === 'string' ? result[p + k] = v : flatten(v, p + k + '.', result); return result; }
const en = JSON.parse(read('apps/web/src/i18n/en.json')), vi = JSON.parse(read('apps/web/src/i18n/vi.json'));
const flat = flatten(en);
check('EN/VI parity and JSON duplicate keys', () => {
  assert.deepEqual(Object.keys(flat).sort(), Object.keys(flatten(vi)).sort());
  for (const lang of ['en', 'vi']) {
    const json = ts.parseJsonText(lang, read('apps/web/src/i18n/' + lang + '.json'));
    function visit(n) { if (ts.isObjectLiteralExpression(n)) { const keys = n.properties.map((p) => p.name.text); assert.equal(new Set(keys).size, keys.length); } ts.forEachChild(n, visit); } visit(json);
  }
});
check('all literal translation calls exist', () => {
  function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name); if (entry.isDirectory()) { walk(p); continue; } if (!/\.tsx?$/.test(p)) continue;
    const source = ts.createSourceFile(p, fs.readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(n) { if (ts.isCallExpression(n) && /^(i18n\.)?t$/.test(n.expression.getText(source)) && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) assert.ok(n.arguments[0].text in flat, p + ': ' + n.arguments[0].text); ts.forEachChild(n, visit); } visit(source);
  } } walk(path.join(root, 'apps/web/src'));
});

let language = 'en';
const i18n = { t: (key) => (language === 'en' ? flat : flatten(vi))[key] ?? key };
const regions = JSON.parse(read('shared/injury-regions.json'));
const charts = load('apps/web/src/ds/charts.tsx', {
  '../../../../shared/injury-regions.json': regions,
  react: { ...React, useState: (value) => [value, () => {}] },
  'react/jsx-runtime': require('../apps/web/node_modules/react/jsx-runtime'),
  'react-i18next': { useTranslation: () => ({ t: i18n.t }) },
  '../i18n': i18n, './ui': { Tip: () => null }, './hai.css': {},
});
function elements(tree, result = []) {
  if (Array.isArray(tree)) { tree.forEach((n) => elements(n, result)); return result; }
  if (!tree || typeof tree !== 'object') return result;
  result.push(tree); elements(tree.props?.children, result); return result;
}
check('12 body regions: click, Enter and Space select canonical keys', () => {
  let selected = null;
  const nodes = elements(charts.HorseMap({ onZone: (key) => { selected = key; }, zone: 'head' }));
  const buttons = nodes.filter((n) => n.props?.role === 'button');
  assert.equal(buttons.length, 12);
  buttons.forEach((b, i) => {
    assert.equal(b.props.tabIndex, 0); b.props.onClick(); assert.equal(selected, regions[i].key);
    for (const key of ['Enter', ' ']) { selected = null; b.props.onKeyDown({ key, preventDefault() {} }); assert.equal(selected, regions[i].key); }
    assert.ok(b.props['aria-label']);
  });
  assert.equal(buttons[0].props['aria-pressed'], true);
});
check('body-map labels translate without changing canonical data; legacy text survives', () => {
  language = 'en'; const english = charts.bodyZoneLabel(regions[0]);
  language = 'vi'; const vietnamese = charts.bodyZoneLabel(regions[0]);
  assert.notEqual(english, vietnamese); assert.equal(regions[0].name, vietnamese);
  assert.equal(charts.bodyZoneLabel({ key: 'old', name: 'legacy/custom' }), 'legacy/custom');
  assert.equal(elements(charts.HorseMap({ readOnly: true, zone: 'head' })).filter((n) => n.props?.role === 'button').length, 0);
});

const dataModule = load('apps/api/scripts/hai-demo-data.ts', {
  'node:crypto': require('node:crypto'), '@prisma/client': { Role: { MANAGER: 'MANAGER', TRAINER: 'TRAINER', VET: 'VET', GROOM: 'GROOM', OWNER: 'OWNER' } }, '../../../shared/injury-regions.json': regions,
});
const data = dataModule.buildHaiDemo('2026-10-29');
check('fixture IDs and payloads deterministic, unique, realistic names', () => {
  assert.equal(JSON.stringify(data), JSON.stringify(dataModule.buildHaiDemo('2026-10-29')));
  const rows = Object.values(data).flat(); assert.equal(new Set(rows.map((r) => r.id)).size, rows.length);
  for (const r of [...data.horses, ...data.users]) assert.ok(!/DEMO|TEST|FLOW|SAMPLE/i.test(r.name));
});
check('fixtures cover pagination, four statuses, groom and body locations', () => {
  assert.ok(data.horses.length > 100);
  assert.ok(data.records.filter((r) => r.horseId === data.horses[0].id).length > 100);
  assert.ok(data.sessions.filter((r) => r.horseId === data.horses[0].id).length > 20);
  assert.equal(new Set(data.sessions.map((s) => s.status)).size, 4);
  for (const s of data.sessions) assert.equal(s.groomId, data.users[3].id);
  for (const i of data.injuries) assert.ok(regions.some((r) => r.key === i.bodyRegion));
});
check('seed is insert-only; cleanup deletes only filtered Notification rows', () => {
  const seed = read('apps/api/scripts/seed-hai-demo.ts');
  assert.ok(!/\.(update|updateMany|upsert|delete|deleteMany)\s*\(/.test(seed));
  assert.ok(!/\.notification\./.test(seed));
  assert.ok(seed.includes('Serializable'));
  const cleanup = read('apps/api/scripts/cleanup-e2e-notifications.ts');
  assert.ok(cleanup.includes("contains: 'E2E', mode: 'default'"));
  assert.ok(cleanup.includes("process.argv.includes('--execute')"));
  assert.equal((cleanup.match(/\.deleteMany\(/g) ?? []).length, 1);
  assert.ok(cleanup.includes('tx.notification.deleteMany({ where })'));
});
check('body-map selected value survives rerender and writes stable key', () => {
  const selected = regions[5].key;
  for (let render = 0; render < 2; render++) {
    const buttons = elements(charts.HorseMap({ zone: selected, onZone() {} })).filter((n) => n.props?.role === 'button');
    assert.equal(buttons.filter((b) => b.props['aria-pressed']).length, 1);
    assert.equal(buttons[5].props['aria-pressed'], true);
  }
  const injury = read('apps/web/src/components/health/InjuryLocationsSection.tsx');
  assert.ok(injury.includes('bodyRegion: zone.key'));
  assert.ok(injury.includes('z.key === item.bodyRegion || z.name === item.bodyRegion'));
});
const { Pagination } = load('apps/web/src/components/Pagination.tsx', {
  'react-i18next': { useTranslation: () => ({ t: (key, options) => key + JSON.stringify(options ?? {}) }) },
  'react/jsx-runtime': require('../apps/web/node_modules/react/jsx-runtime'), '../ds/ui': { Btn: () => null },
});
check('pagination exposes page six / row 101 and usable first/last boundaries', () => {
  let page = 1;
  for (const current of [1, 5, 6, 99]) {
    const buttons = elements(Pagination({ page: current, total: 105, onPage: (n) => { page = n; } })).filter((n) => n.props?.onClick);
    const previous = buttons[0], next = buttons.at(-1);
    assert.equal(previous.props.disabled, current === 1);
    assert.equal(next.props.disabled, current >= 6);
    const first = buttons.find((b) => b.props.children === 1); first.props.onClick(); assert.equal(page, 1);
    const last = buttons.find((b) => b.props.children === 6); last.props.onClick(); assert.equal(page, 6);
  }
});
check('session/health pages request one server page, progress remains separate', () => {
  for (const file of ['pages/horse/SessionsTab.tsx', 'pages/horse/HealthTab.tsx', 'pages/HealthRecordsPage.tsx']) assert.ok(read('apps/web/src/' + file).includes('usePagedResource'));
  const hook = read('apps/web/src/lib/usePagedResource.ts'); assert.ok(hook.includes('limit: 20')); assert.ok(hook.includes('controller.abort()')); assert.ok(!hook.includes('while ('));
  const sessions = read('apps/web/src/pages/horse/SessionsTab.tsx'); assert.ok(sessions.includes('setFilter(e.target.value); setPage(1)'));
  assert.ok(read('apps/web/src/pages/horse/TrainingProgressTab.tsx').includes('const decided = done + cancelled'));
});
console.log(checks + ' offline checks passed. No database/network used; seed and cleanup entrypoints were not executed.');
