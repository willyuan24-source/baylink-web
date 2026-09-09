import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Expand, MapPin, X } from 'lucide-react';
import type { GuideImage } from '../data/guide-media';
import type { GuideBlock } from '../data/guides';
import { ModalShell } from './ui/Modal';

type FigureProps = { image: GuideImage; variant?: 'cover' | 'inline' | 'poster' };
const isWebLink = (url?: string) => !!url && /^https?:\/\//i.test(url);

function ImageCaption({ image, poster = false }: { image: GuideImage; poster?: boolean }) {
  return <figcaption className="guide-image-caption">
    <p>{image.caption}</p>
    <div className="guide-image-attribution">
      {!poster && image.kind === 'illustration' && <span className="guide-image-kind">AI 插图 · 非实景照片</span>}
      {isWebLink(image.creditUrl) ? <a href={image.creditUrl} target="_blank" rel="noopener noreferrer">{image.credit}<span className="sr-only">（在新标签页打开）</span></a> : <span>{image.credit}</span>}
      {isWebLink(image.licenseUrl) && <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">图片授权<span className="sr-only">（在新标签页打开）</span></a>}
    </div>
  </figcaption>;
}

export function GuideFigure(props: FigureProps) {
  return <GuideFigureSession key={props.image.src} {...props} />;
}

function GuideFigureSession({ image, variant = 'inline' }: FigureProps) {
  const [open, setOpen] = useState(false);
  return <>
    <figure className={`guide-figure guide-figure--${variant}`}>
      <button type="button" className="guide-figure-open" aria-label={`放大图片：${image.alt}`} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <img className="guide-figure-image" src={image.src} srcSet={image.srcSet} sizes={image.srcSet ? `(max-width: 900px) 100vw, ${variant === 'cover' ? 1040 : 760}px` : undefined} alt={image.alt} width={image.width} height={image.height} loading={variant === 'cover' ? 'eager' : 'lazy'} decoding="async" />
        <span className="guide-figure-zoom"><Expand size={15} aria-hidden="true" /><span>查看大图</span></span>
      </button>
      <ImageCaption image={image} poster={variant === 'poster'} />
    </figure>
    {open && <ModalShell label={`图片放大：${image.alt}`} onClose={() => setOpen(false)} className="guide-image-overlay">
      <div className="guide-image-dialog">
        <button type="button" className="guide-image-close" onClick={() => setOpen(false)} aria-label="关闭放大图片"><X size={23} aria-hidden="true" /><span>关闭</span></button>
        <figure>
          <img src={image.src} alt={image.alt} width={image.width} height={image.height} decoding="async" />
          <ImageCaption image={image} poster={variant === 'poster'} />
        </figure>
      </div>
    </ModalShell>}
  </>;
}

type RouteBlock = Extract<GuideBlock, { type: 'route' }>;
export function GuideRouteRenderer({ block, id }: { block: RouteBlock; id: string }) {
  return <RouteSession key={`${id}:${block.title}`} block={block} />;
}

function RouteSession({ block }: { block: RouteBlock }) {
  const [selected, setSelected] = useState(0);
  const [interactive, setInteractive] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const prefix = useId();
  useEffect(() => { setInteractive(true); }, []);
  const choose = (index: number, focus = false) => {
    setSelected(index);
    if (focus) tabs.current[index]?.focus();
  };
  return <section className="guide-route" aria-labelledby={`${prefix}-heading`}>
    <div className="guide-route-heading"><span className="guide-route-eyebrow"><MapPin size={14} aria-hidden="true" /> 把路线，分成几小站</span><h3 id={`${prefix}-heading`}>{block.title}</h3><p>{block.text}</p></div>
    {interactive && block.stops.length > 0 && <div className="guide-route-tabs" role="tablist" aria-label={`${block.title}的步骤`}>
      {block.stops.map((stop, index) => <button type="button" role="tab" key={index} id={`${prefix}-tab-${index}`} aria-controls={`${prefix}-stop-${index}`} aria-selected={selected === index} tabIndex={selected === index ? 0 : -1}
        ref={element => { tabs.current[index] = element; }} onClick={() => choose(index)} onKeyDown={event => {
          const last = block.stops.length - 1;
          let next: number;
          if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = index === last ? 0 : index + 1;
          else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = index === 0 ? last : index - 1;
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = last;
          else return;
          event.preventDefault();
          choose(next, true);
        }}><span>{String(index + 1).padStart(2, '0')}</span><strong>{stop.title}</strong></button>)}
    </div>}
    {/* All stops remain readable in server-rendered/no-JavaScript HTML. */}
    <div className="guide-route-stops">
      {block.stops.map((stop, index) => <div key={index} id={`${prefix}-stop-${index}`} className="guide-route-stop" hidden={interactive && selected !== index} role={interactive ? 'tabpanel' : undefined} aria-labelledby={interactive ? `${prefix}-tab-${index}` : undefined} tabIndex={interactive ? 0 : undefined}>
        <span className="guide-route-stop-number">第 {index + 1} 站 / 共 {block.stops.length} 站</span>
        <h4>{stop.title}</h4><p>{stop.text}</p>
        {isWebLink(stop.mapUrl) && <a href={stop.mapUrl} target="_blank" rel="noopener noreferrer" aria-label={`在地图中查看：${stop.title}（新标签页）`}><MapPin size={15} aria-hidden="true" />在地图中查看<ArrowUpRight size={15} aria-hidden="true" /></a>}
      </div>)}
    </div>
    {interactive && block.stops.length > 1 && <div className="guide-route-controls"><button type="button" disabled={selected === 0} onClick={() => choose(selected - 1, true)}><ArrowLeft size={16} aria-hidden="true" />上一站</button><span aria-live="polite">{selected + 1} / {block.stops.length}</span><button type="button" disabled={selected === block.stops.length - 1} onClick={() => choose(selected + 1, true)}>下一站<ArrowRight size={16} aria-hidden="true" /></button></div>}
  </section>;
}
