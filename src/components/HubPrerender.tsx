import { getGuidesForCategorySlug } from '../data/guides';
import { LIFE_TOOLS } from '../data/tool-catalog';
import { categoryLabel } from '../lib/hub-metadata';
import { useUiCopy } from './ui/ui-copy';

/**
 * The first paint of /tools and /category/:slug (scripts/prerender.tsx): what crawlers and share previews read before the
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

export function CategoryHubPrerender({ slug }: { slug: string }) {
  const { t } = useUiCopy();
  const label = categoryLabel(slug);
  return <section className="px-5 py-8">
    <h1 className="text-2xl font-bold">{t(`湾区${label.zh}信息`, label.en === 'Other' ? 'Other Bay Area listings' : `Bay Area listings: ${label.en.toLowerCase()}`)}</h1>
    <p className="mt-3">{t('浏览本地资源和邻里需求，联系前请确认地点、价格和时间。', 'Local resources and neighbors’ requests. Before you reach out, confirm the place, the price and the time.')}</p>
    <h2 className="mt-6 font-bold">{t('行动前，先读一份实用指南', 'Before you act, read a practical guide')}</h2>
    <ul className="mt-3 space-y-3">{getGuidesForCategorySlug(slug).map(guide => <li key={guide.slug}>
      <a href={`/guides/${guide.slug}`} className="text-baylink-green underline">{guide.title}</a>
      <p className="mt-1 text-sm">{guide.summary}</p>
    </li>)}</ul>
    <a className="mt-5 inline-block text-baylink-green underline" href="/guides">{t('全部生活指南', 'All guides')}</a>
    <p className="mt-3 text-sm text-baylink-muted">{t('最新帖子和地区筛选会在页面加载后显示。', 'The latest posts and area filters appear once the page has loaded.')}</p>
  </section>;
}
