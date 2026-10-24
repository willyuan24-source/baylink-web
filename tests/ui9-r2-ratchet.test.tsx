// UI9-R2-RATCHET (cold review round 2, N01 N05 N10 N13 N14 N23 N24 + NAV PR B's account items, DECISIONS 41): the
// signed-in and miscellaneous stylesheets read the type, spacing, ring and motion tokens, and /me/bookings and /messages sit
// on the wide frame with the form rules (control edge ≥ 3:1, ink-3 placeholder at 400, one field corner, the one focus
// ring). Guests rarely see these surfaces, so the site-wide ratchet totals could hide a regression in one file: these tests
// pin the lane's acceptance per file and render the account pages that carry the frame and the fields.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { after, afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import postcss, { type AtRule, type Container, type Rule } from 'postcss';
import tailwindcss from 'tailwindcss';
import config from '../tailwind.config.js';
import { measureStyle } from '../scripts/check-style-ratchet.mjs';
import type { UserData } from '../src/lib/types';
import type { AppContextValue } from '../src/app/context';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/me/bookings', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node, MutationObserver: dom.window.MutationObserver,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, waitFor } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, Outlet } = await import('react-router-dom');
const { ServiceBookingsDashboard } = await import('../src/features/bookings/ServiceBookingsDashboard');
const { MfaLoginChallenge } = await import('../src/features/auth/MfaLoginChallenge');
const { default: MessagesPage } = await import('../src/pages/MessagesPage');
const { api } = await import('../src/lib/api');
const { setLocale } = await import('../src/i18n/locale');
const original = api.request;
afterEach(async () => { cleanup(); api.request = original; await setLocale('zh-Hans', false); });
after(() => dom.window.close());

/** The stylesheets this lane owns (BRIEF.md) plus the /messages hub sheet DECISIONS 41 hands it. */
const OWNED_CSS = [
  'src/features/outings/outing-cover.css',
  'src/features/outings/outings.css',
  'src/components/outing-inspiration.css',
  'src/components/archive.css',
  'src/components/monthly-deals.css',
  'src/features/baybay-actions.css',
  'src/design.css',
  'src/features/member-ui.css',
  'src/styles/modern-messaging.css',
  'src/features/profile/profile-personality.css',
  'src/features/bookings/bookings.css',
  'src/features/source-monitor/source-monitor.css',
  'src/features/source-monitor/source-monitor-admin.css',
  'src/features/messages/messages-hub.css',
];
const read = (file: string) => readFileSync(file, 'utf8');
type Decl = { file: string; line: number; selector: string; media: string; prop: string; value: string };
const decls: Decl[] = [];
const rules: Array<{ file: string; line: number; selector: string; media: string }> = [];
for (const file of OWNED_CSS) {
  const root = postcss.parse(read(file), { from: file });
  const mediaOf = (node: Container | undefined) => {
    const chain: string[] = [];
    for (let parent = node; parent && parent.type !== 'root'; parent = parent.parent as Container | undefined) if (parent.type === 'atrule') chain.unshift(`@${(parent as AtRule).name} ${(parent as AtRule).params}`);
    return chain.join(' ');
  };
  root.walkRules((rule: Rule) => {
    if (rule.parent?.type === 'atrule' && /keyframes$/i.test((rule.parent as AtRule).name)) return;
    const media = mediaOf(rule.parent as Container);
    rules.push({ file, line: rule.source?.start?.line ?? 0, selector: rule.selector.replace(/\s+/g, ' '), media });
    rule.each(node => { if (node.type === 'decl') decls.push({ file, line: node.source?.start?.line ?? 0, selector: rule.selector.replace(/\s+/g, ' '), media, prop: node.prop.toLowerCase(), value: node.value.trim() }); });
  });
}
const where = (d: { file: string; line: number; selector: string }) => `${d.file}:${d.line} ${d.selector.slice(0, 100)}`;
const find = (file: string, selector: string, prop: string, media = '') => decls.filter(d => d.file === file && d.selector === selector && d.prop === prop && d.media === media).map(d => d.value);

