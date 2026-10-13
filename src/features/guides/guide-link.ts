import type { MouseEvent } from 'react';

/** Preserve app navigation callbacks while allowing copy-link and modified clicks. Lives apart from GuideCard (which reads
 * the media registry) so the guide routes can use it without that registry (WEB-DATA-SPLIT). */
export const handleGuideLinkClick = (
  event: MouseEvent<HTMLAnchorElement>,
  onClick?: () => void,
) => {
  if (
    !onClick ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  onClick();
};
