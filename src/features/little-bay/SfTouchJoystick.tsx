import { useCallback, useEffect, useRef, useState, type MutableRefObject, type PointerEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import type { GardenInput } from './ParkGardenScene';

export default function SfTouchJoystick({ input: inputRef, disabled, label }: {
  input: MutableRefObject<GardenInput>; disabled: boolean; label: string;
}) {
  const pointer = useRef<number | null>(null);
  const surface = useRef<HTMLButtonElement>(null);
  const [thumb, setThumb] = useState({ x: 0, y: 0, active: false });
  const clearAxes = useCallback(() => { inputRef.current.moveX = 0; inputRef.current.moveY = 0; }, [inputRef]);
  const stop = useCallback(() => {
    const id = pointer.current;
    pointer.current = null;
    clearAxes();
    setThumb({ x: 0, y: 0, active: false });
    if (id !== null && surface.current?.hasPointerCapture(id)) surface.current.releasePointerCapture(id);
  }, [clearAxes]);
  useEffect(() => {
    if (disabled) stop();
  }, [disabled, stop]);
  useEffect(() => {
    const visibility = () => { if (document.visibilityState === 'hidden') stop(); };
    window.addEventListener('blur', stop);
    window.addEventListener('resize', stop);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', stop);
      window.removeEventListener('resize', stop);
      document.removeEventListener('visibilitychange', visibility);
      clearAxes();
    };
  }, [clearAxes, stop]);
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || pointer.current !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const radius = rect.width * .31;
    const dx = event.clientX - rect.left - rect.width / 2;
    const dy = event.clientY - rect.top - rect.height / 2;
    const distance = Math.hypot(dx, dy);
    const amount = Math.min(1, distance / radius);
    const scale = distance ? Math.min(radius, distance) / distance : 0;
    // A small dead zone prevents a resting thumb from drifting the character.
    const strength = Math.max(0, (amount - .1) / .9);
    inputRef.current.moveX = distance ? dx / distance * strength : 0;
    inputRef.current.moveY = distance ? -dy / distance * strength : 0;
    setThumb({ x: dx * scale, y: dy * scale, active: true });
  };
  return <div className="sf-touch-controls">
    <button ref={surface} type="button" className={`sf-joystick${thumb.active ? ' is-active' : ''}`} aria-label={label} disabled={disabled}
      onContextMenu={event => event.preventDefault()}
      onPointerDown={event => {
        if (disabled || pointer.current !== null || event.button !== 0) return;
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        move(event);
      }}
      onPointerMove={move}
      onPointerUp={event => { if (event.pointerId === pointer.current) stop(); }}
      onPointerCancel={event => { if (event.pointerId === pointer.current) stop(); }}
      onLostPointerCapture={event => { if (event.pointerId === pointer.current) stop(); }}
      onBlur={event => {
        // A second finger may focus the canvas to orbit while the first keeps moving.
        const next = event.relatedTarget as Node | null;
        if (!next || !event.currentTarget.closest('.sf-stage')?.contains(next)) stop();
      }}>
      <span className="sf-joystick-ring" aria-hidden="true" />
      <ArrowUp className="sf-stick-up" size={14} aria-hidden="true" /><ArrowDown className="sf-stick-down" size={14} aria-hidden="true" />
      <ArrowLeft className="sf-stick-left" size={14} aria-hidden="true" /><ArrowRight className="sf-stick-right" size={14} aria-hidden="true" />
      <span className="sf-joystick-thumb" aria-hidden="true" style={{ transform: `translate(${thumb.x}px, ${thumb.y}px)` }}><span /></span>
    </button>
  </div>;
}
