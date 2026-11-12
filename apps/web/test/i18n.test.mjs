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
const { TrainingPlansPage } = await load('pages/TrainingPlansPage.tsx');
const { HealthRecordsPage } = await load('pages/HealthRecordsPage.tsx');
const { HealthSchedulePage } = await load('pages/HealthSchedulePage.tsx');
const { IncidentsPage } = await load('pages/IncidentsPage.tsx');
const { FeedingTab } = await load('pages/horse/FeedingTab.tsx');
const { TrialVideosTab } = await load('pages/horse/TrialVideosTab.tsx');
const { TrialVideoPlayer } = await load('components/horse/TrialVideoPlayer.tsx');
const { trialVideoSource } = await load('lib/trialVideo.ts');
const { setCached } = await load('lib/dataCache.ts');
const { ErrorText } = await load('components/ErrorText.tsx');
const { BODY_ZONES, bodyZoneLabel } = await load('ds/charts.tsx');
const format = await load('lib/format.ts');

const auth = {
  user: { id: 'test', name: 'Test Manager', role: 'MANAGER' }, loading: false,
  login: async () => {}, loginWithGoogle: async () => {}, logout: async () => {},
};
const render = (element, role = 'MANAGER') => renderToStaticMarkup(h(MemoryRouter, null,
  h(AuthContext.Provider, { value: { ...auth, user: { ...auth.user, role } } }, element)));
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
      if (ts.isCallExpression(node) && /^(?:t|translate|i18n\.t)$/.test(node.expression.getText(source)) && node.arguments[0]) {
        const check = argument => {
          if (ts.isStringLiteral(argument)) {
            for (const lng of ['vi', 'en']) {
              assert.ok(i18n.exists(argument.text, { lng, fallbackLng: false }), `${lng}: ${argument.text} in ${file.pathname}`);
            }
          } else if (ts.isConditionalExpression(argument)) {
            check(argument.whenTrue);
            check(argument.whenFalse);
          }
        };
        check(node.arguments[0]);
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
    const login = visibleText(render(h(AuthLayout, { title: i18n.t('auth.login'), eyebrow: i18n.t('auth.portalEyebrow') }, '')));
    if (language === 'en') {
      assert.match(shell, /Horses/);
      assert.match(shell, /Notifications/);
      assert.match(dashboard, /Ready to train today/);
      assert.match(login, /Management & Training/);
      assert.doesNotMatch(shell + dashboard + login, /[À-ỹ]/u);
    } else {
      assert.match(shell, /Ngựa đua/);
      assert.match(dashboard, /Sẵn sàng tập hôm nay/);
      assert.match(login, /Quản lý & huấn luyện/);
    }
    assert.doesNotMatch(shell + dashboard + login, /ui\.[a-zA-Z]|{{v\d}}/);
  }
});

