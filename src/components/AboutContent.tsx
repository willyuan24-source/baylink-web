import { Suspense } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, BookOpen, CalendarDays, Eye, FileSearch, Mail, RefreshCcw } from 'lucide-react';
import { translateText, useLocale } from '../i18n/locale';
import { FeedbackLink } from '../features/feedback/ReportErrorLink';
import { Button } from './ui/Button';
import { lazyChunk } from '../lib/chunk-recovery';
import { PageContainer, PageHeader } from './ui/PageHeader';
import { useSimpleDisplay } from '../lib/reading-preferences';
import { preloadBayBay } from '../app/baybay-preload';
import { ProvenanceBadge } from './ui/Badges';
import { getImageProvenance, typeCoverProvenance, type ProvenanceInput } from '../lib/image-provenance';

const CONTACT_EMAIL = 'Baylink.us@gmail.com';
// F's Disclosure folds 图片怎么标 in 简洁显示 only, so it loads with that mode instead of with every /about.
const Disclosure = lazyChunk(() => import('./ui/Disclosure'), m => m.Disclosure);

/**
 * The image labels readers meet on covers, written by the function that labels the covers (getImageProvenance), so this
 * page never describes a label the site does not use. The sample inputs are data, not copy: they only select the label (the
 * years are examples), so they are written in English and never shown as text.
 */
const IMAGE_LABELS: readonly { sample: ProvenanceInput; zh: string; en: string }[] = [
  { sample: { kind: 'poster', credit: 'Official', caption: '' }, zh: '主办方、品牌或机构自己发布的图片，或经授权使用的图片。', en: 'Published by the organizer, brand or agency itself, or used with its permission.' },
  { sample: { kind: 'photo', credit: 'CC BY', caption: '2023' }, zh: '第三方拍摄、按授权（如 CC）使用的照片；年份是拍摄年份。', en: 'A third-party photo used under its license (such as CC); the year is when it was taken.' },
  { sample: { kind: 'photo', credit: 'CC BY', caption: '2017 archive' }, zh: '较早的资料照片，帮你认出地方，不代表现场现在的样子。', en: 'An older reference photo that helps you recognize the place; it does not show how it looks today.' },
  { sample: { kind: 'photo', credit: 'BAYLINK', caption: '', ownShot: true, shotAt: '2026-10-10' }, zh: 'BAYLINK 自己拍的照片，后面是拍摄日期。', en: 'A photo BAYLINK took itself, with the date it was taken.' },
  { sample: { kind: 'illustration', credit: 'BAYLINK', caption: '' }, zh: 'AI 生成的主题插画。我们的规则是不拿它当具体活动、优惠或店铺的封面；如果看到这样用了，请告诉我们。', en: 'An AI-generated theme illustration. Our rule is not to use one as the cover of a specific event, offer or shop; if you see one used that way, please tell us.' },
  { sample: { kind: 'illustration', credit: 'BAYLINK', caption: '', scene3d: true }, zh: 'BAYLINK 3D 旧金山里的场景插图（AI 生成、人工挑选），只用于旧金山地点，不是实景照片。', en: 'A scene from BAYLINK’s 3D San Francisco (AI-generated, hand-picked), used for San Francisco places only; not a photograph.' },
];

/**
 * Public introduction shared by the interactive route and static HTML (HOMEIA-03: one positioning line on every surface).
 * UI9-NAV (content arrangement §8): the 1216 frame at x = 112; the H1 block, then 我们怎么核对 (the only target of
 * /about#about-method-title), 能帮你做什么, 图片怎么标, all in columns 1-8 at the reading measure; 联系与反馈 is the last
 * section on a phone and an aside in columns 9-12 on a desktop, level with the H1. 简洁显示 folds 图片怎么标 and hides the
 * 还有 row. The wording and the image-label rows are unchanged.
 */
