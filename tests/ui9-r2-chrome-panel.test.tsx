// UI9-R2-CHROME-PANEL (second cold review, 10-23): the chrome's last 13px tag (N04), one disabled look without opacity (N09),
// hovers only where a pointer hovers (N23), the shared underline offset (N13), rings and corners on tokens (N10 / N11) and
// OverlayHost's chunk fallbacks on token classes. CSS facts are read from the stylesheets themselves.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import postcss, { type AtRule, type Rule } from 'postcss';

const LANE_CSS = ['src/components/site-chrome.css', 'src/components/site-dialogs.css', 'src/features/baybay/baybay-panel.css', 'src/features/feedback/feedback.css', 'src/features/feedback/feedback-entry.css'];
const read = (file: string) => readFileSync(file, 'utf8');
const inHoverMedia = (rule: Rule) => {
  for (let parent = rule.parent; parent && parent.type !== 'root'; parent = parent.parent) if (parent.type === 'atrule' && /hover:\s*hover/.test((parent as AtRule).params) && /pointer:\s*fine/.test((parent as AtRule).params)) return true;
  return false;
};
const decls = (file: string, selector: string) => {
  const found: Record<string, string> = {};
  postcss.parse(read(file)).walkRules(rule => { if (rule.selector === selector) rule.walkDecls(decl => { found[decl.prop] = decl.value; }); });
  return found;
};

test('N09 / N23: no opacity on a disabled control and no hover outside (hover:hover) and (pointer:fine) in the lane\'s sheets', () => {
  for (const file of LANE_CSS) postcss.parse(read(file)).walkRules(rule => {
    if (/:disabled|\[disabled\]/.test(rule.selector)) rule.walkDecls('opacity', decl => assert.fail(`${file}: ${rule.selector} { opacity:${decl.value} }`));
    if (/:hover/.test(rule.selector)) assert.ok(inHoverMedia(rule), `${file}: ${rule.selector} hovers without the pointer condition`);
  });
  // 发送中 wears F's disabled look (sunken, ink-3), and the two feedback buttons answer a press.
  assert.deepEqual(decls('src/features/feedback/feedback.css', '.feedback-primary:disabled'), { 'border-color': 'transparent', background: 'var(--color-surface-2)', color: 'var(--color-ink-3)', cursor: 'progress' });
  assert.equal(decls('src/features/feedback/feedback.css', '.feedback-primary:active:not(:disabled)').background, 'var(--color-brand-hover)');
  assert.equal(decls('src/features/feedback/feedback.css', '.feedback-secondary:active').background, 'var(--color-surface-2)');
});

test('N13: the feedback links underline at the shared offset; N04: the AI tag is 14px on phones too', () => {
  for (const file of ['src/features/feedback/feedback.css', 'src/features/feedback/feedback-entry.css']) postcss.parse(read(file)).walkDecls('text-underline-offset', decl => assert.equal(decl.value, 'var(--underline-offset)', `${file}: ${(decl.parent as Rule).selector}`));
  assert.equal(decls('src/components/site-chrome.css', '.site-ai-tag')['font-size'], 'var(--fs-meta)');
});

test('N10 / N11: the search pill rings with the focus tokens, BayBay\'s composer and fields take the field radius', () => {
  postcss.parse(read('src/components/site-dialogs.css')).walkDecls('box-shadow', decl => assert.match(decl.value, /^(?:var\(--e[12]\)|none)$/, `${(decl.parent as Rule).selector}: ${decl.value}`));
  const ring = decls('src/components/site-dialogs.css', '.ui-sheet .quick-explore--sheet .quick-search-form:focus-within');
  assert.equal(ring.outline, 'var(--focus-ring-width) solid var(--color-brand)');
  assert.equal(ring['outline-offset'], 'calc(-1 * var(--focus-ring-width))');
  const panel = 'src/features/baybay/baybay-panel.css';
  assert.equal(decls(panel, '.baybay-conversation .member-baybay-composer')['border-radius'], 'var(--r-md)');
  assert.equal(decls(panel, '.baybay-conversation textarea.member-baybay-question-input')['border-radius'], 'var(--r-md)');
  assert.equal(decls(panel, '.baybay-conversation .baybay-requirement-editor input,.baybay-conversation .baybay-task-handoff textarea')['border-radius'], 'var(--r-md)');
  // R2-16: the cutoff line is one muted line, its 911 a brand link whose target reaches 44px without moving the line.
  const line = decls(panel, '.baybay-conversation .bb-pause-line');
  assert.equal(line.color, 'var(--color-ink-2)');
  assert.equal(line['font-size'], 'var(--fs-meta)');
  const call = decls(panel, '.baybay-conversation .bb-pause-line>a');
  assert.equal(call.padding, 'var(--sp-3) var(--sp-2)');
  assert.equal(call.margin, 'calc(-1 * var(--sp-3)) calc(-1 * var(--sp-2))');
});

test('OverlayHost: the chunk fallbacks sit on token classes (no Tailwind shadow or corners) and keep CloseButton\'s markup', () => {
  const source = read('src/app/OverlayHost.tsx');
  for (const [, classes] of source.matchAll(/className="([^"]*)"/g)) assert.doesNotMatch(classes, /\b(?:shadow-(?:sm|md|lg|xl|2xl)|rounded-(?:full|lg|xl|2xl|3xl))\b/, classes);
  assert.match(source, /<span className="site-chunk-disc">/);
  assert.match(source, /<div className="site-chunk-card">/);
  // The entry chunk holds this host: the close is CloseButton's markup written out, as in Toast.tsx (no Button.tsx in the entry).
  assert.match(source, /className="ui-icon-button ui-close" aria-label=\{close\} title=\{close\}/);
  assert.doesNotMatch(source, /from '\.\.\/components\/ui\/(?:CloseButton|Button)'/);
  const css = 'src/components/site-chrome.css';
  assert.deepEqual([decls(css, '.site-chunk-disc')['border-radius'], decls(css, '.site-chunk-disc')['box-shadow']], ['var(--r-circle)', 'var(--e2)']);
  assert.deepEqual([decls(css, '.site-chunk-card')['border-radius'], decls(css, '.site-chunk-card')['box-shadow']], ['var(--r-xl)', 'var(--e2)']);
});