test('N01 / N14 / N24: the owned stylesheets have no font-size literal, nothing under 13px, no off-step spacing and no literal duration', () => {
  const { files } = measureStyle(OWNED_CSS.map(file => ({ file, text: read(file) })));
  const failures: string[] = [];
  for (const [file, metrics] of Object.entries(files as Record<string, Record<string, number>>)) {
    for (const metric of ['fontSizeLiteral', 'fontSizeUnder13', 'fontSizeOffLadder', 'spacingOffScale', 'durationLiteral', 'durationOffScale', 'hexOccurrences']) if (metrics[metric]) failures.push(`${file} ${metric} ${metrics[metric]}`);
  }
  assert.deepEqual(failures, []);
});

test('N23: every :hover rule in the owned stylesheets sits inside (hover:hover) and (pointer:fine)', () => {
  const ungated = rules.filter(rule => /:hover/.test(rule.selector) && !/\(hover:\s*hover\)/.test(rule.media));
  assert.deepEqual(ungated.map(where), []);
});

test('N10: no ring or ad-hoc box-shadow in the owned stylesheets — only none and the two elevation tokens', () => {
  const shadows = decls.filter(d => d.prop === 'box-shadow' && !/^(?:none|var\(--e[12]\))$/.test(d.value));
  assert.deepEqual(shadows.map(d => `${where(d)} ${d.value}`), []);
  // The selected post type and profile theme keep their 2px edge as an outline that steps aside for the focus ring.
  assert.deepEqual(find('src/features/member-ui.css', '.member-compose-type--selected:not(:focus-visible)', 'outline'), ['1px solid var(--color-brand)']);
  assert.deepEqual(find('src/features/profile/profile-personality.css', '.profile-theme-option[aria-pressed=true]:not(:focus-visible)', 'outline'), ['1px solid var(--profile-ink)']);
  // The sun on the profile cover: one gradient disc with its ring, centred where the 72px disc and its 18px halo were.
  const [sun] = find('src/features/profile/profile-personality.css', '.profile-identity-landscape:before', 'background');
  assert.match(sun, /^radial-gradient\(closest-side,rgb\(var\(--color-surface-rgb\) \/ \.33\) 66\.4%,rgb\(var\(--color-surface-rgb\) \/ \.07\) 67%\)$/);
  assert.deepEqual(find('src/features/profile/profile-personality.css', '.profile-identity-landscape:before', 'width'), ['108px']);
  assert.deepEqual(find('src/features/profile/profile-personality.css', '.profile-identity-landscape:before', 'right'), ['calc(14% - 18px)']);
});

test('N13 / N09: one underline offset and one focus ring (the ring tokens) in the owned stylesheets', () => {
  const offsets = decls.filter(d => d.prop === 'text-underline-offset' && d.value !== 'var(--underline-offset)');
  assert.deepEqual(offsets.map(d => `${where(d)} ${d.value}`), []);
  // A focus outline reads --focus-ring-width (the cover frame keeps its inset -4px offset, inside the picture).
  const rings = decls.filter(d => d.prop === 'outline' && /:focus/.test(d.selector.replace(/:not\(:focus-visible\)/g, '')) && !/^var\(--focus-ring-width\) solid var\(--color-brand\)$/.test(d.value));
  assert.deepEqual(rings.map(d => `${where(d)} ${d.value}`), []);
  const offsetsOff = decls.filter(d => d.prop === 'outline-offset' && /:focus/.test(d.selector.replace(/:not\(:focus-visible\)/g, '')) && d.value !== 'var(--focus-ring-offset)' && !/\.outing-cover-frame:focus-visible$/.test(d.selector));
  assert.deepEqual(offsetsOff.map(d => `${where(d)} ${d.value}`), []);
});

