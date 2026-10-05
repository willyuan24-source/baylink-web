import test from 'node:test';
import assert from 'node:assert/strict';
import { readBayBayStream, type BayBayProgress } from '../src/lib/baybay-stream';

function stream(chunks: string[]) { const encoder = new TextEncoder(); return new Response(new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(encoder.encode(chunk)); controller.close(); } }), { headers: { 'Content-Type': 'text/event-stream' } }); }

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
  await assert.rejects(readBayBayStream(stream([':heartbeat\n\n'.repeat(201)])), /连接异常/);
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
