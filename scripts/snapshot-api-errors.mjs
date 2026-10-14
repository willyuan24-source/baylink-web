/**
 * H48 (I13-11): a snapshot of the messages and error codes the API can answer with, read from the API repository's
 * committed source (git show — read-only, no checkout needed), for tests/api-errors-snapshot.test.ts: every Chinese
 * message there must have reviewed English in src/i18n/api-errors-en.ts, so a new API message without English fails CI.
 *
 *   node scripts/snapshot-api-errors.mjs <path to the api repo> [ref=origin/main]
 *
 * It writes src/i18n/api-errors.snapshot.json. What counts: the Chinese literals of `error:` / `message:` /
 * `notificationWarning:` fields, of `fail('…')` and `new Error('…')`, and of `const …_MSG = '…'`, in server.js, lib/*.js
 * and api/*.js; template literals whose `${NAME}` is a numeric constant of the same file are resolved; the `code:` values,
 * each with the literal message on the same line when there is one. NOT_USER_FACING lists the literals that never reach
 * a reader as an API answer (e-mail wording, logs), each with its reason. A line keyed by a Chinese locale
 * (`'zh-Hans': { message: '新的私信', … }`, lib/notifications.js SETTING_LABELS / LEADS) is wording the API writes in
 * each language itself (its `en:` line is the English), so it is skipped too.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const NOT_USER_FACING = {
  // lib/notifications.js: the topic labels inside the notification e-mail's own text (the e-mail is written per locale)
  '新的站内消息': 'e-mail wording, written per locale by the API',
  '新的站內訊息': 'e-mail wording, written per locale by the API',
};

/** `'zh-Hans': { … }` / `'zh-Hant': { … }`: a table the API keeps per language (e-mail subjects and labels). */
const PER_LOCALE_LINE = /^\s*['"]?zh-Han[st]['"]?\s*:\s*\{/;

const [repo, ref = 'origin/main'] = process.argv.slice(2);
if (!repo) throw new Error('Usage: node scripts/snapshot-api-errors.mjs <api repo> [ref]');
const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 << 20 });
const commit = git('rev-parse', ref).trim();
const files = git('ls-tree', '-r', '--name-only', ref).split('\n').filter(file => /^(?:server\.js|lib\/[^/]+\.js|api\/[^/]+\.js)$/.test(file)).sort();
const HAN = /[㐀-鿿]/;
const QUOTED = String.raw`(['"\`])((?:(?!\1)[^\\]|\\.)*?)\1`;
const PATTERNS = [
  new RegExp(String.raw`\b(?:error|message|notificationWarning)\s*:\s*${QUOTED}`, 'g'),
  new RegExp(String.raw`\bfail\(\s*${QUOTED}`, 'g'),
  new RegExp(String.raw`\bnew Error\(\s*${QUOTED}`, 'g'),
  new RegExp(String.raw`\bconst [A-Z][A-Z0-9_]*_MSG\s*=\s*${QUOTED}`, 'g'),
];
const messages = new Map();
const codes = new Map();
const unresolved = [];
const sources = new Map(files.map(file => [file, git('show', `${ref}:${file}`)]));
// Numeric limits (`const MAX_… = 200;`) and message constants (`const …_MSG = '…';`), across files: a module may import them.
const constants = new Map();
const messageConstants = new Map();
for (const source of sources.values()) {
  for (const match of source.matchAll(/^const ([A-Z][A-Z0-9_]*)\s*=\s*(\d+)\s*;/gm)) constants.set(match[1], match[2]);
  for (const match of source.matchAll(/^const ([A-Z][A-Z0-9_]*_MSG)\s*=\s*'((?:[^'\\]|\\.)*)'/gm)) messageConstants.set(match[1], match[2]);
}
const codeEntry = (code, where) => { const entry = codes.get(code) ?? { code, where, messages: [] }; codes.set(code, entry); return entry; };
for (const [file, source] of sources) {
  // lib/aiBudget.js answers its refusals in the reader's language: CODE: ['简体', '繁體', 'English'].
  for (const match of source.matchAll(/\b([A-Z][A-Z0-9_]{2,}):\s*\[\s*'([^']*[㐀-鿿][^']*)',\s*'[^']*',\s*(["'])((?:(?!\3).)*)\3\s*\]/gs)) {
    const line = source.slice(0, match.index).split('\n').length;
    const entry = codeEntry(match[1], `${file}:${line}`);
    entry.english = match[4];
    if (!entry.messages.includes(match[2])) entry.messages.push(match[2]);
  }
  source.split('\n').forEach((line, index) => {
    if (PER_LOCALE_LINE.test(line)) return;
    const where = `${file}:${index + 1}`;
    const found = [];
    for (const match of line.matchAll(/\berror\s*:\s*([A-Z][A-Z0-9_]*_MSG)\b/g)) if (messageConstants.has(match[1])) found.push(messageConstants.get(match[1]));
    for (const pattern of PATTERNS) for (const match of line.matchAll(pattern)) {
      let text = match[2];
      if (!HAN.test(text)) continue;
      if (text.includes('${')) {
        const resolved = text.replace(/\$\{([A-Z][A-Z0-9_]*)\}/g, (whole, name) => constants.get(name) ?? whole);
        if (resolved.includes('${')) { unresolved.push(`${where} ${text}`); continue; }
        text = resolved;
      }
      text = text.replace(/\\(['"`\\])/g, '$1');
      if (Object.hasOwn(NOT_USER_FACING, text)) continue;
      found.push(text);
      if (!messages.has(text)) messages.set(text, where);
    }
    for (const match of line.matchAll(/\bcode\s*:\s*(['"])([A-Z][A-Z0-9_]{2,})\1/g)) {
      const entry = codeEntry(match[2], where);
      for (const text of found) if (!entry.messages.includes(text)) entry.messages.push(text);
    }
    // fail('message', status, 'CODE')
    for (const match of line.matchAll(new RegExp(String.raw`\bfail\(\s*${QUOTED}\s*,\s*\d{3}\s*,\s*'([A-Z][A-Z0-9_]{2,})'`, 'g'))) {
      const entry = codeEntry(match[3], where);
      if (HAN.test(match[2]) && !entry.messages.includes(match[2])) entry.messages.push(match[2]);
    }
    // an Error subclass's fixed message: class PostImageUploadError … { constructor() { super('…'); } }
    for (const match of line.matchAll(new RegExp(String.raw`\bsuper\(\s*${QUOTED}`, 'g'))) if (HAN.test(match[2]) && !messages.has(match[2])) messages.set(match[2], where);
  });
}
const snapshot = {
  source: 'baylink-backend', commit, files: files.length,
  messages: [...messages].map(([text, where]) => ({ text, where })).sort((a, b) => a.where.localeCompare(b.where, 'en', { numeric: true })),
  codes: [...codes.values()].sort((a, b) => a.code.localeCompare(b.code)),
  unresolvedTemplates: unresolved,
};
writeFileSync('src/i18n/api-errors.snapshot.json', JSON.stringify(snapshot, null, 1) + '\n');
console.log(`API ${commit.slice(0, 7)}: ${snapshot.messages.length} Chinese messages, ${snapshot.codes.length} codes, ${unresolved.length} unresolved templates in ${files.length} files.`);
