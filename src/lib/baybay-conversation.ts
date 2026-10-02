import { API_BASE_URL, authHeaders } from './api';
import { getLocale, simplifySearch } from '../i18n/locale';
import { guides, type Guide } from '../data/guides';
import { LIFE_TOOLS } from '../data/tool-catalog';
import { SLUG_TO_CATEGORY } from '../routing';
import type { BayBayInteractiveCard } from '../components/BayBaySmartCard';
import type { OutingFilters } from './outings';
import { parsePlannerWebResult, type PlannerWebResult } from './planner-web-search';

export type BayBaySearchMode = 'smart' | 'web' | 'site';
export type BayBayRetrieval = { requestedMode: BayBaySearchMode; scope: 'site' | 'web' | 'site+web' | 'none'; webStatus: 'not_requested' | 'completed' | 'unavailable' | 'not_applicable'; checkedAt?: string; requestedDate?: string | null; cached?: boolean; sourceCount?: number };

export type BayBayHistoryMessage = { role: 'user' | 'assistant'; content: string };
export type GuideChatAction = {
  label: string; type: 'category' | 'guide' | 'post' | 'postAssist';
  url?: string; postType?: 'client' | 'provider'; category?: string;
};
export type GuideChatResponse = {
  ok: boolean; answer?: string; error?: string; code?: string;
  suggestedGuides?: { title: string; slug: string; url: string }[];
  suggestedActions?: GuideChatAction[]; safetyNote?: string;
  interactiveCards?: BayBayInteractiveCard[]; matchingPosts?: unknown[];
  matchNote?: string; degraded?: boolean;
  responseMode?: string; outingSearch?: BayBayOutingSearch;
  retrieval?: BayBayRetrieval;
  sources?: { title: string; url: string }[];
  webCandidates?: PlannerWebResult['candidates'];
};

/** Only validated response citations can become clickable references or saved candidates. */
export function bayBayWebResult(response: GuideChatResponse): PlannerWebResult | null {
  if (response.retrieval?.webStatus !== 'completed' || !['web', 'site+web'].includes(response.retrieval.scope)) return null;
  return parsePlannerWebResult({ ok: true, responseMode: 'web', answer: response.answer, sources: response.sources,
    candidates: response.webCandidates, checkedAt: response.retrieval.checkedAt, cached: response.retrieval.cached });
}

