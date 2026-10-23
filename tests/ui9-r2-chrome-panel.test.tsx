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
  assert.equal(line['word-break'], 'keep-all', 'it wraps at its spaces only: 起暂停 and the date and time stay whole');
  const call = decls(panel, '.baybay-conversation .bb-pause-line a');
  assert.equal(decls(panel, '.baybay-conversation .bb-pause-line>span')['white-space'], 'nowrap', '特大 wraps before 急事拨打 911, never inside it');
  // The 911 target is a field tall: the inline's glyph box (≥1em) plus half the field height less half an em, above and
  // below (block padding on an inline never moves the line; 41×45px at 标准 measured in Chrome, UI9-R2 fix-run).
  assert.equal(call.padding, 'calc(var(--control-height) / 2 - .5em) var(--sp-2)');
  assert.equal(call.margin, '0 calc(-1 * var(--sp-2))');
});

test('OverlayHost: the chunk fallbacks sit on token classes (no Tailwind shadow or corners) and keep CloseButton\'s markup', () => {
  const source = read('src/app/OverlayHost.tsx');
  for (const [, classes] of source.matchAll(/className="([^"]*)"/g)) assert.doesNotMatch(classes, /\b(?:shadow-(?:sm|md|lg|xl|2xl)|rounded-(?:full|lg|xl|2xl|3xl))\b/, classes);
  // The dialogs' chunk wait is DialogWait (followup 41), on the same token disc.
  assert.match(read('src/components/ui/DialogWait.tsx'), /<span className="site-chunk-disc">/);
  assert.match(source, /<div className="site-chunk-card">/);
  // The entry chunk holds this host: the close is CloseButton's markup written out, as in Toast.tsx (no Button.tsx in the entry).
  assert.match(source, /className="ui-icon-button ui-close" aria-label=\{close\} title=\{close\}/);
  assert.doesNotMatch(source, /from '\.\.\/components\/ui\/(?:CloseButton|Button)'/);
  const css = 'src/components/site-chrome.css';
  assert.deepEqual([decls(css, '.site-chunk-disc')['border-radius'], decls(css, '.site-chunk-disc')['box-shadow']], ['var(--r-circle)', 'var(--e2)']);
  assert.deepEqual([decls(css, '.site-chunk-card')['border-radius'], decls(css, '.site-chunk-card')['box-shadow']], ['var(--r-xl)', 'var(--e2)']);
});

test('followup 26: from 1024px at 特大 and in English 大 / 简洁显示 (Chinese 简洁显示 to 1279px) the header tools name themselves shorter', () => {
  const rules: Record<string, string> = {};
  postcss.parse(read('src/components/site-chrome.css')).walkAtRules('media', media => {
    const params = media.params.replace(/\s/g, '');
    if (params !== '(min-width:1024px)' && params !== '(min-width:1024px)and(max-width:1279px)') return;
    media.walkRules(found => { if (/site-language-name/.test(found.selector)) rules[params] = found.toString(); });
  });
  // From 1280 the English header at 大, 特大 and 简洁显示 still ran 更多 under the 280px search field (review, 15 widths × modes).
  assert.match(rules['(min-width:1024px)'], /html:is\(\[data-reading=extra-large\],\[data-simple\]:lang\(en\),\[data-reading=large\]:lang\(en\)\) \.site-app :is\(\.site-language-name,\.site-topbar-account>span\)/);
  assert.match(rules['(min-width:1024px)and(max-width:1279px)'], /html\[data-simple\] \.site-app :is\(\.site-language-name,\.site-topbar-account>span\)/);
  for (const rule of Object.values(rules)) assert.match(rule, /clip-path:inset\(50%\)/, 'visually hidden, still the accessible name');
});
