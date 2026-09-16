import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, BookOpen, CalendarDays, Mail, MapPin, MessageCircle, Sparkles, Wrench } from 'lucide-react';
import { BRAND } from '../brandAssets';

const discoveries = [
  { icon: CalendarDays, number: '01', title: '找活动和优惠', text: '看看本月活动、免费福利和周末好去处。', href: '/this-month', action: '去看活动' },
  { icon: BookOpen, number: '02', title: '看生活攻略', text: '了解租房、搬家、通勤和刚来湾区要准备的事。', href: '/guides', action: '去看攻略' },
  { icon: Wrench, number: '03', title: '用实用工具', text: '算小费、分账、比单价，换算单位或写英文消息。', href: '/tools', action: '打开生活工具箱' },
  { icon: MessageCircle, number: '04', title: '找房源、闲置和服务', text: '浏览或发布本地信息，查看对方资料，再用私信联系。', href: '/#home-feed-section', action: '逛逛邻里信息' },
];

/** Public introduction shared by the interactive route and static HTML. */
export function AboutContent({ onAskBayBay }: { onAskBayBay?: () => void }) {
  return <article className="about-baylink">
    <header className="about-hero">
      <div className="about-hero-copy"><span className="about-eyebrow">BAY AREA LIFE</span>
        <p className="about-page-label">关于 BAYLINK</p>
        <h1>湾区生活，<br /><em>从这里开始。</em></h1>
        <p className="about-lead">BAYLINK 是一个湾区生活网站。这里有活动优惠、生活攻略、实用工具，也有房源、闲置和本地服务信息。</p>
        <Link to="/this-month" className="about-primary">去看活动<ArrowRight size={17} /></Link>
      </div>
      <div className="about-hero-art"><span className="about-art-location"><MapPin size={14} />SAN FRANCISCO BAY AREA</span>
        <img src={BRAND.baybayAvatar} alt="BayBay" width={280} height={280} />
        <div><span>GOOD TO BE HERE</span><p>你的湾区生活助手</p></div>
      </div>
    </header>

    <section className="about-discover" aria-labelledby="about-discover-title">
      <div className="about-section-heading"><h2 id="about-discover-title">你可以在这里做什么？</h2></div>
      <div className="about-discover-grid">{discoveries.map(({ icon: Icon, number, title, text, href, action }) => <section className="about-discover-item" key={number}>
        <div className="about-discover-index"><Icon size={23} /><span>{number}</span></div><h3>{title}</h3><p>{text}</p><Link to={href}>{action}<ArrowUpRight size={16} /></Link>
      </section>)}</div>
    </section>

    <section className="about-baybay" aria-labelledby="about-baybay-title"><div className="about-baybay-mark"><Sparkles size={27} /></div><div>
      <h2 id="about-baybay-title">BayBay AI 助手</h2>
      <p>BayBay 可以根据站内攻略回答问题，帮你整理发帖内容或沟通草稿，由你确认后发布或发送。</p>
      <p className="about-small">它不实时联网，日期、价格和预约信息请再查官方来源。</p>
      {onAskBayBay ? <button type="button" onClick={onAskBayBay}>和 BayBay 聊聊<ArrowRight size={16} /></button> : <Link to="/tools?tool=communication">试试 AI 沟通助手<ArrowRight size={16} /></Link>}
    </div></section>

    <section className="about-basics" aria-label="使用说明">
      <p>浏览无需登录，发布信息和发私信请先登录。</p>
      <Link to="/guides/baylink-safety-guide">阅读社区安全指南<ArrowUpRight size={15} /></Link>
    </section>

    <footer className="about-contact"><div><h2>联系我们</h2><p>有问题、建议，或发现信息有误，欢迎发邮件告诉我们。</p></div>
      <a href="mailto:Baylink.us@gmail.com"><Mail size={18} /><span translate="no">Baylink.us@gmail.com</span><ArrowUpRight size={16} /></a>
      <nav aria-label="网站说明"><Link to="/terms">服务条款</Link><Link to="/privacy">隐私政策</Link><Link to="/">回到首页<ArrowRight size={14} /></Link></nav>
    </footer>
  </article>;
}
