import { API_BASE_URL, authHeaders } from './api';
import { getLocale, simplifySearch } from '../i18n/locale';
import { guides, type Guide } from '../data/guides';
import { LIFE_TOOLS } from '../data/tool-catalog';
import { SLUG_TO_CATEGORY } from '../routing';
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
  response?: GuideChatResponse; error?: string; currentPath?: string;
};

class BayBayServiceError extends Error {}

export function bayBayErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : '';
  return message && (error instanceof BayBayServiceError || /[\u4e00-\u9fff]/.test(message)) ? message.slice(0, 160) : '暂时连接不上 BayBay，请检查网络后重试。问题已保留。';
}

/** Only completed pairs are context; drafts, cancellations and errors never become model history. */
export function conversationHistory(turns: BayBayTurn[]): BayBayHistoryMessage[] {
  return turns.filter((turn) => turn.state === 'complete' && turn.response?.answer).slice(-4).flatMap((turn) => [
    { role: 'user' as const, content: turn.question.slice(0, 500) },
    { role: 'assistant' as const, content: turn.response!.answer!.slice(0, 1200) },
  ]);
}

export function currentBayBayGuide(path: string) {
  // Shared links may carry a language, attribution query or in-page heading.
  const match = /^\/guides\/([^/?#]+)\/?$/.exec(path.split(/[?#]/, 1)[0]);
  if (!match) return undefined;
  try { return guides.find((guide) => guide.slug === decodeURIComponent(match[1])); } catch { return undefined; }
}

export const isBayBaySchoolGuide = (guide?: Pick<Guide, 'slug' | 'tags'>): boolean =>
  !!guide && (guide.tags.includes('学校与学区') || /(?:^|-)schools?(?:-|$)/.test(guide.slug));

export const isBayBaySchoolRequest = (message: string): boolean =>
  /学校|学区|入学|择校|年级|\b(?:schools?|districts?|enrollment|enrolment|kindergarten|grades?|TK|IEP)\b/i.test(simplifySearch(message));

export const BAYBAY_SCHOOL_NOTE = '学校咨询只需地区与拟入读年级；不要发送孩子实名、出生日期、完整住址或证件。学区与分配学校请自行到官方入口核验，不能仅凭城市确定，也不按分数排名。';
export const BAYBAY_SCHOOL_STARTER = '我想了解学校入学：地区是［地区或城市］，拟入读［年级］。请根据站内学校与学区指南说明下一步，不需要孩子实名、生日或完整住址，也不要做学校排名。';

/** These visible prompts ask for planning facts, never a child's identifying information. */
export function bayBayPageQuestions(path: string): { label: string; question: string }[] {
  const guide = currentBayBayGuide(path);
  if (!guide) return [];
  return isBayBaySchoolGuide(guide) ? [
    { label: '先核对学区', question: '请根据当前这篇学校与学区指南，说明如何核对负责学区和入学入口；只问我地区与拟入读年级，不索取孩子实名、生日或完整住址，不凭城市保证分配学校，不做学校排名。' },
    { label: '整理入学步骤', question: '根据这篇学校与学区指南，帮我整理入学步骤、要到官网核实的时间和材料类别。只需了解地区与年级，不要让我在聊天中提交孩子个人资料或证件。' },
    { label: '读懂官方资料', question: '根据这篇学校与学区指南，解释如何阅读官方学校资料和数据的限制，比较课程与服务时该问什么；不生成分数排名，也不承诺学位或分配结果。' },
  ] : [
    { label: '整理行动清单', question: '根据我正在读的这篇攻略，帮我整理三个下一步，并区分已经说明的条件与仍需到官方来源核实的事项。' },
    { label: '出发前核实什么', question: '根据这篇攻略，哪些日期、资格、费用或预约条件需要再到原文列出的来源核实？只说明已有资料，不把攻略更新时间当作实时查询。' },
  ];
}

/** Resolve model references against the published catalog; never display invented titles or URLs. */
export function bayBayReferenceGuides(response?: GuideChatResponse): Guide[] {
  const slugs = new Set<string>();
  const references = Array.isArray(response?.suggestedGuides) ? response.suggestedGuides : [];
  return references.flatMap(reference => {
    if (!reference || typeof reference.slug !== 'string' || typeof reference.url !== 'string') return [];
    const guide = guides.find(item => item.slug === reference.slug && reference.url === `/guides/${item.slug}`);
    if (!guide || slugs.has(guide.slug)) return [];
    slugs.add(guide.slug);
    return [guide];
  }).slice(0, 3);
}

export function bayBayGuideSources(guide: Guide) {
  const urls = new Set<string>();
  return guide.sources.filter(source => {
    try {
      const url = new URL(source.url);
      if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password || urls.has(url.href)) return false;
      urls.add(url.href);
      return true;
    } catch { return false; }
  });
}

export function safeBayBayPath(path?: string): path is string {
  if (!path || !path.startsWith('/') || path.startsWith('//') || /[\\\s#]/.test(path)) return false;
  const [pathname, search = ''] = path.split('?');
  if (path.split('?').length > 2) return false;
  const query = new URLSearchParams(search);
  if ([...query.keys()].some(key => query.getAll(key).length !== 1)) return false;
  if (pathname === '/plan') {
    if ([...query.keys()].some(key => !['q', 'auto', 'import'].includes(key))) return false;
    const question = query.get('q');
    if (question !== null && (question.trim().length < 2 || question.length > 800)) return false;
    if (query.has('auto') && (query.get('auto') !== '1' || !question)) return false;
    return !query.has('import') || (query.get('import') === 'event' && !question && !query.has('auto'));
  }
  if (pathname === '/tools') return [...query.keys()].every(key => key === 'tool') &&
    (!query.has('tool') || LIFE_TOOLS.some(tool => tool.id === query.get('tool')));
  if (search) return false;
  return path === '/guides' || Object.keys(SLUG_TO_CATEGORY).some(category => path === `/category/${category}`) ||
    guides.some((guide) => path === `/guides/${guide.slug}`);
}

export const bayBayPlanPath = (message: string) => `/plan?${new URLSearchParams({ q: message.trim().slice(0, 800), auto: '1' })}`;

/** Route clear first-turn outing requests; advice and follow-up questions stay conversational. */
export function isBayBayPlanRequest(message: string): boolean {
  message = simplifySearch(message);
  if (isBayBaySchoolRequest(message)) return false;
  if (/租房|租屋|维修|清洁|接送|搬家|工作|找服务|房东|landlord|repair|cleaning|moving|job|airport|\brent(?:al|ing)?\b/i.test(message)) return false;
  const outing = /周末|周[一二三四五六日天]|星期|今天|明天|出游|玩|去哪|亲子|孩子|\b(?:weekend|saturday|sunday|tomorrow|outing|trip|day\s*out|kids?|child)\b/i.test(message);
  const planning = /(?:帮我|给我|替我)?.{0,4}(?:安排|规划|计划|排).{0,10}(?:一天|出游|路线|行程|周末)|\b(?:plan|itinerary)\b/i.test(message);
  const specificDay = /周[一二三四五六日天]|星期[一二三四五六日天]|今天|明天|\b(?:saturday|sunday|tomorrow)\b/i.test(message);
  const personalDetails = /预算|[\d一二三四五六七八九十]+\s*岁|\$\s*\d|\b(?:budget|\d+[ -]year[ -]old)\b/i.test(message);
  return outing && (planning || (specificDay && personalDetails));
}

export const BAYBAY_SCENARIOS = [
  { label: '周末去哪里', icon: '☀', question: '周末想在湾区轻松玩一天，请根据站内攻略帮我选几个方向，再问我出发城市和交通方式。' },
  { label: '省钱带娃', icon: '✦', question: '想找湾区省钱亲子去处和免费手工，请根据站内最新攻略帮我比较，并提醒年龄、预约和领取条件。' },
  { label: '当月优惠', icon: '↗', question: '站内当月优惠攻略有哪些值得先看？请区分直接免费、需消费和会员优惠，过期项目不要推荐。' },
  { label: '刚来湾区', icon: '⌂', question: '我刚来湾区，想先安排第一个月的生活。请根据站内指南给我三个优先事项，再问我需要补充什么。' },
];

export function bayBayFollowups(question: string, hasArticle: boolean, schoolContext = false): string[] {
  if (schoolContext || isBayBaySchoolRequest(question)) return ['按已经提供的地区与年级，帮我列出需要向学区核实的事项', '帮我写一段不含孩子个人资料的入学咨询模板'];
  if (/亲子|带娃|儿童|孩子|手工/.test(question)) return ['帮我按已经提供的条件，列出需要提前预约的项目', '帮我列出出门前要核实的年龄、名额和材料条件'];
  if (/优惠|免费|省钱|领取/.test(question)) return ['哪些不需要消费？哪些需要会员或 App？', '帮我按预约、会员和领取时间列一个行动清单'];
  if (/周末|去处|哪里|玩|路线/.test(question)) return ['帮我按已经提供的条件，把推荐整理成出游安排', '帮我按已经提供的条件，比较这些去处的取舍'];
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
  const article = currentBayBayGuide(context.currentPath);
  const requestContext = { ...context, currentPath: article ? `/guides/${article.slug}` : context.currentPath };
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
          body: JSON.stringify({ message, context: requestContext, history, locale: getLocale() }),
        });
        const data = await response.json() as GuideChatResponse;
        if (!response.ok || !data.ok || typeof data.answer !== 'string' || !data.answer.trim()) {
          throw new BayBayServiceError(typeof data.error === 'string' ? data.error : 'BayBay 暂时没连上，请重试。');
        }
        return data;
      })(),
    ]);
  } finally {
    clearTimeout(timer);
    if (onAbort) signal.removeEventListener('abort', onAbort);
  }
}
