import { useId } from 'react';
import { Phone } from 'lucide-react';
import { useUiCopy } from '../../components/ui/ui-copy';
import type { Guide } from '../../data/guides';
import { linkifyPhones, usePlainPhones } from '../../lib/phone-links';
import { SourceMark } from './GuideFactCards';
import type { DiagramItem, GuideDiagram } from './guide-diagrams';

/**
 * H22: one coded diagram in a pilot guide (data: guide-diagrams.ts). Real text, so it translates, reads aloud and grows with
 * Aa; numbers are tap-to-call. Labelled 示意图 and "内容摘自本文" with the guide's source mark; `data-cover="diagram"` lets
 * the image-rhythm probes count it as a picture slot, never as a photo (RC-31).
 */
export function GuideDiagramFigure({ guide, diagram }: { guide: Guide; diagram: GuideDiagram }) {
  const { t, pick } = useUiCopy();
  const titleId = useId();
  const plain = usePlainPhones();
  const tel = (item: DiagramItem) => item.number && (item.tel && !plain?.has(item.tel)
    ? <a className="gd-diagram__tel" href={`tel:${item.tel}`} aria-label={t(`拨打 ${pick(item.title)} ${item.number}`, `Call ${pick(item.title)} ${item.number}`)}><Phone aria-hidden="true" strokeWidth={1.75} /><span>{item.number}</span></a>
    : <span className="gd-diagram__number">{item.number}</span>);
  const text = (item: DiagramItem) => item.text && <span className="gd-diagram__text">{pick(item.text)}</span>;
  const footer = diagram.kind === 'timeline' ? diagram.total : diagram.kind === 'flow' ? undefined : diagram.footer;
  return <figure className="gd-diagram" data-diagram={diagram.kind} data-cover="diagram" aria-labelledby={titleId}>
    <figcaption className="gd-diagram__head"><span className="gd-diagram__tag">{t('示意图', 'Diagram')}</span><strong id={titleId}>{pick(diagram.title)}</strong></figcaption>
    {diagram.kind === 'flow' && <ol className="gd-diagram__flow">{diagram.steps.map((step, index) => <li key={index}>
      <span className="gd-diagram__step" aria-hidden="true">{index + 1}</span>
      <span className="gd-diagram__body"><strong>{pick(step.title)}</strong>{tel(step)}{text(step)}</span>
    </li>)}</ol>}
    {diagram.kind === 'compare' && <ul className="gd-diagram__compare" data-count={diagram.columns.length}>{diagram.columns.map((column, index) => <li key={index}>
      <strong>{pick(column.title)}</strong>{tel(column)}{text(column)}
    </li>)}</ul>}
    {diagram.kind === 'timeline' && diagram.scale && <div className="gd-diagram__scale" aria-hidden="true">{Array.from({ length: diagram.scale.count }, (_, index) => <span key={index} data-on={index + 1 === diagram.scale!.highlight ? '' : undefined}>{index + 1}</span>)}</div>}
    {diagram.kind === 'timeline' && <ol className="gd-diagram__timeline" data-count={diagram.marks.length}>{diagram.marks.map((mark, index) => <li key={index}>
      <span className="gd-diagram__dot" aria-hidden="true" />
      <span className="gd-diagram__body"><strong>{pick(mark.title)}</strong>{tel(mark)}{text(mark)}</span>
    </li>)}</ol>}
    {diagram.kind === 'map' && <ul className="gd-diagram__map">
      {diagram.tiles.map(tile => <li key={tile.area} data-area={tile.area}><strong>{pick(tile.title)}</strong>{tel(tile)}</li>)}
      <li className="gd-diagram__bay" aria-hidden="true"><span>{t('旧金山湾', 'SF Bay')}</span></li>
    </ul>}
    {footer && <p className="gd-diagram__footer">{linkifyPhones(pick(footer), { variant: 'inline' })}</p>}
    <p className="gd-diagram__credit">{t('内容摘自本文', 'From this guide')}{diagram.source ? <SourceMark guide={guide} index={diagram.source} /> : null}</p>
  </figure>;
}
