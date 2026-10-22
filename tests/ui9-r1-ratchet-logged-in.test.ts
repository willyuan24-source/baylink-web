// UI9-R1-RATCHET-LOGGED-IN: the signed-in and admin surfaces (profile, member dialogs, messages, bookings, admin, the
// /ai-in-the-bay page) are on the tokens. The style ratchet only guards site-wide counts, so a later edit could bring an
// ungated :hover, an opacity disabled look, a hand-rolled scrim or an 11px Tailwind label back into one of these files
// while the totals stay under the baseline. These tests pin the lane's acceptance per file.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import postcss, { type AtRule, type Container, type Rule } from 'postcss';
import { measureStyle } from '../scripts/check-style-ratchet.mjs';

const walk = (directory: string, extension: RegExp): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const path = join(directory, entry.name).replaceAll('\\', '/');
  if (entry.isDirectory()) return walk(path, extension);
  return extension.test(entry.name) ? [path] : [];
});

const OWNED_CSS = [
  'src/features/profile/profile-personality.css',
  'src/features/profile/profile-personal-space.css',
  'src/features/profile/privacy-security.css',
  'src/features/member-ui.css',
  'src/styles/modern-messaging.css',
  ...walk('src/features/messages', /\.css$/),
  ...walk('src/features/bookings', /\.css$/),
  'src/components/ai-local.css',
  'src/features/source-monitor/source-monitor-admin.css',
];
const OWNED_TSX = [
  'src/features/profile/EditProfileModal.tsx',
  'src/features/profile/ProfileSubViews.tsx',
  'src/features/profile/ProfilePersonalSpace.tsx',
  'src/features/profile/PrivacySecurity.tsx',
  'src/features/profile/NotificationPreferencesCard.tsx',
  'src/features/profile/ProfileIdentity.tsx',
  ...walk('src/features/messages', /\.tsx$/),
  ...walk('src/features/bookings', /\.tsx$/),
  'src/features/admin/AdminViews.tsx',
  'src/features/posts/CreatePostModal.tsx',
  'src/features/users/UserProfileModal.tsx',
  'src/pages/AiLocalPage.tsx',
];

type CssRule = { file: string; line: number; selector: string; media: string[]; decls: Record<string, string> };
const rules: CssRule[] = [];
for (const file of OWNED_CSS) {
  postcss.parse(readFileSync(file, 'utf8'), { from: file }).walkRules((rule: Rule) => {
    if (rule.parent?.type === 'atrule' && /keyframes$/i.test((rule.parent as AtRule).name)) return;
    const media: string[] = [];
    for (let parent = rule.parent as Container | undefined; parent && parent.type === 'atrule'; parent = parent.parent as Container | undefined) {
      media.push((parent as AtRule).params.replace(/\s+/g, ''));
    }
    const decls: Record<string, string> = {};
    rule.each(node => { if (node.type === 'decl') decls[node.prop.toLowerCase()] = node.value.trim(); });
    rules.push({ file, line: rule.source?.start?.line ?? 0, selector: rule.selector, media, decls });
  });
}
const where = (rule: CssRule) => `${rule.file}:${rule.line} ${rule.selector.replace(/\s+/g, ' ').slice(0, 120)}`;

test('the owned stylesheets and components exist (a moved file must move its guard)', () => {
  assert.ok(OWNED_CSS.length >= 11 && OWNED_TSX.length >= 19, `${OWNED_CSS.length} css / ${OWNED_TSX.length} tsx`);
  for (const file of [...OWNED_CSS, ...OWNED_TSX]) assert.ok(readFileSync(file, 'utf8').length > 0, file);
});

test('N23: every :hover rule in the owned CSS sits inside (hover:hover) and (pointer:fine)', () => {
  const ungated = rules.filter(rule => /:hover/.test(rule.selector)
    && !rule.media.some(media => media.includes('(hover:hover)') && media.includes('(pointer:fine)')));
  assert.deepEqual(ungated.map(where), []);
});

