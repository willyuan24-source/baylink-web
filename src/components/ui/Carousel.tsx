import { Children, useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './ui.css';
import { IconButton } from './Button';
import { cx, useUiCopy } from './ui-copy';

export type CarouselProps = {
  /** Accessible name of the carousel ("长者服务 9 张图解"). */
  label: string;
  /** One child per slide. */
  children: ReactNode;
  /** `rail`: cards with a peek of the next one (home rails); `slides`: one wide slide at a time (guide carousels). */
  variant?: 'rail' | 'slides';
  className?: string;
};

const reducedMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Rounding slack (px) when comparing scroll positions: snapping and sub-pixel layout. */
const SLACK = 2;

/**
 * Where each slide sits when snapped: its distance from the first slide (the track is positioned, so it is the
 * slides' offsetParent, and on phones it has a 16px padding with a matching scroll-padding), clamped to the
 * furthest the track can scroll. On a 3-up desktop rail the last slides cannot reach the start edge, so they share
 * the end position. `end` is null when the track has no measurable overflow; positions are then not clamped.
 */
const snapStops = (track: HTMLElement) => {
  const first = (track.children[0] as HTMLElement | undefined)?.offsetLeft ?? 0;
  const max = track.scrollWidth - track.clientWidth;
  const end = max > 0 ? max : null;
  const stops = Array.from(track.children, slide => {
    const left = (slide as HTMLElement).offsetLeft - first;
    return end === null ? left : Math.min(left, end);
  });
  return { stops, end };
};

/** The slide a scroll position shows: the nearest stop, or the last slide once the track is at its end. */
const indexAt = (track: HTMLElement, left: number) => {
  const { stops, end } = snapStops(track);
  if (end !== null && left >= end - SLACK) return stops.length - 1;
  let nearest = 0;
  stops.forEach((stop, position) => { if (Math.abs(stop - left) < Math.abs(stops[nearest] - left)) nearest = position; });
  return nearest;
};

/**
 * Scroll-snap carousel (design.md §4.5): slides are `role="group"` with "2 / 9" labels, a polite "1/9" counter,
 * dots, 44px previous/next buttons on desktop and ←/→ when the track has focus. Never autoplays.
 */
export function Carousel({ label, children, variant = 'slides', className }: CarouselProps) {
  const { t } = useUiCopy();
  const slides = Children.toArray(children);
  const count = slides.length;
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => setIndex(indexAt(track, track.scrollLeft));
    track.addEventListener('scroll', onScroll, { passive: true });
    return () => track.removeEventListener('scroll', onScroll);
  }, []);

  /** One step to the next distinct scroll position; at the end the counter reads "n/n" and Next is disabled. */
  const step = useCallback((direction: 1 | -1) => {
    const track = trackRef.current;
    const { stops, end } = track ? snapStops(track) : { stops: [] as number[], end: null };
    const current = stops[index] ?? 0;
    let target = index;
    for (let position = index + direction; position >= 0 && position < count; position += direction) {
      if (end === null || Math.abs((stops[position] ?? 0) - current) > SLACK) { target = position; break; }
    }
    if (target === index) return;
    const left = stops[target];
    if (track && left !== undefined && typeof track.scrollTo === 'function') track.scrollTo({ left, behavior: reducedMotion() ? 'auto' : 'smooth' });
    setIndex(end !== null && left !== undefined && left >= end - SLACK ? count - 1 : target);
  }, [count, index]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    step(event.key === 'ArrowRight' ? 1 : -1);
  };

  // Arrow keys work from the track or from any card inside it (the keydown bubbles to the region).
  return <section className={cx('ui-carousel', className)} data-variant={variant} aria-roledescription={t('轮播', 'carousel')} aria-label={label} onKeyDown={onKeyDown}>
    <div ref={trackRef} className="ui-carousel__track" tabIndex={0}>
      {slides.map((slide, position) => <div key={position} className="ui-carousel__slide" role="group" aria-roledescription={t('幻灯片', 'slide')} aria-label={`${position + 1} / ${count}`}>{slide}</div>)}
    </div>
    {count > 1 && <div className="ui-carousel__controls">
      <IconButton className="ui-carousel__prev" label={t('上一张', 'Previous')} disabled={index === 0} onClick={() => step(-1)}><ChevronLeft aria-hidden="true" strokeWidth={1.75} /></IconButton>
      <span className="ui-carousel__dots" aria-hidden="true">{slides.map((_, position) => <span key={position} data-active={position === index ? '' : undefined} />)}</span>
      <span className="ui-carousel__counter" aria-live="polite">{index + 1}/{count}</span>
      <IconButton className="ui-carousel__next" label={t('下一张', 'Next')} disabled={index === count - 1} onClick={() => step(1)}><ChevronRight aria-hidden="true" strokeWidth={1.75} /></IconButton>
    </div>}
  </section>;
}