/** Carry the user's own requirements forward; model recommendations are never treated as user facts. */
export function bayBayTaskBrief(turns: BayBayTurn[]): string {
  const questions = turns.filter(turn => turn.state === 'complete').slice(-4).map(turn => turn.question.trim().slice(0, 500)).filter(Boolean);
  // Remove superseded dimensions; never use model answers as user facts.
  const dates = /\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b|(?:20\d{2}\s*年\s*)?\d{1,2}\s*(?:月|\/)\s*\d{1,2}(?:\s*(?:日|号|號))?|\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+20\d{2})?\b|(?:(?:这|這|本|下下?|上上?)\s*)?(?:周|週|星期)[一二三四五六日天末]|今天|明天|后天|後天|\b(?:(?:this|next|following|coming|last)\s+)?(?:sun(?:day)?|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|weekend)\b|\b(?:day after tomorrow|tomorrow|today)\b/giu;
  const budget = /(?:(?:每人|每位|人均|总共|總共|总|總|全程|per person|total)\s*)?(?:(?:门票|門票|入场|入場|admission)\s*)?(?:(?:预算|預算|budget|under|below|up to|at most|within|不超过|不超過|最多)\s*)?(?:[$＄]\s*\d[\d,.]*|USD\s*\d[\d,.]*|\d[\d,.]*\s*(?:美元|美金|USD|刀))(?:\s*(?:以内|以內|以下|封顶|封頂|per person|each|total))?|(?:门票|門票|admission)?\s*(?:预算|預算|budget)\s*(?:改为|改為|改成|最多|不超过|不超過|to|is|of)?\s*\d[\d,.]*(?:\s*(?:以内|以內|以下))?|(?:只(?:要|看|找)|仅|僅)?\s*(?:免费|免費)(?!停车|停車|餐)|\b(?:only\s+)?free(?:\s+(?:admission|entry|only))?\b(?!\s+parking)|(?:预算|預算|budget)\s*(?:不限|无限制|無限制|unlimited)|\bno budget limit\b/giu;
  const transport = /(?:(?:不|没|沒)(?:想|要)?|只(?:想|要))?\s*(?:开车|開車|驾车|駕車)|(?:公共交通|公交|地铁|地鐵|步行)(?:出行)?|\bwithout\s+(?:(?:a|my|our)\s+)?car\b|\b(?:(?:do not|don't|don’t|not|no)\s+)?(?:driv(?:e|ing)|cars?)\b|\b(?:public (?:transit|transport(?:ation)?)|transit|BART|Muni|walk(?:ing)?)\b/giu;
  const setting = /(?:(?:不|只)(?:想|要|看)?)?\s*(?:室内|室內|户外|戶外|室外)|\b(?:(?:not|no|only)\s+)?(?:indoors?|outdoors?)\b/giu;
  const cityPattern = /\b(?:South San Francisco|San Francisco|San Jos[eé]|San Mateo|Palo Alto|Mountain View|Redwood City|San Rafael|Santa Clara|Santa Cruz|Walnut Creek|Union City|Half Moon Bay|East Bay|South Bay|North Bay|Peninsula|Fremont|Oakland|Berkeley|Sunnyvale|Cupertino|Burlingame|Millbrae|San Bruno|Daly City|Hayward|Alameda|Concord|Pleasanton|Dublin|Livermore|Pacifica|Sausalito|Tiburon|Napa|Sonoma|SF Bay Area|Bay Area|SF)\b|旧金山|舊金山|三藩市|奥克兰|奧克蘭|屋崙|伯克利|柏克萊|圣何塞|聖荷西|弗里蒙特|佛利蒙|費利蒙|东湾|東灣|南湾|南灣|北湾|北灣|半岛|半島|湾区|灣區/giu;
  const has = (pattern: RegExp, value: string) => { pattern.lastIndex = 0; return pattern.test(value); };
  const cities = (value: string) => [...value.matchAll(new RegExp(cityPattern.source, 'giu'))].map(match => ({
    at: match.index!, end: match.index! + match[0].length,
    origin: /(?:从|從|住在|居住在|家在|\bfrom|\bleaving|\bdeparting|\blive in|\bbased in)\s*$/i.test(value.slice(0, match.index)) || /^\s*(?:出发|出發|to\b|[-=]?>|→)/i.test(value.slice(match.index! + match[0].length)),
  }));
  const cleaned = (value: string) => value.replace(/[ \t]+/g, ' ').replace(/^[\s,，;；。]+|[\s,，;；。]+$/g, '').replace(/[,，;；]\s*[,，;；]+/g, '，');
  let carried: string[] = [];
  for (const question of questions) {
    if (/重新开始|重新開始|换个(?:话题|話題|计划|計畫)|\b(?:start over|new topic|new plan)\b/i.test(question)) carried = [];
    const overrides = [dates, budget, transport, setting].filter(pattern => has(pattern, question));
    const newCities = cities(question);
    carried = carried.map(previous => {
      for (const pattern of overrides) previous = previous.replace(pattern, ' ');
      // A destination change keeps a separately stated departure city.
      const replacements = cities(previous).filter(old => newCities.some(next => next.origin === old.origin));
      for (const old of replacements.reverse()) previous = previous.slice(0, old.at) + ' ' + previous.slice(old.end);
      return cleaned(previous);
    }).filter(Boolean);
    carried.push(question);
  }
  const latest = carried.pop() || '';
  const earlier = carried.join('；');
  const prefix = earlier ? `${earlier.slice(0, Math.max(0, 770 - latest.length))}；最新补充：` : '';
  return `${prefix}${latest}`.slice(0, 800);
}
export type BayBayOutingSearch = {
  source: 'site-search'; state: 'ready' | 'needs_clarification';
  filters: Omit<OutingFilters, 'eventId' | 'cursor'> & { sort: 'soonest' };
  missing: ('city' | 'date')[]; question?: string; continuationToken?: string;
};

/** Only the server's bounded search contract may initiate a public outing lookup. */
export function parseBayBayOutingSearch(value: unknown): BayBayOutingSearch {
  const fail = (): never => { throw new BayBayServiceError('小队搜索条件暂时无法读取，请重试；这不代表没有小队。'); };
  const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  if (!record(value) || value.source !== 'site-search' || !['ready', 'needs_clarification'].includes(String(value.state)) || !record(value.filters)
    || !Array.isArray(value.missing) || value.missing.length > 2 || value.missing.some(key => key !== 'city' && key !== 'date') || new Set(value.missing).size !== value.missing.length) return fail();
  const filters = value.filters;
  if (filters.sort !== 'soonest' || Object.keys(filters).some(key => !['sort', 'city', 'q', 'date', 'dateFrom', 'dateTo', 'language', 'seats'].includes(key))) return fail();
  for (const [key, max] of [['city', 80], ['q', 120]] as const) if (filters[key] !== undefined && (typeof filters[key] !== 'string' || !filters[key].trim() || filters[key].length > max)) return fail();
  const day = (v: unknown): v is string => typeof v === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  for (const key of ['date', 'dateFrom', 'dateTo']) if (filters[key] !== undefined && !day(filters[key])) return fail();
  if ((filters.date && (filters.dateFrom || filters.dateTo)) || (typeof filters.dateFrom === 'string' && typeof filters.dateTo === 'string' && filters.dateFrom > filters.dateTo)
    || (filters.language !== undefined && !['zh', 'en'].includes(String(filters.language))) || (filters.seats !== undefined && filters.seats !== 'open')
    || (value.question !== undefined && (typeof value.question !== 'string' || !value.question.trim() || value.question.length > 500))
    || (value.continuationToken !== undefined && (typeof value.continuationToken !== 'string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value.continuationToken) || value.continuationToken.length > 4096))
    || (value.state === 'ready' && value.missing.length) || (value.state === 'needs_clarification' && (!value.missing.length || !value.question))) return fail();
  return value as unknown as BayBayOutingSearch;
}

export function bayBayOutingPath(filters: BayBayOutingSearch['filters'], id?: string): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  if (id) params.set('outing', id);
  return `/together?${params}`;
}
export type BayBayTurn = {
  id: number; question: string; state: 'pending' | 'complete' | 'error' | 'cancelled';
  response?: GuideChatResponse; error?: string; currentPath?: string; restartRequired?: boolean;
};

class BayBayServiceError extends Error {}
class BayBaySearchContextExpiredError extends BayBayServiceError {}
export const isBayBaySearchContextExpired = (error: unknown): boolean => error instanceof BayBaySearchContextExpiredError;

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

/** Social discovery must reach the server even when the same request mentions planning. */
export function isBayBaySocialRequest(message: string): boolean {
  return /找搭子|搭子|找人.{0,8}(?:一起|同行)|有人.{0,12}一起|谁.{0,8}一起|小队|组队|结伴|同行|一起去|\b(?:find|join|look(?:ing)?\s+for|meet)\b.{0,35}\b(?:companions?|budd(?:y|ies)|people|groups?|company)\b|\banyone\b.{0,35}\b(?:join|go|come|together)\b|\b(?:travel|outing|hiking|activity)\s+(?:companions?|budd(?:y|ies))\b/i.test(simplifySearch(message));
}

/** Route clear first-turn outing requests; advice and follow-up questions stay conversational. */
export function isBayBayPlanRequest(message: string): boolean {
  message = simplifySearch(message);
  if (isBayBaySchoolRequest(message) || isBayBaySocialRequest(message)) return false;
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
  context: { currentPath: string; categoryHint?: string; outingSearchToken?: string; searchMode?: BayBaySearchMode; searchContext?: { date?: string; region?: string; city?: string } },
  history: BayBayHistoryMessage[],
  signal: AbortSignal,
  timeoutMs = 55_000,
): Promise<GuideChatResponse> {
  const article = currentBayBayGuide(context.currentPath);
  const { outingSearchToken, searchMode = 'smart', searchContext, ...pageContext } = context;
  const requestContext = { ...pageContext, currentPath: article ? `/guides/${article.slug}` : context.currentPath };
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
          body: JSON.stringify({ message, context: requestContext, history, locale: getLocale(), searchMode, ...(searchContext ? { searchContext } : {}), ...(outingSearchToken ? { outingSearchToken } : {}) }),
        });
        const data = await response.json() as GuideChatResponse;
        if (!response.ok || !data.ok || typeof data.answer !== 'string' || !data.answer.trim()) {
          if (data.code === 'INVALID_OUTING_SEARCH_TOKEN') throw new BayBaySearchContextExpiredError(typeof data.error === 'string' ? data.error : '搜索条件已过期，请开启新对话并重新说明城市和日期。');
          throw new BayBayServiceError(typeof data.error === 'string' ? data.error : 'BayBay 暂时没连上，请重试。');
        }
        if (data.outingSearch !== undefined) return { ...data, outingSearch: parseBayBayOutingSearch(data.outingSearch) };
        if (data.responseMode === 'outing-search') throw new BayBayServiceError('小队搜索条件暂时无法读取，请重试；这不代表没有小队。');
        return data;
      })(),
    ]);
  } finally {
    clearTimeout(timer);
    if (onAbort) signal.removeEventListener('abort', onAbort);
  }
}
