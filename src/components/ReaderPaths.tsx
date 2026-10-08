import { ChevronRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { READER_PATHS } from '../data/reader-paths';
import { handleGuideLinkClick } from './GuideCard';

export function ReaderPaths({ onOpenGuide }: { onOpenGuide: (slug: string) => void }) {
  const [params, setParams] = useSearchParams();
  const selected = READER_PATHS.find(path => path.id === params.get('audience'))
    || READER_PATHS[params.get('category') === 'newcomer' ? 1 : 0];
  return <section id="reader-paths" className="daily-guide-topics reader-paths" aria-labelledby="reader-paths-title">
    <div className="daily-guide-heading"><div>
      <span className="bl-guide-eyebrow">YOUR NEXT STEP IN THE BAY</span>
      <h2 id="reader-paths-title">按你的生活阶段，找到下一步</h2>
      <p>来玩几天，刚搬过来，或已经住了很久，都从眼前要做的事开始。</p>
    </div></div>
    <div className="reader-path-tabs" role="group" aria-label="选择阅读路径">
      {READER_PATHS.map(path => <button type="button" key={path.id} aria-pressed={selected.id === path.id}
        aria-controls="reader-path-panel" onClick={() => setParams(current => {
          const next = new URLSearchParams(current); next.set('audience', path.id); return next;
        }, { preventScrollReset: true })}>{path.label}</button>)}
    </div>
    <div id="reader-path-panel" aria-labelledby="reader-path-selection">
      <h3 id="reader-path-selection">{selected.title}</h3>
      <p className="reader-path-intro">{selected.intro}</p>
      <div className="reader-path-prep"><p>{selected.online}</p><p>{selected.offline}</p></div>
      <div className="daily-guide-grid">{selected.paths.map((path, index) => <Link key={path.slug} to={'/guides/' + path.slug}
        onClick={event => handleGuideLinkClick(event, () => onOpenGuide(path.slug))}>
        <span className="daily-guide-number">{String(index + 1).padStart(2, '0')}</span>
        <span><h3>{path.label}</h3><p>{path.text}</p></span>
        <ChevronRight size={17} aria-hidden="true" />
      </Link>)}</div>
    </div>
    <p className="reader-path-note">每篇附核验日期与来源；具体余位、服务状态和个人资格请在办理前再确认。</p>
  </section>;
}
