import { useId, useState, type CSSProperties } from 'react';
import { ArrowRight, Check, Leaf, Lightbulb, Navigation, RotateCcw, Sparkles, Sun, Waves, X } from 'lucide-react';
import { translateText, type Locale } from '../../i18n/locale';
import { canCollectDiscovery, discoveryFor, discoverySequenceMatches, type BayDiscoveryContext, type DiscoveryText } from './bay-discoveries';
import type { useBayDiscoveries } from './useBayDiscoveries';
import { useUnifiedDialog } from './useUnifiedDialog';
import { getUnifiedPlace } from './unified-bay-world';

export type BayDiscoveryPanelProps = {
  discoveryId: string; locale: Locale; discovery: ReturnType<typeof useBayDiscoveries>; context: BayDiscoveryContext;
  onNavigate: (placeKey: string) => void; onClose: () => void;
};
const icons = { wave: Waves, leaf: Leaf, sun: Sun };

export default function BayDiscoveryPanel({ discoveryId, locale, discovery, context, onNavigate, onClose }: BayDiscoveryPanelProps) {
  const titleId = useId(), { panel, closeButton, onKeyDown } = useUnifiedDialog(onClose);
  const [choiceId, setChoiceId] = useState<string | null>(null), [sequence, setSequence] = useState<string[]>([]), [missed, setMissed] = useState(false);
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const words = (value: DiscoveryText) => t(value.zh, value.en);
  const item = discoveryFor(discoveryId);
  if (!item) return null;
  const place = getUnifiedPlace(item.placeKey), saved = discovery.progress.memories[item.id], eligible = canCollectDiscovery(item, context);
  const selected = item.options.find(option => option.id === (choiceId || saved?.choiceId));
  const lit = discoverySequenceMatches(item, sequence), lamp = item.kind === 'lights';
  const route = () => { onNavigate(item.placeKey); onClose(); };
  const choose = (id: string) => {
    if (!eligible) return;
    if (!lamp) { setChoiceId(id); return; }
    if (lit) return;
    if (item.sequence?.[sequence.length] !== id) { setSequence([]); setMissed(true); return; }
    const next = [...sequence, id]; setSequence(next); setMissed(false);
    if (discoverySequenceMatches(item, next)) { setChoiceId(id); discovery.collect(item.id, id, { ...context, proof: next }); }
  };

  return <div className="unified-dialog-backdrop" onPointerDown={event => event.stopPropagation()} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={panel} className={`unified-dialog bay-discovery-panel${lamp ? ' is-lights' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown} onKeyUp={event => event.stopPropagation()} style={{ '--discovery-color': item.color } as CSSProperties}>
      <button ref={closeButton} className="unified-dialog-close" type="button" onClick={onClose} aria-label={t('关闭小发现', 'Close discovery')}><X size={20} /></button>
      <div className="unified-dialog-eyebrow">{lamp ? <Lightbulb size={15} /> : <Leaf size={15} />} {t('沿途的小发现', 'A LITTLE DISCOVERY')}</div>
      <div className={`bay-discovery-art${saved || lit ? ' is-collected' : ''}`} aria-hidden="true"><span className="bay-discovery-orbit"/><i>{lamp ? <Lightbulb size={48} strokeWidth={1.25}/> : item.symbol}</i><span className="bay-discovery-spark">✧</span><span className="bay-discovery-leaf">✦</span></div>
      <p className="bay-discovery-location">{place ? t(place.title, place.titleEn) : ''}</p>
      <h3 id={titleId}>{words(item.title)}</h3>
      <div className="bay-discovery-story"><small>{words(item.voice)}</small><p>{words(item.teaser)}</p></div>

      {!eligible && !saved && <div className="bay-discovery-away"><Navigation size={19}/><p>{t('这个小发现正在地图上等你。先走近标记，再开始互动。', 'This discovery is waiting on the map. Approach its marker to begin.')}</p><button className="unified-button unified-button--primary" type="button" onClick={route}>{t('带我去看看', 'Take me there')}<ArrowRight size={15}/></button></div>}

      {(eligible || saved) && <>
        {lamp && <div className="bay-light-puzzle">
          <p className="bay-light-instruction">{t('按这个顺序，让三盏灯依次发亮。', 'Light the three lamps in this order.')}</p>
          <ol className="bay-light-sequence" aria-label={t('灯光顺序', 'Light sequence')}>{item.sequence?.map((id, index) => <li key={id} className={index < sequence.length ? 'is-lit' : ''}><span>{index + 1}</span>{words(item.options.find(option => option.id === id)!.label)}{index < sequence.length && <Check size={12}/>}</li>)}</ol>
          <div className="bay-light-buttons">{[...item.options].reverse().map(option => { const Icon = icons[option.id as keyof typeof icons] || Sparkles; return <button key={option.id} type="button" disabled={!eligible || lit} className={sequence.includes(option.id) ? 'is-lit' : ''} onClick={() => choose(option.id)} aria-label={t(`点亮${option.label.zh}`, `Light ${option.label.en}`)}><Icon size={27}/><span>{words(option.label)}</span></button>; })}</div>
          <p className={`bay-light-feedback${missed ? ' is-missed' : ''}`} role="status">{lit ? t('亮起来了！这一束小小的光，属于你的湾区。', 'You lit it! A little beam of light for your Bay.') : missed ? t('顺序打了个结，灯已重置。没关系，从海浪再开始。', 'The order got tangled. Lamps reset: try again, starting with Wave.') : t(`已点亮 ${sequence.length} / 3 盏灯`, `${sequence.length} / 3 lamps lit`)}</p>
          {eligible && (lit || saved) && <button type="button" className="bay-discovery-replay" onClick={() => { setSequence([]); setMissed(false); setChoiceId(null); }}><RotateCcw size={14}/>{t('再玩一次', 'Play again')}</button>}
        </div>}
        {!lamp && eligible && <div className="bay-discovery-options" aria-label={t('选择你的发现', 'Choose your discovery')}>{item.options.map(option => <button key={option.id} type="button" className={selected?.id === option.id ? 'is-selected' : ''} onClick={() => choose(option.id)}><span>{words(option.label)}</span>{selected?.id === option.id ? <Check size={17}/> : <ArrowRight size={17}/>}</button>)}</div>}
        {selected && !lamp && <div className="bay-discovery-reply" role="status"><Sparkles size={18}/><p>{words(selected.reply)}</p></div>}
        {saved && <div className="bay-discovery-memory" role="status"><span><Check size={17}/>{t('已记入发现册', 'KEPT IN YOUR FIELD NOTES')}</span><p>{words(item.options.find(option => option.id === saved.choiceId)!.memory)}</p></div>}
        {!lamp && !saved && selected && <button type="button" className="unified-button unified-button--primary bay-discovery-collect" disabled={!eligible} onClick={() => discovery.collect(item.id, selected.id, context)}><Sparkles size={17}/>{t('把这份回忆收好', 'Keep this little memory')}</button>}
        {!eligible && saved && <button type="button" className="unified-button bay-discovery-return" onClick={route}><Navigation size={16}/>{t('回到这里再玩', 'Visit again to play')}</button>}
      </>}
      <footer className="bay-discovery-note">{discovery.persistent ? t('虚构互动与虚拟纪念，进度保存在当前浏览器。真实出游可查看景点攻略。', 'Fictional interactions and virtual keepsakes, saved in this browser. Place guides help plan a real visit.') : t('浏览器暂时无法保存，回忆仅保留在本次打开期间。此处为虚构互动与虚拟纪念。', 'Storage is unavailable; memories last for this session only. Interactions and keepsakes are fictional.')}</footer>
    </section>
  </div>;
}
