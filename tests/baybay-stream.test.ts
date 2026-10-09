import test from 'node:test';
import assert from 'node:assert/strict';
import { readBayBayStream, BAYBAY_DRAFT_MAX_CHARS, type BayBayDraft, type BayBayProgress } from '../src/lib/baybay-stream';

function stream(chunks: string[]) { const encoder = new TextEncoder(); return new Response(new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(encoder.encode(chunk)); controller.close(); } }), { headers: { 'Content-Type': 'text/event-stream' } }); }
/** Raw strings are sent verbatim so malformed JSON can be exercised. */
const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`;
const result = { ok: true, answer: '完整答复。' };

test('SSE handles fragmented frames, CRLF, multibyte text and only actual whitelisted progress', async () => {
  const updates: BayBayProgress[] = [];
  const payload = ': keepalive\r\n\r\nevent: progress\r\ndata: {"phase":"site","status":"running","private":"ignored"}\r\n\r\nevent: progress\ndata: {"phase":"hidden-tool","status":"running"}\n\nevent: progress\ndata: {"phase":"site","status":"completed"}\n\nevent: result\ndata: {"ok":true,"answer":"费用待确认。"}\n\n';
  const bytes = new TextEncoder().encode(payload);
  const response = new Response(new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3)); controller.close(); } }));
  assert.deepEqual(await readBayBayStream(response, progress => updates.push(progress)), { ok: true, answer: '费用待确认。' });
  assert.deepEqual(updates, [{ phase: 'site', status: 'running' }, { phase: 'site', status: 'completed' }]);
});

test('SSE refuses truncated, malformed, excessive or result-free output; error frames are returned for normal error handling', async () => {
  for (const payload of ['', 'event: result\ndata: {"ok":true}', 'event: result\ndata: invalid\n\n', 'event: result\ndata: null\n\n', 'event: progress\ndata: {"phase":"site","status":"completed"}\n\n']) await assert.rejects(readBayBayStream(stream([payload])));
  await assert.rejects(readBayBayStream(stream(['x'.repeat(2_000_001)])), /答复过长/);
  await assert.rejects(readBayBayStream(stream([frame('progress', { phase: 'site', status: 'running' }).repeat(201)])), /连接异常/);
  await assert.rejects(readBayBayStream(stream([frame('quick_card', { verified: true, cards: [] }).repeat(201)])), /连接异常/);
  assert.deepEqual(await readBayBayStream(stream(['event: error\ndata: {"ok":false,"code":"INVALID_ASSISTANT_SESSION","error":"重新开始"}\n\n'])), { ok: false, code: 'INVALID_ASSISTANT_SESSION', error: '重新开始' });
});

test('aborting an idle stream cancels its reader rather than leaving the request waiting', async () => {
  let cancelled = false;
  const controller = new AbortController();
  const response = new Response(new ReadableStream({ cancel() { cancelled = true; } }));
  const result = readBayBayStream(response, undefined, controller.signal);
  controller.abort();
  await assert.rejects(result, { name: 'AbortError' }); assert.equal(cancelled, true);
});

test('1,500 drafts are accepted in order, assembled per field and never count toward the stage cap', async () => {
  const frames: string[] = [];
  for (let seq = 0; seq < 1_500; seq++) {
    // Every third draft streams a point (alternating points 0 and 1); the rest stream the lead.
    frames.push(seq % 3 === 0 ? frame('draft', { seq, field: 'point', index: (seq / 3) % 2, text: 'p' }) : frame('draft', { seq, field: 'lead', text: '湾' }));
    if (seq % 10 === 0) frames.push(frame('progress', { phase: 'answer', status: seq % 20 === 0 ? 'running' : 'completed' }));
  }
  const bytes = new TextEncoder().encode(frames.join('') + frame('result', result));
  // Odd chunk sizes split multibyte characters and frames across reads.
  const response = new Response(new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += 997) controller.enqueue(bytes.slice(i, i + 997)); controller.close(); } }));
  const drafts: BayBayDraft[] = [], progress: BayBayProgress[] = [];
  assert.deepEqual(await readBayBayStream(response, update => progress.push(update), undefined, { onDraft: draft => drafts.push(draft) }), result);
  assert.equal(drafts.length, 1_500);
  assert.deepEqual(drafts[0], { lead: '', points: ['p'] }, 'each callback receives its own snapshot');
  assert.deepEqual(drafts.at(-1), { lead: '湾'.repeat(1_000), points: ['p'.repeat(250), 'p'.repeat(250)] });
  assert.equal(progress.length, 150);
});

test('unknown events are ignored, malformed or not, and never count toward the stage cap', async () => {
  const unknown = [
    frame('image', { url: 'https://example.org/cover.webp' }),
    frame('future_event', '{not json'),
    frame('message', { ok: true, answer: 'not the result' }),
    'data: {"ok":true,"answer":"unnamed frames are not results"}\n\n',
    ': keepalive\n\n',
    'event: result\n\n',
  ].join('');
  const progress: BayBayProgress[] = [];
  assert.deepEqual(await readBayBayStream(stream([unknown.repeat(300) + frame('result', result)]), update => progress.push(update)), result);
  assert.deepEqual(progress, []);
});

test('an old server stream without drafts reads exactly as before', async () => {
  const card = { kind: 'event', id: 'fleet-week', title: 'Fleet Week', url: '/events/fleet-week', summary: '官方日期' };
  const payload = [
    ': keepalive\n\n',
    frame('progress', { phase: 'site', status: 'running' }),
    frame('quick_card', { verified: true, cards: [card] }),
    frame('progress', { phase: 'site', status: 'completed' }),
    frame('delta', { validated: false, text: '未经核实' }),
    frame('delta', { validated: true, text: '先看官方日期。' }),
    frame('result', result),
  ].join('');
  const seen = { progress: [] as BayBayProgress[], cards: [] as string[], text: [] as string[], drafts: 0 };
  const handlers = { onCards: (cards: { id: string }[]) => seen.cards.push(...cards.map(item => item.id)), onText: (text: string) => seen.text.push(text), onDraft: () => { seen.drafts++; } };
  assert.deepEqual(await readBayBayStream(stream([payload]), update => seen.progress.push(update), undefined, handlers), result);
  assert.deepEqual(seen, { progress: [{ phase: 'site', status: 'running' }, { phase: 'site', status: 'completed' }], cards: ['fleet-week'], text: ['先看官方日期。'], drafts: 0 });
});

test('the 200-event cap counts progress and quick_card frames only', async () => {
  const stages = frame('progress', { phase: 'site', status: 'running' }).repeat(100) + frame('quick_card', { verified: true, cards: [] }).repeat(100);
  assert.deepEqual(await readBayBayStream(stream([stages + frame('result', result)])), result);
  await assert.rejects(readBayBayStream(stream([stages + frame('progress', { phase: 'site', status: 'completed' }) + frame('result', result)])), /连接异常/);
});

test('oversize drafts are dropped without an error and close the draft, so the preview stays a clean prefix', async () => {
  const lead = (seq: number, text: string) => frame('draft', { seq, field: 'lead', text });
  let drafts: BayBayDraft[] = [];
  const onDraft = (draft: BayBayDraft) => { drafts.push(draft); };
  assert.deepEqual(await readBayBayStream(stream([lead(1, 'x'.repeat(BAYBAY_DRAFT_MAX_CHARS + 1)) + lead(2, '短') + frame('result', result)]), undefined, undefined, { onDraft }), result);
  assert.deepEqual(drafts, []);
  drafts = [];
  const quarter = 'y'.repeat(BAYBAY_DRAFT_MAX_CHARS / 4);
  const filled = [1, 2, 3, 4].map(seq => lead(seq, quarter)).join('') + frame('draft', { seq: 5, field: 'point', index: 0, text: 'z' }) + lead(6, 'z');
  assert.deepEqual(await readBayBayStream(stream([filled + frame('result', result)]), undefined, undefined, { onDraft }), result);
  assert.equal(drafts.length, 4);
  assert.deepEqual(drafts.at(-1), { lead: quarter.repeat(4), points: [] });
  // Without a draft handler, drafts are skipped and the result still arrives.
  assert.deepEqual(await readBayBayStream(stream([filled + frame('result', result)])), result);
});

test('malformed, duplicate and out-of-order drafts are dropped without an error', async () => {
  const malformed = ['{broken', 'null', '[]', '"text"', { field: 'lead', text: 'no seq' }, { seq: -1, field: 'lead', text: 'negative' }, { seq: 11.5, field: 'lead', text: 'fraction' }, { seq: '11', field: 'lead', text: 'string seq' },
    { seq: 11, field: 'title', text: 'unknown field' }, { seq: 11, field: 'point', text: 'no index' }, { seq: 11, field: 'point', index: 3, text: 'fourth point' }, { seq: 11, field: 'point', index: -1, text: 'negative index' },
    { seq: 11, field: 'lead', text: '' }, { seq: 11, field: 'lead', text: 42 }];
  const payload = frame('draft', { seq: 10, field: 'lead', text: '第一句' }) + malformed.map(data => frame('draft', data)).join('')
    + frame('draft', { seq: 10, field: 'lead', text: '重复' }) + frame('draft', { seq: 9, field: 'lead', text: '倒序' })
    + frame('draft', { seq: 12, field: 'point', index: 2, text: '第三点' }) + frame('result', result);
  const drafts: BayBayDraft[] = [];
  assert.deepEqual(await readBayBayStream(stream([payload]), undefined, undefined, { onDraft: draft => drafts.push(draft) }), result);
  assert.deepEqual(drafts, [{ lead: '第一句', points: [] }, { lead: '第一句', points: ['', '', '第三点'] }]);
});
