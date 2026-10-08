import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { mapWeight, rewriteCss, rewriteTsx, siteFiles } from '../scripts/codemods/weights.mjs';
import { rewrite as rewriteArrows } from '../scripts/codemods/internal-arrows.mjs';
import { isAllCapsPhrase, rewrite as rewriteEyebrows } from '../scripts/codemods/eyebrows.mjs';

const dictionary = { '我的这周 ↗': 'My Week ↗', '我的这周': 'My Week', '整月日历 ↗': 'Full month calendar ↗' };

test('weights codemod maps every retired weight onto 400/600/700 and keeps the stylesheet byte-for-byte otherwise', () => {
  assert.deepEqual([300, 400, 500, 550, 600, 650, 700, 750, 760, 800, 900].map(weight => mapWeight(weight)), [400, 400, 400, 600, 600, 600, 700, 700, 700, 700, 700]);
  assert.equal(mapWeight(500, '.has-unread .modern-inbox-preview-text'), 600, 'emphasis against a 400 sibling survives');
  const css = '.a{font-weight:650;color:red}\n.b { font-weight: 750 !important; }\n@media (max-width:600px){.c{font:500 12px/1 sans-serif}}\n.d{font-weight:600}';
  const { text, changes } = rewriteCss(css);
  assert.equal(text, '.a{font-weight:600;color:red}\n.b { font-weight: 700 !important; }\n@media (max-width:600px){.c{font:400 12px/1 sans-serif}}\n.d{font-weight:600}');
  assert.equal(changes.length, 3);
  assert.equal(rewriteCss(text).changes.length, 0, 'idempotent');
  assert.equal(rewriteTsx("style={{ fontWeight: 650, fontSize: 12 }}").text, 'style={{ fontWeight: 600, fontSize: 12 }}');
});

test('arrows codemod: internal links and buttons lose ↗, links that leave the site keep it, English keeps translating', () => {
  const source = [
    "import { ArrowUpRight, Mail } from 'lucide-react';",
    'export const A = ({ url }: { url: string }) => <div>',
    '  <Link to="/guides">指南<ArrowUpRight size={16} /></Link>',
    '  <a href={url} target="_blank" rel="noreferrer">官方<ArrowUpRight size={14} /></a>',
    '  <button type="button">登录<ArrowUpRight size={18} /></button>',
    "  <Link to=\"/my-week\">{t('我的这周 ↗', 'My Week ↗')}</Link>",
    '  <Link to="/my-week">我的这周 ↗</Link>',
    '  <Link to="/calendar">整月日历 ↗</Link>',
    '  <a href="https://example.org">外部 ↗</a><Mail />',
    '</div>;',
  ].join('\n');
  const result = rewriteArrows(source, 'src/components/A.tsx', dictionary);
  assert.equal(result.replacedIcons, 2);
  assert.match(result.text, /^import \{ ArrowUpRight, Mail, ChevronRight \} from 'lucide-react';/, 'still used by the external link, so it stays imported');
  assert.match(result.text, /<Link to="\/guides">指南<ChevronRight size=\{16\} \/><\/Link>/);
  assert.match(result.text, /target="_blank" rel="noreferrer">官方<ArrowUpRight size=\{14\} \/>/);
  assert.match(result.text, /<button type="button">登录<ChevronRight size=\{18\} \/>/);
  assert.match(result.text, /\{t\('我的这周', 'My Week'\)\}/);
  assert.match(result.text, /<Link to="\/my-week">我的这周<\/Link>/);
  assert.match(result.text, /整月日历 ↗/, 'no arrow-free English entry: left for a hand edit');
  assert.equal(result.manual.length, 1);
  assert.match(result.text, /外部 ↗/);
  assert.equal(rewriteArrows(result.text, 'src/components/A.tsx', dictionary).replacedIcons, 0, 'idempotent');
  const onlyInternal = rewriteArrows("import {\n  ArrowRight,\n  ArrowUpRight,\n  ChevronRight,\n} from 'lucide-react';\nconst B = () => <Link to=\"/\">x<ArrowUpRight /></Link>;", 'src/B.tsx', {});
  assert.equal(onlyInternal.text, "import {\n  ArrowRight,\n  ChevronRight,\n} from 'lucide-react';\nconst B = () => <Link to=\"/\">x<ChevronRight /></Link>;", 'a multi-line import keeps its layout');
});

test('eyebrows codemod wraps literal English all-caps eyebrows for the English edition only', () => {
  assert.equal(isAllCapsPhrase('MAKE YOURSELF AT HOME'), true);
  assert.equal(isAllCapsPhrase('BAY AREA / DAY BY DAY'), true);
  assert.equal(isAllCapsPhrase('BAYLINK'), false, 'a single wordmark is not an eyebrow');
  assert.equal(isAllCapsPhrase('San Francisco Bay Area'), false);
  assert.equal(isAllCapsPhrase('本周 THIS WEEK'), false);
  const source = "import { MapPin } from 'lucide-react';\nexport const C = () => <header><p className=\"x-eyebrow\"><MapPin size={14} /> BAY AREA / DAY BY DAY</p><span className=\"k\">{t('本周', 'THIS WEEK')}</span><button>OPEN NOW PLEASE</button><h1>标题</h1></header>;";
  const { text, found } = rewriteEyebrows(source, 'src/pages/C.tsx');
  assert.equal(found.length, 1);
  assert.equal(text, "import { MapPin } from 'lucide-react';\nimport { EnglishOnly } from '../components/EnglishOnly';\nexport const C = () => <header><EnglishOnly><p className=\"x-eyebrow\"><MapPin size={14} /> BAY AREA / DAY BY DAY</p></EnglishOnly><span className=\"k\">{t('本周', 'THIS WEEK')}</span><button>OPEN NOW PLEASE</button><h1>标题</h1></header>;");
  assert.equal(rewriteEyebrows(text, 'src/pages/C.tsx').found.length, 0, 'idempotent');
  const adjacent = rewriteEyebrows('const D = () => <div><span>ONE TWO</span><span>THREE FOUR</span></div>;', 'src/D.tsx');
  assert.match(adjacent.text, /<div><EnglishOnly><span>ONE TWO<\/span><\/EnglishOnly><EnglishOnly><span>THREE FOUR<\/span><\/EnglishOnly><\/div>/);
});

test('the site stays codemod-clean: weights 400/600/700, no ↗ on internal links, no English all-caps eyebrows in Chinese', () => {
  const english = JSON.parse(readFileSync('src/data/generated/english.json', 'utf8'));
  for (const file of siteFiles() as string[]) {
    const source = readFileSync(file, 'utf8');
    if (file.endsWith('.css')) { assert.deepEqual(rewriteCss(source).changes, [], file); continue; }
    assert.deepEqual(rewriteTsx(source).changes, [], file);
    const path = file.replaceAll('\\', '/');
    if (/little-?bay/i.test(path) || path.endsWith('EnglishOnly.tsx')) continue;
    const arrows = rewriteArrows(source, path, english);
    assert.equal(arrows.text, source, `${path}: run node scripts/codemods/internal-arrows.mjs`);
    assert.deepEqual(arrows.manual, [], path);
    if (!/(OutingCover|ProfileIdentity|DiningCalculator)\.tsx$/.test(path)) assert.deepEqual(rewriteEyebrows(source, path).found, [], `${path}: run node scripts/codemods/eyebrows.mjs`);
  }
});
