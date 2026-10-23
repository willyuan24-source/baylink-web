import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { getGuidesForCategorySlug } from '../data/guides';
import { translateText } from '../i18n/locale';
import { LIFE_TOOLS } from '../data/tool-catalog';
import { useUiCopy } from './ui/ui-copy';

/**
 * The first paint of /tools and of a paused /category/:slug (scripts/prerender.tsx): what crawlers and share previews read before the
 * app takes over. It lives in src/ so the site's JSX runtime localizes it — zh-Hant converted, /en from the dictionary
 * and co-located t(zh, en) — and its links keep the page's language (I18N-SEO-02; before, this markup sat inline in the
 * prerender script and shipped Chinese and unprefixed links under /en and Simplified under /zh-Hant).
 */
export function ToolsHubPrerender() {
  const { t } = useUiCopy();
  return <section className="px-5 py-8">
    <h1 className="text-3xl font-bold">{t('湾区生活工具箱', 'Bay Area everyday tools')}</h1>
    <p className="mt-3 leading-relaxed">{t('AI 沟通、日常换算、费用计算和生活清单，让湾区日常更方便。', 'AI message help, everyday conversions, cost calculators and checklists for daily life in the Bay Area.')}</p>
    <ul className="mt-6 space-y-5">{LIFE_TOOLS.map(tool => <li key={tool.id}>
      <a href={`/tools?tool=${tool.id}`} className="text-lg font-semibold text-baylink-green">{tool.title}</a>
      <p className="mt-2 leading-relaxed">{tool.description}</p>
    </li>)}</ul>
    <p className="mt-6 text-sm">{t('互动工具在页面加载后即可使用。计算在浏览器本机完成；AI 沟通只在点击生成后提交内容。', 'The tools work once the page has loaded. Calculations stay in your browser; the AI message helper sends text only when you tap Generate.')}</p>
  </section>;
}

/**
 * The paused board's first paint (COMMUNITY_VISIBLE = false): the paused notice. While the board is shown, a category page's
 * first paint is the board itself in its loading state (CommunityBoard.tsx CategoryBoardPrerender, UI9-R1-POLISH-2: the app
 * replaces it box for box, no layout shift), rendered by scripts/prerender.tsx after its CSS hook.
 */
export function CategoryHubPrerender({ slug }: { slug: string }) {
  const { t } = useUiCopy();
  // Plain markup with CommunityPaused's words: the prerender loads this file before its CSS hook, so it cannot import the
  // WEB-UI primitives. seo.ts marks the page noindex.
  return <section className="px-5 py-8" data-board={slug}>
    <h1 className="text-2xl font-bold">{t('邻里信息暂停中', 'The neighborhood board is paused')}</h1>
    <p className="mt-3">{t('邻里信息（测试中）暂时不显示，也暂停发布。已有的私信和联系请求照常在「消息」里。', 'The neighborhood board (beta) is hidden for now, and posting is paused. Your messages and contact requests are still in Messages.')}</p>
    <p className="mt-5 flex flex-wrap gap-4"><a className="underline" href="/events">{t('看本周末活动', 'This weekend’s events')}</a><a className="underline" href="/guides">{t('办事与生活指南', 'How-to guides')}</a><a className="underline" href="/messages">{t('消息', 'Messages')}</a></p>
  </section>;
}

/**
 * Each board's heading over its guides: the same words as the board's own strip (CategoryGuideStrip.tsx STRIP_TITLES, which
 * this file cannot import: it loads before the prerender's CSS hook; the lane test keeps the two the same).
 */
const CATEGORY_GUIDES_TITLES: Record<string, { zh: string; en: string }> = {
  service: { zh: '找本地服务先看', en: 'Before you hire someone' },
  rent: { zh: '租房前先看', en: 'Before you rent' },
  used: { zh: '二手交易先看', en: 'Before you buy or sell' },
  moving: { zh: '找本地服务先看', en: 'Before you hire someone' },
  cleaning: { zh: '预约清洁先看', en: 'Before you book a cleaner' },
  ride: { zh: '接送通勤先看', en: 'Rides and commuting' },
  repair: { zh: '安排维修先看', en: 'Before you book a repair' },
  translation: { zh: '找翻译先看', en: 'Before you hire a translator' },
  'part-time': { zh: '联系招聘方之前', en: 'Before you contact an employer' },
};

/**
 * The board's guides in the prerendered category page (UI9-R1-POLISH-2): the same section, classes, heading and three guides
 * as the board's own strip (CategoryGuideStrip.tsx, which loads the guides corpus after the page), so a reader before the app
 * runs and a crawler get them in their place under the loading cards. The app's board keeps showing this strip on the URL it
 * was prerendered for (CommunityBoard.tsx prerenderedGuides), so it never drops out and comes back.
 */
export function CategoryGuidesPrerender({ slug }: { slug: string }) {
  const { t, pick, locale } = useUiCopy();
  const items = getGuidesForCategorySlug(slug, 3);
  if (!items.length) return null;
  const title = CATEGORY_GUIDES_TITLES[slug];
  return <section className="cm-guides" aria-labelledby="cm-guides-title">
    <h2 className="cm-guides__title" id="cm-guides-title">{title ? pick(title) : t('相关生活指南', 'Related guides')}</h2>
    <ul className="cm-guides__list">{items.map(guide => <li key={guide.slug}><Link to={`/guides/${guide.slug}`}><span>{translateText(guide.title, locale)}</span><ChevronRight aria-hidden="true" strokeWidth={1.75} /></Link></li>)}</ul>
  </section>;
}
