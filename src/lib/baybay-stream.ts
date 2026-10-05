export type BayBayProgress = { phase: 'site' | 'research' | 'sources' | 'routes' | 'answer'; status: 'running' | 'completed' };
const phases = new Set(['site', 'research', 'sources', 'routes', 'answer']);

/** A bounded SSE transport for real server stages; never infer progress from elapsed time. */
export async function readBayBayStream(response: Response, onProgress?: (progress: BayBayProgress) => void, signal?: AbortSignal): Promise<unknown> {
  if (!response.body) throw new Error('答复连接中断，请重试。');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', abort, { once: true });
  let buffer = '', bytes = 0, events = 0;
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException('已停止生成', 'AbortError');
      const next = await reader.read();
      if (signal?.aborted) throw new DOMException('已停止生成', 'AbortError');
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > 2_000_000) throw new Error('答复过长，请缩小问题范围后重试。');
      buffer += decoder.decode(next.value, { stream: true });
      let separator: RegExpExecArray | null;
      while ((separator = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, separator.index); buffer = buffer.slice(separator.index + separator[0].length);
        if (++events > 200) throw new Error('答复连接异常，请重试。');
        let event = 'message'; const lines: string[] = [];
        for (const line of frame.split(/\r?\n/)) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) lines.push(line.slice(5).replace(/^ /, ''));
        }
        if (!['progress', 'result', 'error'].includes(event) || !lines.length) continue;
        let data: unknown;
        try { data = JSON.parse(lines.join('\n')); } catch { throw new Error('答复格式异常，请重试。'); }
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('答复格式异常，请重试。');
        if (event !== 'progress') return data;
        const { phase, status } = data as Record<string, unknown>;
        if (typeof phase === 'string' && phases.has(phase) && (status === 'running' || status === 'completed')) onProgress?.({ phase: phase as BayBayProgress['phase'], status });
      }
    }
    throw new Error('答复连接中断，尚未收到完整结果，请重试。');
  } finally { signal?.removeEventListener('abort', abort); await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
