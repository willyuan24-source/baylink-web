import { Link } from 'react-router-dom';
import { EnglishOnly } from './EnglishOnly';
import { ArrowRight, ArrowUpRight, BookOpen, CalendarDays, ChevronRight, Mail, MapPin, MessageCircle, Sparkles, Wrench } from 'lucide-react';
import { BRAND } from '../brandAssets';
import { translateText, useLocale } from '../i18n/locale';

const discoveries = [
  { icon: CalendarDays, number: '01', title: '找活动和优惠', text: '看看本月活动、免费福利和周末好去处。', href: '/this-month', action: '去看活动' },
  { icon: BookOpen, number: '02', title: '看生活攻略', text: '了解租房、搬家、通勤和刚来湾区要准备的事。', href: '/guides', action: '去看攻略' },
  { icon: Wrench, number: '03', title: '用实用工具', text: '算小费、分账、比单价，换算单位或写英文消息。', href: '/tools', action: '打开生活工具箱' },
  { icon: MessageCircle, number: '04', title: '找房源、闲置和服务', text: '浏览或发布本地信息，查看对方资料，再用私信联系。', href: '/#home-feed-section', action: '逛逛邻里信息' },
];

const sourceTextStyle = { fontSize: 'var(--text-body, 1rem)', lineHeight: 1.8, color: 'var(--color-ink, #16352b)', marginTop: 16 };
const CONTACT_EMAIL = 'Baylink.us@gmail.com';
// Body text links are otherwise drawn like plain text here; underline so the address reads as a link (WCAG 1.4.1).
const inlineLinkStyle = { textDecoration: 'underline', textUnderlineOffset: '0.2em' };

/** Public introduction shared by the interactive route and static HTML. */
export function AboutContent({ onAskBayBay }: { onAskBayBay?: () => void }) {
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  return <article className="about-baylink">
    <header className="about-hero">
      <div className="about-hero-copy"><EnglishOnly><span className="about-eyebrow">BAY AREA LIFE</span></EnglishOnly>
        <p className="about-page-label">关于 BAYLINK</p>
        <h1>湾区生活，<br /><em>从这里开始。</em></h1>
        <p className="about-lead">BAYLINK 是一个湾区生活网站。这里有活动优惠、生活攻略、实用工具，也有房源、闲置和本地服务信息。</p>
        <Link to="/this-month" className="about-primary">去看活动<ArrowRight size={17} /></Link>
      </div>
      <div className="about-hero-art"><EnglishOnly><span className="about-art-location"><MapPin size={14} />SAN FRANCISCO BAY AREA</span></EnglishOnly>
        <img src={BRAND.baybayAvatar} alt="BayBay" width={280} height={280} />
        <div><EnglishOnly><span>GOOD TO BE HERE</span></EnglishOnly><p>你的湾区生活助手</p></div>
      </div>
    </header>

    <section className="about-discover" aria-labelledby="about-discover-title">
      <div className="about-section-heading"><h2 id="about-discover-title">你可以在这里做什么？</h2></div>
      <div className="about-discover-grid">{discoveries.map(({ icon: Icon, number, title, text, href, action }) => <section className="about-discover-item" key={number}>
        <div className="about-discover-index"><Icon size={23} /><span>{number}</span></div><h3>{title}</h3><p>{text}</p><Link to={href}>{action}<ChevronRight size={16} /></Link>
      </section>)}</div>
    </section>

    <section className="about-discover" aria-labelledby="about-sources-title">
      <div className="about-section-heading"><h2 id="about-sources-title" style={{ fontSize: 'var(--text-section, 1.5rem)' }}>来源与核验方法</h2></div>
      <p style={sourceTextStyle}>攻略和活动优先引用政府、主办方及服务机构等可核验来源，参考链接列在内容页。邻里帖子由用户发布，联系前请核对发布者资料与实际情况。</p>
      <p style={sourceTextStyle}>指南的「更新」表示内容编辑日期；网页抓取只表示一次读取，不代表人工事实复核。人工核对的范围与日期，以文中的具体说明为准。</p>
      <p style={sourceTextStyle}>阅读时留意「待复核」「需人工确认」和「往期内容」提示。来源读取失败或尚未读取时仍需确认；往期记录不表示现在仍可参加、领取或办理。</p>
      <p style={sourceTextStyle}>行动前，请向对应机构核实个人资格、可用语言、价格与名额；有误的信息可通过下方邮箱告诉我们。</p>
      <p style={sourceTextStyle}>AI 回答与草稿需要核对，生成结果不代表人工审稿。封面注明「AI 原创」或「AI 辅助原创」的，是主题插画，不是机构实景或服务、资格证明。</p>
      <p style={sourceTextStyle} data-testid="about-image-takedown">{t('图片权利人如需更正或下架，请发邮件至', 'Image rights holders who want a picture corrected or removed can email')} <a href={`mailto:${CONTACT_EMAIL}`} translate="no" style={inlineLinkStyle}>{CONTACT_EMAIL}</a>{t('，我们会尽快处理。', '. We will respond as soon as we can.')}</p>
    </section>

    <section className="about-baybay" aria-labelledby="about-baybay-title"><div className="about-baybay-mark"><Sparkles size={27} /></div><div>
      <h2 id="about-baybay-title">BayBay AI 助手</h2>
      <p>BayBay 可以根据站内攻略回答问题，帮你整理发帖内容或沟通草稿，由你确认后发布或发送。</p>
      <p className="about-small">访客模式使用站内资料；登录后可选择联网研究。回答会标明来源，日期、价格、余票和预约仍请向官方确认。</p>
      {onAskBayBay ? <button type="button" onClick={onAskBayBay}>和 BayBay 聊聊<ArrowRight size={16} /></button> : <Link to="/tools?tool=communication">试试 AI 沟通助手<ArrowRight size={16} /></Link>}
    </div></section>

    <section className="about-basics" aria-label="使用说明">
      <p>浏览无需登录，发布信息和发私信请先登录。</p>
      <Link to="/guides/baylink-safety-guide">阅读社区安全指南<ChevronRight size={15} /></Link>
    </section>

    <footer className="about-contact"><div><h2>联系我们</h2><p>有问题、建议，或发现信息有误，欢迎发邮件告诉我们。</p></div>
      <a href={`mailto:${CONTACT_EMAIL}`}><Mail size={18} /><span translate="no">{CONTACT_EMAIL}</span><ArrowUpRight size={16} /></a>
      <nav aria-label="网站说明"><Link to="/terms">服务条款</Link><Link to="/privacy">隐私政策</Link><Link to="/">回到首页<ArrowRight size={14} /></Link></nav>
    </footer>
  </article>;
}
