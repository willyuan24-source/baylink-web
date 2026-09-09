import { API_BASE_URL, authHeaders } from './api';
import { guides } from '../data/guides';
import type { BayBayInteractiveCard } from '../components/BayBaySmartCard';

export type BayBayHistoryMessage = { role: 'user' | 'assistant'; content: string };
export type GuideChatAction = {
  label: string; type: 'category' | 'guide' | 'post' | 'postAssist';
  url?: string; postType?: 'client' | 'provider'; category?: string;
};
export type GuideChatResponse = {
  ok: boolean; answer?: string; error?: string;
  suggestedGuides?: { title: string; slug: string; url: string }[];
  suggestedActions?: GuideChatAction[]; safetyNote?: string;
  interactiveCards?: BayBayInteractiveCard[]; matchingPosts?: unknown[];
  matchNote?: string; degraded?: boolean;
};
export type BayBayTurn = {
  id: number; question: string; state: 'pending' | 'complete' | 'error' | 'cancelled';
  response?: GuideChatResponse; error?: string;
};

export function bayBayErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : '';
  return /[\u4e00-\u9fff]/.test(message) ? message.slice(0, 160) : '暂时连接不上 BayBay，请检查网络后重试。问题已保留。';
}

/** Only completed pairs are context; drafts, cancellations and errors never become model history. */
export function conversationHistory(turns: BayBayTurn[]): BayBayHistoryMessage[] {
  return turns.filter((turn) => turn.state === 'complete' && turn.response?.answer).slice(-4).flatMap((turn) => [
    { role: 'user' as const, content: turn.question.slice(0, 500) },
    { role: 'assistant' as const, content: turn.response!.answer!.slice(0, 1200) },
  ]);
}

export function currentBayBayGuide(path: string) {
  const match = /^\/guides\/([^/?#]+)\/?$/.exec(path);
  if (!match) return undefined;
  try { return guides.find((guide) => guide.slug === decodeURIComponent(match[1])); } catch { return undefined; }
}

export function safeBayBayPath(path?: string): path is string {
  if (!path || /[\\\s]/.test(path)) return false;
  return path === '/guides' || path === '/tools' || /^\/category\/[a-z-]+$/.test(path) ||
    guides.some((guide) => path === `/guides/${guide.slug}`);
}

export const BAYBAY_SCENARIOS = [
  { label: '周末去哪里', icon: '☀', question: '周末想在湾区轻松玩一天，请根据站内攻略帮我选几个方向，再问我出发城市和交通方式。' },
  { label: '省钱带娃', icon: '✦', question: '想找湾区省钱亲子去处和免费手工，请根据站内最新攻略帮我比较，并提醒年龄、预约和领取条件。' },
  { label: '当月优惠', icon: '↗', question: '站内当月优惠攻略有哪些值得先看？请区分直接免费、需消费和会员优惠，过期项目不要推荐。' },
  { label: '刚来湾区', icon: '⌂', question: '我刚来湾区，想先安排第一个月的生活。请根据站内指南给我三个优先事项，再问我需要补充什么。' },
];

export function bayBayFollowups(question: string, hasArticle: boolean): string[] {
  if (/亲子|带娃|儿童|孩子|手工/.test(question)) return ['孩子 6 岁，尽量不花钱，要先预约哪些？', '帮我列出出门前要核实的年龄、名额和材料条件'];
  if (/优惠|免费|省钱|领取/.test(question)) return ['哪些不需要消费？哪些需要会员或 App？', '帮我按预约、会员和领取时间列一个行动清单'];
  if (/周末|去处|哪里|玩|路线/.test(question)) return ['我从东湾出发，不开车，想安排轻松的半天', '如果带孩子同行，这些方向怎么取舍？'];
  if (/租房|租屋|房源|室友/.test(question)) return ['帮我列出联系对方前最需要确认的五件事', '哪些信息还需要我补充？'];
  return hasArticle ? ['根据这篇攻略，帮我列一个行动清单', '哪些内容需要出发前再到官方渠道核实？'] : ['帮我把建议整理成三步行动清单', '为了更适合我，你还需要哪些信息？'];
}

export async function fetchBayBayReply(
  message: string,
  context: { currentPath: string; categoryHint?: string },
  history: BayBayHistoryMessage[],
  signal: AbortSignal,
  timeoutMs = 25_000,
): Promise<GuideChatResponse> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const interrupted = new Promise<never>((_resolve, reject) => {
    onAbort = () => { controller.abort(); reject(new DOMException('已停止生成', 'AbortError')); };
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => { controller.abort(); reject(new Error('等待时间较长，请稍后重试。已保留你的问题。')); }, timeoutMs);
  });
  try {
    return await Promise.race([
      interrupted,
      (async () => {
        if (signal.aborted) throw new DOMException('已停止生成', 'AbortError');
        const response = await fetch(`${API_BASE_URL}/ai/guide-chat`, {
          method: 'POST', headers: authHeaders(), signal: controller.signal,
          body: JSON.stringify({ message, context, history }),
        });
        const data = await response.json() as GuideChatResponse;
        if (!response.ok || !data.ok || typeof data.answer !== 'string' || !data.answer.trim()) {
          throw new Error(typeof data.error === 'string' ? data.error : 'BayBay 暂时没连上，请重试。');
        }
        return data;
      })(),
    ]);
  } finally {
    clearTimeout(timer);
    if (onAbort) signal.removeEventListener('abort', onAbort);
  }
}