test('N09: no :disabled rule in the owned CSS fades the control with opacity', () => {
  const faded = rules.filter(rule => /:disabled|\[disabled\]|\[aria-disabled/.test(rule.selector) && 'opacity' in rule.decls);
  assert.deepEqual(faded.map(where), []);
});

test('N09: the owned components carry no opacity disabled look and no 11px / 13px literal Tailwind sizes', () => {
  const failures: string[] = [];
  for (const file of OWNED_TSX) {
    readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
      for (const match of line.matchAll(/disabled:opacity-\S+|text-\[0\.(?:6875|8125)rem\]/g)) failures.push(`${file}:${index + 1} ${match[0]}`);
    });
  }
  assert.deepEqual(failures, []);
});

test('a label is never smaller than its body: the owned dialogs and admin views use the text tokens, not text-xs', () => {
  // The body lines moved to --text-caption (13px phone, 14px desktop); a Tailwind text-xs (12px) label or button above
  // them would invert the hierarchy (信任信息, 最近发布, the tag-field label, the admin actions).
  const failures: string[] = [];
  for (const file of ['src/features/users/UserProfileModal.tsx', 'src/features/profile/EditProfileModal.tsx', 'src/features/admin/AdminViews.tsx']) {
    readFileSync(file, 'utf8').split('\n').forEach((line, index) => { if (/(?<![\w:-])text-xs(?![\w-])/.test(line)) failures.push(`${file}:${index + 1}`); });
  }
  assert.deepEqual(failures, []);
  const card = readFileSync('src/features/users/UserProfileModal.tsx', 'utf8');
  assert.match(card, /text-\[length:var\(--text-fact\)\]">信任信息</);
  assert.match(card, /className="text-\[length:var\(--text-fact\)\] font-bold text-baylink-text">最近发布</);
});

test('N10: the member compose and conversation overlays use the --scrim token (the phone chat is a full page, no scrim)', () => {
  for (const selector of ['.member-compose-overlay', '.modern-chat-overlay']) {
    const own = rules.filter(rule => rule.selector.trim() === selector && !rule.media.length && ('background' in rule.decls || 'background-color' in rule.decls));
    assert.ok(own.length > 0, `${selector} sets a background`);
    for (const rule of own) assert.equal(rule.decls.background ?? rule.decls['background-color'], 'var(--scrim)', where(rule));
  }
});

test('the compose dialog (portalled outside .site-app) carries the FOUNDATION focus ring itself', () => {
  const ring = rules.find(rule => rule.selector.startsWith('.member-compose-overlay') && rule.selector.includes(':focus-visible'));
  assert.ok(ring, 'a .member-compose-overlay :focus-visible rule exists');
  assert.equal(ring.decls.outline, 'var(--focus-ring-width) solid var(--color-brand)');
  assert.equal(ring.decls['outline-offset'], 'var(--focus-ring-offset)');
});

test('ghost icon buttons fade their glyph when disabled instead of gaining a fill', () => {
  for (const selector of ['.modern-chat-icon:disabled', '.modern-chat-message-actions button:disabled', '.modern-chat-compose-meta button:disabled']) {
    const rule = rules.find(candidate => candidate.selector === selector);
    assert.ok(rule, selector);
    assert.equal(rule.decls.background, 'transparent', selector);
    assert.match(rule.decls.color ?? '', /^rgb\(var\(--color-ink-3-rgb\) \/ \.\d+\)$/, selector);
  }
});

test('env() fallbacks inside calc() are lengths (a unitless 0 makes the whole declaration invalid)', () => {
  const failures = rules.flatMap(rule => Object.entries(rule.decls)
    .filter(([, value]) => /calc\([^;]*env\([a-z-]+,\s*0\s*\)/.test(value)).map(([prop]) => `${where(rule)} ${prop}`));
  assert.deepEqual(failures, []);
});

test('N01 / N14: the owned files have no font-size literal and no off-step spacing', () => {
  const { files } = measureStyle([...OWNED_CSS, ...OWNED_TSX].map(file => ({ file, text: readFileSync(file, 'utf8') })));
  const failures: string[] = [];
  for (const [file, metrics] of Object.entries(files as Record<string, Record<string, number>>)) {
    for (const metric of ['fontSizeLiteral', 'spacingOffScale', 'fontSizeUnder13', 'durationLiteral']) if (metrics[metric]) failures.push(`${file} ${metric} ${metrics[metric]}`);
  }
  assert.deepEqual(failures, []);
});
