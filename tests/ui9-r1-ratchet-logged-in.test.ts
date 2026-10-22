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
  // On the brand-deep header (the CloseButton) a brand ring would be ~1.9:1; it turns lime like FOUNDATION's deep surfaces,
  // with a selector at least as specific as the overlay ring's so it wins.
  const deep = rules.find(rule => rule.selector.startsWith('.member-compose-header') && rule.selector.includes(':focus-visible'));
  assert.ok(deep, 'a .member-compose-header :focus-visible rule exists');
  assert.equal(deep.decls['outline-color'], 'var(--color-highlight)');
  assert.ok(rules.indexOf(deep) > rules.indexOf(ring), 'the header ring comes after the overlay ring');
  assert.match(deep.selector, /:is\(button/);
});

test('ghost icon buttons fade their glyph when disabled instead of gaining a fill (one rule, so the fade cannot drift)', () => {
  const selectors = ['.modern-chat-icon:disabled', '.modern-chat-message-actions button:disabled', '.modern-chat-compose-meta button:disabled', '.modern-chat-pending button:disabled'];
  const fades = rules.filter(rule => rule.file === 'src/styles/modern-messaging.css' && /:disabled/.test(rule.selector) && /--color-ink-3-rgb/.test(rule.decls.color ?? ''));
  assert.equal(fades.length, 1, fades.map(where).join(' | '));
  const [rule] = fades;
  assert.deepEqual(rule.selector.split(',').map(part => part.trim()), selectors);
  assert.equal(rule.decls.background, 'transparent');
  assert.match(rule.decls.color, /^rgb\(var\(--color-ink-3-rgb\) \/ \.\d+\)$/);
  // Last in the file, so it also beats the earlier (hover) and [aria-expanded] rules of the same specificity.
  assert.equal(rules.filter(candidate => candidate.file === rule.file).at(-1), rule);
});

test('a pressed preference chip keeps its selected fill while the fieldset is disabled (saving)', () => {
  // ProfilePersonalSpace disables both chip fieldsets on every save; a disabled rule that repaints every button would
  // flash the chosen regions and interests back to cream until the API answers.
  const sheet = rules.filter(rule => rule.file === 'src/features/profile/profile-personal-space.css');
  const pressed = sheet.find(rule => rule.selector === '.profile-preference-chips button[aria-pressed=true]');
  assert.ok(pressed, 'the pressed chip rule exists');
  assert.equal(pressed.decls.background, 'var(--color-brand-tint)');
  const repaint = sheet.filter(rule => /:disabled/.test(rule.selector) && ('background' in rule.decls || 'border-color' in rule.decls));
  assert.ok(repaint.length > 0);
  for (const rule of repaint) {
    for (const part of rule.selector.split(',')) assert.match(part, /:not\(\[aria-pressed=true\]\)/, where(rule));
  }
});

test('the user card disabled message button and the phone-verification card stay readable and reachable', () => {
  // The card panel is surface-2, so a surface-2 disabled fill would vanish into it: the line tone, as the chat assistant.
  const card = readFileSync('src/features/users/UserProfileModal.tsx', 'utf8');
  assert.match(card, /disabled:bg-\[var\(--color-line\)\] disabled:text-\[var\(--color-ink-3\)\]/);
  assert.doesNotMatch(card, /disabled:bg-\[var\(--color-surface-2\)\]/);
  // The verification card never closes on the backdrop, so on a short phone in 特大 it must scroll inside the viewport.
  const editor = readFileSync('src/features/profile/EditProfileModal.tsx', 'utf8');
  assert.match(editor, /max-w-xs max-h-\[calc\(100dvh-3rem\)\] overflow-y-auto/);
});

test('the profile editor jump bar is a 2 × 2 grid on a phone in 特大 and its targets clear the taller bar', () => {
  const phone = rules.filter(rule => rule.file === 'src/features/profile/profile-personality.css' && rule.media.includes('(max-width:760px)'));
  const grid = phone.find(rule => rule.selector === 'html[data-reading=extra-large] .profile-editor-jumps');
  assert.ok(grid);
  assert.equal(grid.decls.display, 'grid');
  assert.equal(grid.decls['grid-template-columns'], 'repeat(2,minmax(0,1fr))');
  const margin = phone.find(rule => rule.selector.startsWith('html[data-reading=extra-large]') && 'scroll-margin-top' in rule.decls);
  assert.ok(margin && parseInt(margin.decls['scroll-margin-top'], 10) >= 112, 'two 44px rows + padding + a gap');
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
