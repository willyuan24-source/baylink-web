export type BayBayProgress = { phase: 'site' | 'research' | 'sources' | 'routes' | 'answer'; status: 'running' | 'completed' };
const phases = new Set(['site', 'research', 'sources', 'routes', 'answer']);
export type BayBayQuickCard = { kind: 'guide' | 'event' | 'offer' | 'opening'; id: string; title: string; url: string; summary: string; date?: string; temporalStatus?: string };
/** One SSE `draft` frame: unvalidated model text, appended in `seq` order. The `result` frame replaces it. */
export type BayBayDraftEvent = { seq: number; field: 'lead' | 'point'; index?: number; text: string };
/** The draft assembled so far, as display text (`bayBayDraftDisplayText`). Points are indexed like the answer's `points[]`; a point not yet streamed is ''. */
export type BayBayDraft = { lead: string; points: string[] };
export type BayBayStreamHandlers = { onCards?: (cards: BayBayQuickCard[]) => void; onText?: (text: string) => void; onDraft?: (draft: BayBayDraft) => void };
/** SSE dialect this reader understands, sent with each request so the server streams `draft` only to capable tabs (RC-21). */
export const BAYBAY_STREAM_VERSION = 3;
export const BAYBAY_STREAM_MAX_BYTES = 2_000_000;
/** Only `progress` and `quick_card` frames count. Drafts, deltas, heartbeats and unknown frames are bounded by bytes. */
export const BAYBAY_STREAM_MAX_STAGE_EVENTS = 200;
export const BAYBAY_DRAFT_MAX_CHARS = 4_000;
/** The fast-path answer allows up to five points (a day plan or a multi-part request). */
export const BAYBAY_DRAFT_MAX_POINTS = 5;
const validCardDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const temporalStatuses = new Set(['past', 'inactive', 'upcoming', 'current', 'unknown', 'ended']);
export function parseBayBayQuickCards(value: unknown): BayBayQuickCard[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 6).filter((card): card is BayBayQuickCard => {
    if (!card || typeof card !== 'object') return false;
    const prefixes = { guide: 'guides', event: 'events', offer: 'offers', opening: 'openings' };
    const prefix = prefixes[card.kind as keyof typeof prefixes];
    return !!prefix && typeof card.id === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(card.id) && card.url === `/${prefix}/${card.id}` && typeof card.title === 'string' && card.title.length > 0 && card.title.length <= 300 && typeof card.summary === 'string' && card.summary.length <= 1600;
  }).map(card => ({ kind: card.kind, id: card.id, title: card.title, url: card.url, summary: card.summary, ...(validCardDate(card.date) ? { date: card.date } : {}), ...(typeof card.temporalStatus === 'string' && temporalStatuses.has(card.temporalStatus) ? { temporalStatus: card.temporalStatus } : {}) }));
}

/** A well-formed draft frame, or null. Malformed drafts are dropped, never raised as stream errors. */
export function parseBayBayDraftEvent(value: unknown): BayBayDraftEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { seq, field, index, text } = value as Record<string, unknown>;
  if (typeof seq !== 'number' || !Number.isSafeInteger(seq) || seq < 0 || typeof text !== 'string' || !text) return null;
  if (field === 'lead') return { seq, field, text };
  if (field === 'point' && typeof index === 'number' && Number.isSafeInteger(index) && index >= 0 && index < BAYBAY_DRAFT_MAX_POINTS) return { seq, field, index, text };
  return null;
}

/** Drafts are unvalidated model text. Source markers (`[[ref]]`), citation numbers and links are resolved only by the
 * validated result, so a preview never shows them, including a marker or link that is still streaming at the end. */
export function bayBayDraftDisplayText(text: string): string {
  return text
    .replace(/\[\[[^\]\r\n]*(?:\]\]?|$)/g, '')
    .replace(/!?\[([^[\]\r\n]*)\]\([^)\s]*\)?/g, '$1')
    .replace(/\bhttps?:\/\/[^\s<>"'`[\]()（）\p{Script=Han}，。；：！？、【】《》「」『』]*/giu, url => /[.,;:!?]+$/.exec(url)?.[0] ?? '')
    .replace(/\[\d{1,3}\]|\[\d{0,3}$/g, '')
    // Whitespace runs collapse first so the steps below stay linear on any input.
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?[(（] ?[)）]/g, '')
    .replace(/ (?=[,.;:!?，。；：！？、）)]|$)/gm, '')
    .trim();
}