test('N24: every transition and animation in the owned stylesheets runs on a duration token and names an easing token', () => {
  const failures: string[] = [];
  for (const d of decls.filter(item => /^(?:transition|animation)$/.test(item.prop))) {
    if (/^none$/.test(d.value) || /prefers-reduced-motion/.test(d.media)) continue;
    for (const layer of d.value.split(/,(?![^(]*\))/)) {
      const resetOrStep = /\b0s\b/.test(layer) && !/var\(--dur/.test(layer);
      if (resetOrStep) continue;
      if (!/var\(--dur-\d\)/.test(layer)) failures.push(`${where(d)} duration: ${layer}`);
      if (!/var\(--ease-(?:in|out|std)\)/.test(layer)) failures.push(`${where(d)} easing: ${layer}`);
    }
  }
  assert.deepEqual(failures, []);
  // The date guard's skeleton shimmers on the one loop length (6 × --dur-3), as the ui and my-week skeletons.
  assert.ok(decls.some(d => d.file === 'src/features/source-monitor/source-monitor.css' && d.value.startsWith('date-guard-shimmer calc(6 * var(--dur-3)) var(--ease-std) infinite')));
});

test('N24: Tailwind animate-spin and animate-pulse compile to the token loop (no 1s / 2s, no fourth easing curve)', async () => {
  const result = await postcss([tailwindcss({ ...config, content: [{ raw: '<i class="animate-spin animate-pulse"></i>', extension: 'html' }] })]).process('@tailwind utilities;', { from: undefined });
  const animation: Record<string, string> = {};
  result.root.walkRules(rule => { rule.walkDecls('animation', declaration => { animation[rule.selector] = declaration.value; }); });
  assert.equal(animation['.animate-spin'], 'spin calc(6 * var(--dur-3)) linear infinite');
  assert.equal(animation['.animate-pulse'], 'pulse calc(6 * var(--dur-3)) var(--ease-std) infinite');
});

test('N05: the together footnotes keep a reading measure; only the closing note wraps between phrases', () => {
  const sheet = 'src/features/outings/outings.css';
  assert.deepEqual(find(sheet, '.together-page .outing-footnote', 'max-width'), ['var(--measure)']);
  // Where the measure binds (from 768) the hub's closing note wraps between phrases (measured: 各自处理。| 出发前请再次核对…),
  // overflow-wrap:anywhere lets an unbroken run still shrink, and balanced lines keep English off a two-word last line.
  const note = '.together-page .outing-footnote.outing-toolbar';
  assert.deepEqual(find(sheet, note, 'word-break', '@media (min-width:768px)'), ['keep-all']);
  assert.deepEqual(find(sheet, note, 'overflow-wrap', '@media (min-width:768px)'), ['anywhere']);
  assert.deepEqual(find(sheet, note, 'text-wrap', '@media (min-width:768px)'), ['balance']);
  // No other footnote keeps CJK words whole: the hub card footer's 发起人 · {nickname} (30 characters allowed) is a flex item,
  // and keep-all there made a long Chinese nickname push the footer wider than the card (review, 10-23: 400px in a 320 card).
  const keepAll = decls.filter(d => d.prop === 'word-break' && d.value === 'keep-all' && /outing-footnote|outing-card-footer/.test(d.selector));
  assert.deepEqual(keepAll.map(d => d.selector), [note]);
  const sources = ['OutingsHub', 'OutingDetail', 'OutingForm', 'OutingDiscussion', 'OutingTimePoll'].map(name => read(`src/features/outings/${name}.tsx`)).join('\n');
  assert.equal(sources.match(/className="outing-footnote outing-toolbar"/g)?.length, 1, 'the closing note is the only footnote that is also a toolbar');
  assert.match(read('src/features/outings/OutingsHub.tsx'), /<footer className="outing-card-footer"><span className="outing-footnote">/);
});

test('the card cover\'s date: the display step from 1024 (44px), never below the 32px kept step (a phone card keeps 32px)', () => {
  const size = 'max(var(--fs-keep-32),var(--text-display))';
  assert.deepEqual(find('src/features/outings/outing-cover.css', '.outing-cover--card .outing-cover-calendar-date', 'font-size'), [size]);
  assert.deepEqual(find('src/features/outings/outings.css', '.together-page .outing-cover--card .outing-cover-calendar-date', 'font-size'), [size]);
});

test('/archive: the link rows keep a 16px gap, so the 11 继续浏览 links stay on one line at 1024-1440 (zh-Hans, zh-Hant)', () => {
  assert.deepEqual(find('src/components/archive.css', '.archive-jump,.archive-links', 'gap'), ['0 var(--sp-4)']);
});

test('NAV PR B: the profile stamp has no tracking and no blur; .outing-eyebrow and .booking-eyebrow are not tracked', () => {
  const stamp = decls.filter(d => d.selector === '.profile-identity-stamp');
  assert.ok(stamp.length > 0);
  assert.deepEqual(stamp.filter(d => /^(?:letter-spacing|backdrop-filter|-webkit-backdrop-filter|text-transform)$/.test(d.prop)).map(d => `${d.prop}:${d.value}`), []);
  assert.match(read('src/features/profile/ProfileIdentity.tsx'), /BAYLINK · Bay Area/);
  const eyebrow = decls.filter(d => /\.outing-eyebrow\b/.test(d.selector));
  assert.ok(eyebrow.length > 0);
  assert.deepEqual(eyebrow.filter(d => /^(?:letter-spacing|text-transform)$/.test(d.prop)).map(d => `${d.prop}:${d.value}`), []);
  // The /me/bookings eyebrow (and the booking panel's, same class) is not tracked either.
  const booking = decls.filter(d => /\.booking-eyebrow\b/.test(d.selector));
  assert.ok(booking.length > 0);
  assert.deepEqual(booking.filter(d => /^(?:letter-spacing|text-transform)$/.test(d.prop)).map(d => `${d.prop}:${d.value}`), []);
});

test('NAV PR B forms: sign-in / MFA, /me/bookings and messages fields take the control edge, the ink-3 placeholder at 400 and --r-md', () => {
  const field = (file: string, selector: string) => ({
    border: find(file, selector, 'border')[0] ?? find(file, selector, 'border-color')[0],
    radius: find(file, selector, 'border-radius')[0],
    outline: find(file, selector, 'outline')[0],
  });
  for (const [file, selector] of [
    ['src/features/member-ui.css', '.member-auth-input'],
    ['src/features/messages/messages-hub.css', '.msg-search'],
    ['src/styles/modern-messaging.css', '.modern-chat-compose-row'],
  ]) {
    const look = field(file, selector);
    assert.equal(look.border, '1px solid var(--color-line-control)', `${file} ${selector}`);
    assert.equal(look.radius, 'var(--r-md)', `${file} ${selector}`);
  }
  // The sign-in field no longer removes the outline, so the one ring (design.css, global) shows on focus; no halo rule.
  assert.equal(field('src/features/member-ui.css', '.member-auth-input').outline, undefined);
  assert.deepEqual(decls.filter(d => d.selector.startsWith('.member-auth-input:focus')).map(where), []);
  assert.match(read('src/design.css'), /:where\(button,a,input,select,textarea,summary\):focus-visible \{ outline:var\(--focus-ring-width\) solid var\(--color-brand\); outline-offset:var\(--focus-ring-offset\); \}/);
  // The message box rings itself while its text area has focus; the phone rule keeps the one corner.
  assert.deepEqual(find('src/styles/modern-messaging.css', '.modern-chat-compose-row:has(>.modern-chat-input:focus-visible)', 'outline'), ['var(--focus-ring-width) solid var(--color-brand)']);
  assert.deepEqual(decls.filter(d => d.file === 'src/styles/modern-messaging.css' && d.selector === '.modern-chat-compose-row' && d.prop === 'border-radius').map(d => d.value), ['var(--r-md)']);
  assert.deepEqual(find('src/features/member-ui.css', '.member-auth-input::placeholder', 'color'), ['var(--color-ink-3)']);
  assert.deepEqual(find('src/features/member-ui.css', '.member-auth-input::placeholder', 'font-weight'), ['400']);
  // /me/bookings: its fields (the reschedule select) take the control edge; the field corner is the shared --r-md. The booking
  // request panel on /posts/:id shares .booking-surface and keeps its edge and placeholder for stage 1B ① (1B-03 A).
  assert.deepEqual(find('src/features/bookings/bookings.css', '.service-bookings-dashboard .booking-surface :is(input:not([type=checkbox]),select,textarea)', 'border-color'), ['var(--color-line-control)']);
  assert.deepEqual(find('src/features/bookings/bookings.css', '.booking-surface input:not([type=checkbox]),.booking-surface select,.booking-surface textarea', 'border-radius'), ['var(--r-md)']);
});

test('NAV PR B frame: /me/bookings and /messages on the wide frame (x = 112 at 1440), blocks in columns 1-8 from 1024', () => {
  const EIGHT = 'calc((100% + var(--grid-gutter)) * 8 / 12 - var(--grid-gutter))';
  for (const [file, selector] of [['src/features/bookings/bookings.css', '.service-bookings-dashboard'], ['src/features/messages/messages-hub.css', '.msg-hub']]) {
    assert.deepEqual(find(file, selector, 'max-width'), ['var(--container-wide)'], selector);
    assert.deepEqual(find(file, selector, 'box-sizing'), ['content-box'], selector);
    const columns = decls.find(d => d.file === file && d.selector === `${selector}>*` && d.prop === 'max-width');
    assert.ok(columns && /min-width:\s*1024px/.test(columns.media), `${selector}>* in columns 1-8 from 1024`);
    assert.equal(columns.value, EIGHT);
  }
  // At 1440 the desktop gutter (32) + the 1216 frame inside the 1280 main put the content at x = 112, as /me and /my-week.
  assert.deepEqual(find('src/features/bookings/bookings.css', '.service-bookings-dashboard', 'padding'), ['var(--sp-6) var(--page-gutter) var(--sp-7)']);
  assert.deepEqual(find('src/features/messages/messages-hub.css', '.msg-hub', 'padding-inline', '@media (min-width:1024px)'), ['var(--sp-6)']);
  // The booking H1 is the page H1 of every account page (H30), not a third clamp size.
  assert.deepEqual(find('src/features/bookings/bookings.css', '.booking-dashboard-heading h1', 'font-size'), ['var(--text-h1)']);
  assert.deepEqual(decls.filter(d => d.selector === '.booking-dashboard-heading h1' && d.prop === 'font-size' && d.media).map(where), []);
});

test('the account pages render into the frame the rules name (guest bookings, the MFA field, a member\'s /messages)', async () => {
  const bookings = render(<MemoryRouter initialEntries={['/me/bookings']}><ServiceBookingsDashboard user={null} onLoginNeeded={() => {}} showToast={() => {}} /></MemoryRouter>);
  const section = bookings.container.querySelector('section.service-bookings-dashboard');
  assert.ok(section, 'the dashboard is the frame');
  const heading = section.querySelector(':scope > header.booking-dashboard-heading h1');
  assert.equal(heading?.textContent, '把需要，安排妥当');
  assert.ok(section.querySelector(':scope > section.booking-surface.booking-guest'), 'the guest prompt is a direct block of the frame (columns 1-8)');
  bookings.unmount();

  const mfa = render(<MfaLoginChallenge challengeToken="t" onComplete={() => {}} onRestart={() => {}} onClose={() => {}} />);
  const code = mfa.container.querySelector('input#login-mfa-code');
  assert.ok(code?.classList.contains('member-auth-input'), 'the MFA code field takes the sign-in field look');
  mfa.unmount();

  const user = { id: 'r2-user', token: 'r2-token', email: 'r2@example.test', nickname: '湾区邻居', role: 'user', contactType: 'wechat', contactValue: '', isBanned: false } as UserData;
  api.request = (async (path: string) => {
    if (path === '/notifications/preferences') return { preferences: { email: { message: true }, sms: {} } };
    if (path === '/conversations') return [];
    if (path.startsWith('/contact-requests')) return { requests: [] };
    return {};
  }) as typeof api.request;
  const context = { user, messagesBadgeCount: 0, setUser() {}, setShowLogin() {}, showToast() {}, openChat() {}, openPostById() {}, contactRequestRefreshKey: 0, setContactRequestRefreshKey() {}, setPendingContactRequestCount() {}, chatRouteStatus: 'idle', chatRouteError: null, retryChatRoute() {} } as unknown as AppContextValue;
  const messages = render(<MemoryRouter initialEntries={['/messages']}><Routes><Route element={<Outlet context={context} />}><Route path="/messages" element={<MessagesPage />} /></Route></Routes></MemoryRouter>);
  const hub = messages.container.querySelector('div.msg-hub');
  assert.ok(hub, 'the hub is the frame');
  await waitFor(() => assert.ok(hub.querySelector(':scope > header.ui-page-header h1, :scope > .ui-page-header h1'), 'the H1 heads the frame'));
  assert.ok([...hub.children].length >= 2, 'the hub lays its blocks out as direct children (each takes columns 1-8)');
  messages.unmount();
});
