import { useId, useState } from 'react';
import { ArrowUpRight, Copy, Download, Images } from 'lucide-react';
import { Link } from 'react-router-dom';
import { translateText, useLocale } from '../i18n/locale';
import { copyText } from '../utils/postShare';
import { PERKS_POSTER_CHECKED, perksPosters, perksPosterCaption, type PerksPoster } from '../data/perks-posters';

export function PerksGallery({ compact = false, topic }: { compact?: boolean; topic?: PerksPoster['topic'] }) {
  const locale = useLocale();
  const headingId = useId();
  const t = (value: string) => translateText(value, locale);
  const [notice, setNotice] = useState('');
  const [manualId, setManualId] = useState<string | null>(null);
  const cards = perksPosters.filter(poster => !topic || poster.topic === topic);
  const copy = async (id: string) => {
    const poster = perksPosters.find(item => item.id === id);
    if (!poster) return;
    let copied = false;
    try { copied = await copyText(perksPosterCaption(poster, t)); } catch { /* Keep selectable text available. */ }
    setNotice(copied ? '图文贴文已复制，可以粘贴分享。' : '复制未成功，请在下方选中贴文后手动复制。');
    setManualId(copied ? null : id);
  };
  return <section className={`perks-gallery${compact ? ' perks-gallery--compact' : ''}`} aria-labelledby={headingId}>
    <Link className="perks-gallery-guide" to="/guides/bay-area-retail-freebies-family-deals">按品牌查门店赠品与优惠<ArrowUpRight size={15} aria-hidden="true" /></Link>
    <div className="perks-gallery-heading">
      <div><span className="perks-gallery-eyebrow"><Images size={15} aria-hidden="true" />BAYLINK · SAVE & SHARE</span><h2 id={headingId}>把有用的福利，存成一张图</h2><p>原创中文图文 · 1080 × 1350 · 可查看大图、下载和复制贴文</p></div>
      <span className="perks-gallery-date">{t('静态快照')}<time dateTime={PERKS_POSTER_CHECKED}>{PERKS_POSTER_CHECKED}</time></span>
    </div>
    <div className="perks-gallery-grid">
      {cards.map((poster, index) => <article className="perks-gallery-card" key={poster.id}>
        <a href={poster.path} target="_blank" rel="noreferrer" className="perks-gallery-art" aria-label={`${t('查看图文大图')}：${t(poster.title)}`}>
          <img src={poster.path} width={1080} height={1350} loading="lazy" alt={`${t('BAYLINK 中文福利图文')}：${t(poster.title)}`} />
          <span><ArrowUpRight size={16} aria-hidden="true" />{t('查看大图')}</span>
        </a>
        <div className="perks-gallery-body"><span className="perks-gallery-number">{String(index + 1).padStart(2, '0')} / {String(cards.length).padStart(2, '0')}</span><h3>{poster.title}</h3>
          <div className="perks-gallery-actions"><a href={poster.path} download={`BAYLINK-${poster.id}-2026-10.png`}><Download size={15} aria-hidden="true" />下载 PNG</a><button type="button" onClick={() => void copy(poster.id)} aria-label={`${t('复制贴文')}：${t(poster.title)}`}><Copy size={15} aria-hidden="true" />复制贴文</button></div>
          <Link to={poster.guidePath} className="perks-gallery-source">领取规则与官网来源<ArrowUpRight size={14} aria-hidden="true" /></Link>
          {(!compact || manualId === poster.id) && <details className="perks-gallery-caption" open={manualId === poster.id || undefined}><summary>查看或手动复制贴文</summary><textarea aria-label={`${t('可复制贴文')}：${t(poster.title)}`} readOnly value={perksPosterCaption(poster, t)} onFocus={event => event.currentTarget.select()} rows={7} /></details>}
        </div>
      </article>)}
    </div>
    {notice && <p className="perks-gallery-notice" role="status">{t(notice)}</p>}
    <p className="perks-gallery-note">图中文字为本次核验的静态快照，不代表全站内容都在此日更新。福利规则和库存可能变化，出发前请查看攻略中的官网来源。</p>
  </section>;
}