/** Appends drafts in strictly increasing `seq` order within the character budget. The first draft over budget closes the draft, so what was shown stays a clean prefix. */
function createDraftAssembler(onDraft?: (draft: BayBayDraft) => void) {
  let lead = '', points: string[] = [], chars = 0, lastSeq = -1, closed = false;
  return (data: string) => {
    if (closed || !onDraft) return;
    let value: unknown;
    try { value = JSON.parse(data); } catch { return; }
    const draft = parseBayBayDraftEvent(value);
    if (!draft || draft.seq <= lastSeq) return;
    if (chars + draft.text.length > BAYBAY_DRAFT_MAX_CHARS) { closed = true; return; }
    lastSeq = draft.seq; chars += draft.text.length;
    if (draft.index === undefined) lead += draft.text;
    else { const index = draft.index; points = Array.from({ length: Math.max(points.length, index + 1) }, (_, i) => (points[i] || '') + (i === index ? draft.text : '')); }
    onDraft({ lead: bayBayDraftDisplayText(lead), points: points.map(bayBayDraftDisplayText) });
  };
}

/** A bounded SSE transport for real server stages; never infer progress from elapsed time. */
export async function readBayBayStream(response: Response, onProgress?: (progress: BayBayProgress) => void, signal?: AbortSignal, handlers?: BayBayStreamHandlers): Promise<unknown> {
  if (!response.body) throw new Error('答复连接中断，请重试。');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', abort, { once: true });
  const appendDraft = createDraftAssembler(handlers?.onDraft);
  let buffer = '', bytes = 0, stageEvents = 0;
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException('已停止生成', 'AbortError');
      const next = await reader.read();
      if (signal?.aborted) throw new DOMException('已停止生成', 'AbortError');
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > BAYBAY_STREAM_MAX_BYTES) throw new Error('答复过长，请缩小问题范围后重试。');
      buffer += decoder.decode(next.value, { stream: true });
      let separator: RegExpExecArray | null;
      while ((separator = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, separator.index); buffer = buffer.slice(separator.index + separator[0].length);
        let event = 'message'; const lines: string[] = [];
        for (const line of frame.split(/\r?\n/)) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) lines.push(line.slice(5).replace(/^ /, ''));
        }
        if ((event === 'progress' || event === 'quick_card') && ++stageEvents > BAYBAY_STREAM_MAX_STAGE_EVENTS) throw new Error('答复连接异常，请重试。');
        if (event === 'draft') { if (lines.length) appendDraft(lines.join('\n')); continue; }
        if (!['progress', 'result', 'error', 'quick_card', 'delta'].includes(event) || !lines.length) continue;
        let data: unknown;
        try { data = JSON.parse(lines.join('\n')); } catch { throw new Error('答复格式异常，请重试。'); }
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('答复格式异常，请重试。');
        if (event === 'quick_card') { if ((data as { verified?: unknown }).verified === true) handlers?.onCards?.(parseBayBayQuickCards((data as { cards?: unknown }).cards)); continue; }
        if (event === 'delta') { const chunk = data as { validated?: unknown; text?: unknown }; if (chunk.validated === true && typeof chunk.text === 'string' && chunk.text.length <= 10_000) handlers?.onText?.(chunk.text); continue; }
        if (event !== 'progress') return data;
        const { phase, status } = data as Record<string, unknown>;
        if (typeof phase === 'string' && phases.has(phase) && (status === 'running' || status === 'completed')) onProgress?.({ phase: phase as BayBayProgress['phase'], status });
      }
    }
    throw new Error('答复连接中断，尚未收到完整结果，请重试。');
  } finally { signal?.removeEventListener('abort', abort); await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
