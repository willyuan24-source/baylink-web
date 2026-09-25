import { useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { translateText, type Locale } from '../../i18n/locale';

export type DiscoveryChallenge = 'light' | 'echo' | 'skyline';
const ECHO_ORDER = [0, 2, 1, 0] as const;
const SKYLINE_ORDER = ['tower', 'pyramid', 'dome'] as const;

/** Small untimed, keyboard/touch playable discoveries. Nothing purchases a reward. */
export default function SfDiscoveryChallenge({ kind, locale, onSolve, completed = false }: { kind: DiscoveryChallenge; locale: Locale; onSolve: () => void; completed?: boolean }) {
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const [lights, setLights] = useState([completed, completed, completed]);
  const [sequence, setSequence] = useState<number[]>(completed ? [...ECHO_ORDER] : []);
  const [skyline, setSkyline] = useState<string[]>(completed ? [...SKYLINE_ORDER] : []);
  const [solved, setSolved] = useState(completed);
  const [retry, setRetry] = useState(false);
  const complete = () => { if (!solved) { setSolved(true); onSolve(); } };
  const reset = () => { setLights([false, false, false]); setSequence([]); setSkyline([]); setRetry(false); };
  const names = [t('红光', 'Red light'), t('绿光', 'Green light'), t('蓝光', 'Blue light')];
  const notes = [t('贝壳', 'Shell'), t('海浪', 'Wave'), t('星星', 'Star')];
  return <section className={`sf-discovery-game sf-discovery-game--${kind}`} aria-label={t('小小发现挑战', 'Little discovery challenge')}>
    <div className="sf-discovery-game-heading"><strong>{kind === 'light' ? t('让灯塔亮起来', 'Light the little beacon') : kind === 'echo' ? t('BAYBAY 的校园暗号', 'BAYBAY’s campus code') : t('拼出城市天际线', 'Build a tiny skyline')}</strong><span>{t('不限时', 'Take your time')}</span></div>
    {kind === 'light' && <>
      <p>{t('打开三束光，让红、绿、蓝在中心相遇。', 'Switch on the three beams and let red, green and blue meet in the center.')}</p>
      <svg viewBox="0 0 300 145" role="img" aria-label={solved ? t('三束光汇成白色灯光', 'Three beams combine into white light') : t('三盏等待点亮的灯', 'Three lamps waiting to light up')}>
        <rect x="1" y="1" width="298" height="143" rx="18" fill="#233f46" />
        {['#eb917e','#a7ce88','#9dc9e2'].map((color,index)=><g key={color} opacity={lights[index] ? .95 : .15}><path d={`M ${45 + index * 105} 116 L 150 35 L 155 110 Z`} fill={color} style={{mixBlendMode:'screen'}} /><circle cx={45 + index * 105} cy="116" r="12" fill={color}/></g>)}
        <circle cx="150" cy="53" r="22" fill={solved ? '#fff8d9' : '#54757a'} /><path d="M144 78h12v28h-12zM136 104h28v8h-28z" fill="#e7c99e" />
        {solved && <path d="M150 12v8M111 26l7 5M182 30l8-5" stroke="#fff2ab" strokeWidth="3" strokeLinecap="round"/>}
      </svg>
      <div className="sf-discovery-game-buttons">{names.map((name,index)=><button key={name} type="button" aria-pressed={lights[index]} disabled={solved} onClick={()=>{const next=lights.map((value,i)=>i===index?!value:value);setLights(next);if(next.every(Boolean))complete();}}>{name}{lights[index]&&<Check size={15}/>}</button>)}</div>
    </>}
    {kind === 'echo' && <>
      <p>{t('按卡片顺序轻点四次。图案一直可见，慢慢试就好。', 'Tap the four symbols in this order. The clue stays visible while you try.')}</p>
      <ol className="sf-discovery-code" aria-label={t('暗号顺序', 'Code order')}>{ECHO_ORDER.map((note,index)=><li key={index} className={sequence.length>index?'is-done':''}><span aria-hidden="true">{['◒','≈','✦'][note]}</span><small>{notes[note]}</small></li>)}</ol>
      <div className="sf-discovery-game-buttons">{notes.map((note,index)=><button key={note} type="button" disabled={solved} onClick={()=>{if(index!==ECHO_ORDER[sequence.length]){setSequence([]);setRetry(true);return;}setRetry(false);const next=[...sequence,index];setSequence(next);if(next.length===ECHO_ORDER.length)complete();}}>{['◒','≈','✦'][index]} {note}</button>)}</div>
    </>}
    {kind === 'skyline' && <>
      <p>{t('按线索拼好三块轮廓：高塔 → 金字塔 → 圆顶。', 'Follow the clue to arrange three silhouettes: tall tower → pyramid → dome.')}</p>
      <div className="sf-discovery-skyline" aria-hidden="true">{[0,1,2].map(index=><div key={index} className={skyline[index]||'empty'}>{skyline[index] ? ['▥','△','◠'][SKYLINE_ORDER.indexOf(skyline[index] as typeof SKYLINE_ORDER[number])] : index+1}</div>)}</div>
      <div className="sf-discovery-game-buttons">{(['dome','tower','pyramid'] as const).map(id=><button key={id} type="button" disabled={solved} aria-disabled={solved||skyline.includes(id)} onClick={()=>{if(skyline.includes(id))return;if(id!==SKYLINE_ORDER[skyline.length]){setSkyline([]);setRetry(true);return;}setRetry(false);const next=[...skyline,id];setSkyline(next);if(next.length===3)complete();}}>{id==='dome'?t('圆顶','Dome'):id==='tower'?t('高塔','Tower'):t('金字塔','Pyramid')}</button>)}</div>
    </>}
    <div className="sf-discovery-game-status" role="status">{solved ? <><Check size={17}/>{t('发现成功！选一个回忆，就能收下旅行章。', 'You found it! Choose a memory to keep your stamp.')}</> : retry ? t('再看看线索，从第一格重新开始。', 'Check the clue and start again from the first symbol.') : t('完成小挑战，解锁这里的回忆。', 'Finish the little challenge to unlock this memory.')}</div>
    {!solved && <button className="sf-discovery-retry" type="button" onClick={reset}><RotateCcw size={13}/>{t('重新开始','Start again')}</button>}
  </section>;
}