export function AboutContent({ onAskBayBay }: { onAskBayBay?: () => void }) {
  const simple = useSimpleDisplay();
  const locale = useLocale();
  const english = locale === 'en';
  const t = (zh: string, en: string) => english ? en : translateText(zh, locale);
  const uses = [
    { icon: CalendarDays, to: '/events', title: t('本周末去哪', 'This weekend'), text: t('活动、免费福利和新店，按地区和日期筛选；写清已知的时间、地点、费用和官方页面。', 'Events, free benefits and new shops by area and date, with the time, place, cost and official page where we know them.'), action: t('看本周末', 'See this weekend') },
    { icon: BookOpen, to: '/guides', title: t('办事怎么办', 'Getting things done'), text: t('医疗保险、证件、住房、出行和长辈服务的指南：先看要点，再按步骤办。', 'Guides to health coverage, IDs, housing, transport and senior services: the key facts first, then the steps.'), action: t('看办事指南', 'Browse guides') },
  ];
  const method = [
    { icon: FileSearch, title: t('先找官方来源', 'Official sources first'), text: t('政府、主办方和服务机构的官方页面优先，每条内容都列出来源链接。媒体报道只作参考，标为「来源」而不是「官方来源」。', 'Government, organizer and agency pages come first, and every item links its source. A news report is only a reference and is labelled “Source”, not “Official source”.') },
    // HANDOFF §3.9: the date is the day the official page was read and the listing checked against it, which is often an
    // AI agent's read, so this page never calls it 编辑核对 / 人工核对 (tests/agent-read-wording.test.tsx).
    { icon: BadgeCheck, title: t('核对官网，写下日期', 'Checked against the official page, with the date'), text: t('「官网核对 9/29」表示那天读取了官方页面，按页面核对了时间、地点、费用和条件。读取和核对借助 AI 工具完成，不是逐条人工复核。只有重新读取官方页面并核对后，这个日期才会更新。', '“Source checked Sep 29” means the official page was read that day and the time, place, cost and conditions were checked against it. The reading and checking are done with the help of AI tools; it is not a line-by-line human review. The date changes only when the official page is read and checked again.') },
    { icon: RefreshCcw, title: t('自动比对，有变化就提示', 'Automatic comparison, with a note when a page changes'), text: t('系统会定期重新读取官方页面。「自动比对 10/7 无变化」表示那天读到的内容与核对时一致；页面有实质变化时，条目会提示主办方页面有更新，直到重新核对官网。', 'The system re-reads official pages regularly. “Auto-compared Oct 7, no change” means the page still matched what was checked. When a page changes in substance, the item says the organizer’s page was updated until the listing is checked against it again.') },
    { icon: Eye, title: t('不确定的不写', 'No guessing'), text: t('官方页面没写清的时间和价格，我们不猜，请以官网为准；来源没说免费，就不标免费。已结束的活动保留为往期记录，不代表现在还能参加或领取。', 'If the official page does not give a time or price, we do not guess and point you to it; nothing is marked free unless the source says so. Ended events stay as past records, which does not mean you can still join or claim them.') },
  ];
  const imageNotes = <>
    <p>{t('图片上的标签说明这张图是什么，不说明活动现在的情况。', 'The label on a picture says what the picture is. It says nothing about how the event or place is today.')}</p>
    <dl className="about-labels">
      {IMAGE_LABELS.map(({ sample, zh, en }) => {
        const label = getImageProvenance(sample, english, '2026-10-12');
        return <div key={label}><dt><ProvenanceBadge className="about-badge" label={label} /></dt><dd>{t(zh, en)}</dd></div>;
      })}
      <div><dt><ProvenanceBadge className="about-badge" label={typeCoverProvenance(english)} /></dt><dd>{t('没有合适的图片时，用条目自己的日期、地点和费用排成的信息卡，不是照片。', 'When there is no suitable picture, an information card showing the listing’s own date, place and price. It is not a photo.')}</dd></div>
    </dl>
    <p data-testid="about-image-takedown">{t('图片权利人如需更正或下架，请发邮件至', 'Image rights holders who want a picture corrected or removed can email')} <a href={`mailto:${CONTACT_EMAIL}`} translate="no" style={{ textDecoration: 'underline', textUnderlineOffset: '0.2em' }}>{CONTACT_EMAIL}</a>{t('，我们会尽快处理。', '. We will respond as soon as we can.')}</p>
  </>;
  return <PageContainer size="wide" className="about-page">
    <div className="about-layout">
    <div className="about-main">
    <PageHeader
      breadcrumb={<span><Link to="/">{t('首页', 'Home')}</Link><span aria-hidden="true"> / </span><span aria-current="page">{t('关于 BAYLINK', 'About BAYLINK')}</span></span>}
      title={t('湾区去哪、怎么办', 'Where to go and how to get it done in the Bay')}
      lede={t('有来源的中文答案：本周末去哪、福利和办事怎么准备，每条都附来源和核对日期。', 'With sources: where to go this weekend, which benefits apply and how to get everyday tasks done, each with its source and the date we checked it.')}
      actions={[
        <Button key="events" variant="primary" to="/events">{t('看本周末活动', 'See this weekend')}</Button>,
        onAskBayBay ? <Button key="ask" variant="secondary" onClick={onAskBayBay} onPointerEnter={preloadBayBay} onFocus={preloadBayBay}>{t('问 BayBay', 'Ask BayBay')}</Button> : <Button key="guides" variant="secondary" to="/guides">{t('看办事指南', 'Browse guides')}</Button>,
      ]} />

    <section className="about-section" aria-labelledby="about-method-title">
      <h2 id="about-method-title">{t('我们怎么核对', 'How we check')}</h2>
      <ol className="about-list">
        {method.map(({ icon: Icon, title, text }) => <li key={title}>
          <span className="about-icon" aria-hidden="true"><Icon strokeWidth={1.75} /></span>
          <div><h3>{title}</h3><p>{text}</p></div>
        </li>)}
      </ol>
      <p>{t('发现信息有误，请点详情页的「这条信息有误？」，或用页末的反馈与邮箱告诉我们。邻里信息由用户发布，联系前请核对发布者资料和实际情况。', 'If something is wrong, use “Something wrong here?” on the page, or the feedback button and email at the end of this page. Neighborhood posts come from members; check the poster and the details before you get in touch.')}</p>
    </section>

    <section className="about-section" aria-labelledby="about-uses-title">
      <h2 id="about-uses-title">{t('BAYLINK 能帮你做什么', 'What BAYLINK helps with')}</h2>
      <ul className="about-list">
        {uses.map(({ icon: Icon, to, title, text, action }) => <li key={to}>
          <span className="about-icon" aria-hidden="true"><Icon strokeWidth={1.75} /></span>
          <div><h3>{title}</h3><p>{text}</p><Link className="about-link" to={to}>{action}</Link></div>
        </li>)}
        <li>
          <span className="about-icon" aria-hidden="true"><img src="/brand/otter.svg" alt="" width={28} height={28} /></span>
          <div><h3>{t('问 BayBay', 'Ask BayBay')}</h3>
            <p>{t('用中文或英文问。BayBay 根据站内有来源的指南和活动回答，并在回答下方列出依据；访客模式只用站内资料，登录后可选择联网查。AI 回答可能出错，不代表人工审稿；日期、价格、名额和资格请以官方为准。', 'Ask in Chinese or English. BayBay answers from the site’s sourced guides and events and lists what it used under the answer. Visitors get site-only answers; signed-in members can choose web search. AI answers can be wrong and are not an editor’s review; confirm dates, prices, places and eligibility with the official source.')}</p>
            {onAskBayBay ? <button type="button" className="about-link" onClick={onAskBayBay}>{t('和 BayBay 聊聊', 'Chat with BayBay')}</button> : <Link className="about-link" to="/tools?tool=communication">{t('试试 AI 沟通助手', 'Try the AI message helper')}</Link>}
          </div>
        </li>
      </ul>
      <p className="about-more">{t('还有：', 'Also: ')}<Link to="/explore">{t('按地区找景点', 'Places by area')}</Link><span className="about-more__next"><span aria-hidden="true"> · </span><Link to="/tools">{t('生活工具箱', 'Everyday tools')}</Link></span><span className="about-more__next"><span aria-hidden="true"> · </span><Link to="/opus-bay" reloadDocument>{t('3D 旧金山', '3D San Francisco')}</Link></span><span className="about-more__next"><span aria-hidden="true"> · </span><Link to="/category/rent">{t('邻里信息（测试中）', 'Neighborhood board (beta)')}</Link></span></p>
    </section>

    <section className="about-section" aria-labelledby="about-images-title">
      <h2 id="about-images-title">{t('图片怎么标', 'How images are labelled')}</h2>
      {simple ? <Suspense fallback={null}><Disclosure className="about-images-more" summary={t('看图片标签的说明', 'See what the image labels mean')}>{imageNotes}</Disclosure></Suspense> : imageNotes}
    </section>

    </div>
    <aside className="about-aside">
    <section className="about-section about-contact-section" aria-labelledby="about-contact-title">
      <h2 id="about-contact-title">{t('联系与反馈', 'Contact and feedback')}</h2>
      <p>{t('有问题、建议，或发现信息有误，可以直接在网站上反馈，也可以发邮件告诉我们。浏览不用登录；发布邻里信息和发私信需要登录。', 'Questions, ideas or something wrong? Send feedback right here on the site, or email us. You can browse without an account; posting and messages need you to sign in.')}</p>
      <div className="about-contact">
        <FeedbackLink />
        <Button variant="secondary" href={`mailto:${CONTACT_EMAIL}`} icon={<Mail aria-hidden="true" strokeWidth={1.75} size={18} />}><span translate="no">{CONTACT_EMAIL}</span></Button>
      </div>
      <p className="about-policies"><Link to="/guides/baylink-safety-guide">{t('社区安全指南', 'Community safety guide')}</Link></p>
    </section>
    </aside>
    </div>
  </PageContainer>;
}
