import { useId } from 'react';
import { ArrowRight, Check, Leaf, MapPin, X } from 'lucide-react';
import { translateText, type Locale } from '../../i18n/locale';
import { BAY_DISCOVERIES } from './bay-discoveries';
import { bayCityForPlace } from './bay-cities';
import { useUnifiedDialog } from './useUnifiedDialog';

export default function BayFieldGuide({locale,collectedIds,onSelect,onClose}:{locale:Locale;collectedIds:readonly string[];onSelect:(id:string)=>void;onClose:()=>void}) {
  const t=(zh:string,en:string)=>locale==='en'?en:translateText(zh,locale);
  const title=useId(),{panel,closeButton,onKeyDown}=useUnifiedDialog(onClose);
  return <div className="ub-overlay" onPointerDown={event=>event.stopPropagation()} onClick={event=>{if(event.target===event.currentTarget)onClose();}}><section className="ub-field-guide" role="dialog" aria-modal="true" aria-labelledby={title} ref={panel} onKeyDown={onKeyDown}>
    <header><div><small>BAYBAY’S FIELD NOTES</small><h3 id={title}>{t('沿途的小发现','Little discoveries along the way')}</h3></div><button ref={closeButton} onClick={onClose} aria-label={t('关闭发现册','Close field notes')}><X size={20}/></button></header>
    <div className="ub-field-intro"><Leaf size={27}/><p>{t('去海边、花园和校园转转。走近发光的小标记，听一段故事，玩一个小挑战。','Wander to the coast, gardens and campuses. Approach a glowing marker for a little story or a playful challenge.')}</p><strong>{collectedIds.length}<span> / {BAY_DISCOVERIES.length}</span></strong></div>
    <div className="ub-field-grid">{BAY_DISCOVERIES.map(item=>{const city=bayCityForPlace(item.placeKey),done=collectedIds.includes(item.id);return <button key={item.id} className={done?'is-collected':''} onClick={()=>onSelect(item.id)}><span className="ub-field-symbol" style={{background:item.color+'25',color:item.color}}>{done?<Check size={23}/>:item.symbol}</span><span><small><MapPin size={11}/>{city?t(city.name,city.nameEn):'BAY AREA'}</small><strong>{t(item.title.zh,item.title.en)}</strong><em>{done?t('已记入回忆 · 再看看','A memory kept · Revisit'):item.kind==='lights'?t('灯光小挑战','A little light puzzle'):item.kind==='conversation'?t('邻里小故事','A local conversation'):t('自然观察','A nature observation')}</em></span><ArrowRight size={16}/></button>;})}</div>
    <footer>{t('发现册只记录游戏中的小回忆。真实出游信息可从景点攻略查看。','These are memories from the miniature world. Place guides help turn them into a real day out.')}</footer>
  </section></div>;
}