test('all roles translate their dashboard actions, training and care screens on repeated switches', async () => {
  const horse = { id: 'horse-test', name: 'Thunder', healthStatus: 'FIT', status: 'ACTIVE', locked: false };
  for (const role of ['MANAGER', 'TRAINER', 'VET', 'GROOM', 'OWNER']) {
    for (const language of ['en', 'vi', 'en']) {
      setLanguage(language);
      const elements = [h(AppShell, null, h(DashboardPage)), h(TrainingPlansPage),
        h(FeedingTab, { horse })];
      if (role === 'VET') elements.push(h(HealthRecordsPage));
      if (role !== 'OWNER') elements.push(h(HealthSchedulePage), h(IncidentsPage));
      const html = elements.map(element => render(element, role)).join('');
      const content = visibleText(html);
      const actions = { MANAGER: ['Approve accounts', 'Duyệt tài khoản'], TRAINER: ['New training plan', 'Lập giáo án mới'], VET: ['New health record', 'Ghi hồ sơ khám bệnh'], GROOM: ['Report incident', 'Báo sự cố tại chuồng'], OWNER: ['My horses', 'Ngựa của tôi'] };
      assert.ok(content.includes(actions[role][language === 'en' ? 0 : 1]), `${role}/${language}: role action`);
      assert.ok(content.includes(i18n.t('plansPage.title')), `${role}/${language}: training title`);
      assert.doesNotMatch(html, /(?:dashboard|trainingPage|trainingPlanModal|healthRecordModal|healthRecordsPage|feedingTab|horsePage|language|common)\.[a-zA-Z]|{{[^}]+}}/);
      if (language === 'en') assert.doesNotMatch(content, /[À-ỹ]/u, role);
      assert.ok(html.includes(language === 'en' ? 'Switch to Tiếng Việt' : 'Chuyển sang English'));
    }
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
  assert.match(render(h(ErrorText, { err })), /Training schedule conflict/);
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

test('trial videos resolve YouTube and Vimeo page links to in-page players', () => {
  for (const url of [
    'https://www.youtube.com/watch?v=M7lc1UVf-VE&feature=shared',
    'https://youtu.be/M7lc1UVf-VE',
    'https://m.youtube.com/shorts/M7lc1UVf-VE',
    'https://www.youtube.com/live/M7lc1UVf-VE',
    'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE',
  ]) {
    assert.deepEqual(trialVideoSource(url), {
      kind: 'embed', url: 'https://www.youtube.com/embed/M7lc1UVf-VE?playsinline=1&rel=0',
    });
  }
  assert.deepEqual(trialVideoSource('https://vimeo.com/76979871'), { kind: 'embed', url: 'https://player.vimeo.com/video/76979871' });
  for (const url of ['https://vimeo.com/76979871/abc123', 'https://player.vimeo.com/video/76979871?h=abc123']) {
    assert.equal(trialVideoSource(url).url, 'https://player.vimeo.com/video/76979871?h=abc123');
  }
  for (const url of ['https://example.com/trial.mp4?token=abc#t=2', 'https://example.com/media/123']) {
    assert.deepEqual(trialVideoSource(url), { kind: 'video', url });
  }
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'not a URL', 'https://youtube.com/watch?v=invalid', 'https://vimeo.com/invalid']) {
    assert.equal(trialVideoSource(url), null);
  }
  assert.equal(trialVideoSource('https://youtube.com.example.com/watch?v=M7lc1UVf-VE').kind, 'video');
});

test('owners see embedded and direct trial videos without a link to another page', async () => {
  const horseId = 'video-horse';
  const videos = ['https://youtu.be/M7lc1UVf-VE', 'https://vimeo.com/76979871', 'https://example.com/trial.mp4?token=abc'];
  setCached(`trial-videos:test:${horseId}`, videos.map((videoUrl, id) => ({
    id: String(id), horseId, title: `Trial ${id}`, videoUrl, recordedAt: '2026-11-03T00:00:00Z',
  })));
  for (const language of ['vi', 'en']) {
    await i18n.changeLanguage(language);
    const html = render(h(TrialVideosTab, { horseId }), 'OWNER');
    assert.equal((html.match(/<iframe /g) ?? []).length, 2);
    assert.equal((html.match(/<video /g) ?? []).length, 1);
    assert.match(html, /controls=""/);
    assert.match(html, /playsInline=""/);
    assert.match(html, /allowFullScreen=""/);
    assert.doesNotMatch(html, /<a\b|target="_blank"|<form\b/);
  }
});

test('invalid trial video URLs display a translated message inside the page', async () => {
  for (const language of ['vi', 'en']) {
    await i18n.changeLanguage(language);
    const html = render(h(TrialVideoPlayer, { url: 'javascript:alert(1)', title: 'Trial' }));
    assert.ok(visibleText(html).includes(i18n.t('raceFeatures.videoUnavailable')));
    assert.doesNotMatch(html, /<iframe|<video|<a\b/);
  }
});
