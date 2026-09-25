import { useEffect, useState } from 'react';

/** Detect input capabilities, not viewport size or a brittle user-agent list. */
export function useSfTouchControls() {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)');
    const hover = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setTouch(coarse.matches);
    const pointer = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || event.pointerType === 'pen') setTouch(true);
      else if (event.pointerType === 'mouse' && hover.matches) setTouch(false);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (hover.matches && /^(w|a|s|d|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/i.test(event.key)) setTouch(false);
    };
    update();
    coarse.addEventListener('change', update);
    window.addEventListener('pointerdown', pointer, { passive: true });
    window.addEventListener('keydown', keyboard);
    return () => {
      coarse.removeEventListener('change', update);
      window.removeEventListener('pointerdown', pointer);
      window.removeEventListener('keydown', keyboard);
    };
  }, []);
  return touch;
}
