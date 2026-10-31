import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';
import { createServer } from 'vite';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError } from 'axios';

const storage = new Map([['racehorse.lang', 'en']]);
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
globalThis.document = { documentElement: { lang: '' } };
const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
after(async () => {
  await vite.close();
  delete globalThis.localStorage;
  delete globalThis.document;
});
const load = path => vite.ssrLoadModule(`/src/${path}`);
const { default: i18n, setLanguage, getLocale } = await load('i18n/index.ts');
const { AuthContext } = await load('auth/context.ts');
const ui = await load('ds/ui.tsx');
const { AuthLayout } = await load('ds/AuthLayout.tsx');
const { AppShell } = await load('ds/AppShell.tsx');
const { HorsesPage } = await load('pages/HorsesPage.tsx');
const { DashboardPage } = await load('pages/DashboardPage.tsx');
const { ErrorText } = await load('components/ErrorText.tsx');
const { BODY_ZONES, bodyZoneLabel } = await load('ds/charts.tsx');
const format = await load('lib/format.ts');

const auth = {
  user: { id: 'test', name: 'Test Manager', role: 'MANAGER' }, loading: false,
  login: async () => {}, loginWithGoogle: async () => {}, logout: async () => {},
};
const render = element => renderToStaticMarkup(h(MemoryRouter, null, h(AuthContext.Provider, { value: auth }, element)));
const visibleText = html => html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&');

test('restores the saved language, persists changes and updates the HTML language', async () => {
  assert.equal(i18n.resolvedLanguage, 'en');
  assert.equal(document.documentElement.lang, 'en');
  setLanguage('vi');
  assert.equal(storage.get('racehorse.lang'), 'vi');
  assert.equal(document.documentElement.lang, 'vi');
  assert.equal(getLocale(), 'vi-VN');
  await i18n.changeLanguage('en');
  assert.equal(storage.get('racehorse.lang'), 'en');
  assert.equal(getLocale(), 'en-GB');
});

test('both dictionaries have matching keys and interpolation variables', () => {
  const read = lang => JSON.parse(readFileSync(new URL(`../src/i18n/${lang}.json`, import.meta.url), 'utf8'));
  const flatten = (obj, prefix = '') => Object.fromEntries(Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'string' ? [[`${prefix}${k}`, v]] : Object.entries(flatten(v, `${prefix}${k}.`))));
  const vi = flatten(read('vi')), en = flatten(read('en'));
  assert.deepEqual(Object.keys(vi).sort(), Object.keys(en).sort());
  for (const key of Object.keys(vi)) {
    const variables = value => [...value.matchAll(/{{\s*([^}]+)\s*}}/g)].map(m => m[1]).sort();
    assert.deepEqual(variables(vi[key]), variables(en[key]), key);
    assert.ok(en[key].trim(), key);
  }
});

test('every literal translation key used in the UI exists in both languages', () => {
  const walk = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    return entry.isDirectory() ? walk(file) : [file];
  });
  for (const file of walk(new URL('../src/', import.meta.url)).filter(file => /\.tsx?$/.test(file.pathname))) {
    const source = ts.createSourceFile(file.pathname, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = node => {
      if (ts.isCallExpression(node) && /^(?:t|i18n\.t)$/.test(node.expression.getText(source)) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        for (const lng of ['vi', 'en']) {
          assert.ok(i18n.exists(node.arguments[0].text, { lng, fallbackLng: false }), `${lng}: ${node.arguments[0].text} in ${file.pathname}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
});

test('auth, navigation, horse list and dashboard translate on repeated language changes', async () => {
  for (const language of ['en', 'vi', 'en']) {
    await i18n.changeLanguage(language);
    const shell = visibleText(render(h(AppShell, null, h(HorsesPage))));
    const dashboard = visibleText(render(h(DashboardPage)));
    const login = visibleText(render(h(AuthLayout, { title: i18n.t('auth.login') }, '')));
    if (language === 'en') {
      assert.match(shell, /Horses/);
      assert.match(shell, /Notifications/);
      assert.match(dashboard, /Ready to train today/);
      assert.match(login, /Manage & train/);
      assert.doesNotMatch(shell + dashboard + login, /[\u00c0-\u1ef9]/u);
    } else {
      assert.match(shell, /Ngựa đua/);
      assert.match(dashboard, /Sẵn sàng tập hôm nay/);
      assert.match(login, /Quản lý & huấn luyện/);
    }
    assert.doesNotMatch(shell + dashboard + login, /ui\.[a-zA-Z]|{{v\d}}/);
  }
});

test('health badges and body labels change language without changing stored injury regions', async () => {
  const storedNames = BODY_ZONES.map(z => z.name);
  await i18n.changeLanguage('en');
  assert.match(render(h(ui.HealthBadge, { status: 'INJURED' })), /Injured/);
  assert.equal(bodyZoneLabel(BODY_ZONES[0]), 'Head');
  await i18n.changeLanguage('vi');
  assert.match(render(h(ui.HealthBadge, { status: 'INJURED' })), /Chấn thương/);
  assert.equal(bodyZoneLabel(BODY_ZONES[0]), 'Đầu');
  assert.deepEqual(BODY_ZONES.map(z => z.name), storedNames);
});

test('English errors preserve local validation and translate Vietnamese server errors', async () => {
  await i18n.changeLanguage('en');
  assert.match(render(h(ErrorText, { err: new Error('Please select a horse.') })), /Please select a horse/);
  const err = new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 409, data: { error: { code: 'CONFLICT', message: 'Trùng lịch tập' } },
  });
  assert.match(render(h(ErrorText, { err })), /Conflicts with existing data/);
  await i18n.changeLanguage('vi');
  assert.match(render(h(ErrorText, { err })), /Trùng lịch tập/);
});

test('formatting keeps Vietnam timezone and date input values in both languages', async () => {
  for (const language of ['vi', 'en']) {
    await i18n.changeLanguage(language);
    const iso = '2026-10-26T18:05:00Z';
    assert.equal(format.formatDate(iso), '27/10/2026');
    assert.equal(format.formatTime(iso), '01:05');
    assert.equal(format.toDateInput(iso), '2026-10-27');
    assert.equal(format.formatDate('invalid'), '—');
    assert.equal(format.formatDateTime(null), '—');
    assert.equal(format.toDateInput('invalid'), '');
  }
});
