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
    const onScroll = () => {
      const start = track.scrollLeft;
      let nearest = 0;
      let distance = Number.POSITIVE_INFINITY;
      Array.from(track.children).forEach((slide, position) => {
        const gap = Math.abs((slide as HTMLElement).offsetLeft - track.offsetLeft - start);
        if (gap < distance) { distance = gap; nearest = position; }
      });
      setIndex(nearest);
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    return () => track.removeEventListener('scroll', onScroll);
  }, []);

  const go = useCallback((next: number) => {
    const target = Math.max(0, Math.min(count - 1, next));
    if (target === index) return;
    const track = trackRef.current;
    const slide = track?.children[target] as HTMLElement | undefined;
    if (track && slide && typeof track.scrollTo === 'function') track.scrollTo({ left: slide.offsetLeft - track.offsetLeft, behavior: reducedMotion() ? 'auto' : 'smooth' });
    setIndex(target);
  }, [count, index]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    go(index + (event.key === 'ArrowRight' ? 1 : -1));
  };

  // Arrow keys work from the track or from any card inside it (the keydown bubbles to the region).
  return <section className={cx('ui-carousel', className)} data-variant={variant} aria-roledescription={t('轮播', 'carousel')} aria-label={label} onKeyDown={onKeyDown}>
    <div ref={trackRef} className="ui-carousel__track" tabIndex={0}>
      {slides.map((slide, position) => <div key={position} className="ui-carousel__slide" role="group" aria-roledescription={t('幻灯片', 'slide')} aria-label={`${position + 1} / ${count}`}>{slide}</div>)}
    </div>
    {count > 1 && <div className="ui-carousel__controls">
      <IconButton className="ui-carousel__prev" label={t('上一张', 'Previous')} disabled={index === 0} onClick={() => go(index - 1)}><ChevronLeft aria-hidden="true" strokeWidth={1.75} /></IconButton>
      <span className="ui-carousel__dots" aria-hidden="true">{slides.map((_, position) => <span key={position} data-active={position === index ? '' : undefined} />)}</span>
      <span className="ui-carousel__counter" aria-live="polite">{index + 1}/{count}</span>
      <IconButton className="ui-carousel__next" label={t('下一张', 'Next')} disabled={index === count - 1} onClick={() => go(index + 1)}><ChevronRight aria-hidden="true" strokeWidth={1.75} /></IconButton>
    </div>}
  </section>;
}
