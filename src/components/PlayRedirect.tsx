import { useLayoutEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { OpusBayShell } from './OpusBayShell';
import { OPUS_BAY_HEAD_EXTRA_SELECTOR, opusBayInHalloween, playRedirectTarget } from '../lib/opus-bay-metadata';

/**
 * W9-E-switch · /play is now the 3D San Francisco game (where it sends whom: lib/opus-bay-metadata.ts playRedirectTarget).
 * The /play route: a replace-redirect (no history entry for /play); the game's first paint meanwhile, nothing for a ticket.
 * (W9-E-review, E-RC-4 / E-RP-1) vercel.json serves an old ticket /plan.html; where play.html was served anyway, the game
 * shell's extra head tags (seo.ts never writes or removes them) leave with the visitor instead of staying in /plan's head.
 */
export function PlayRedirect() {
  const { search, hash } = useLocation();
  const to = playRedirectTarget(search);
  const ticket = to.startsWith('/plan');
  useLayoutEffect(() => {
    if (ticket) document.head.querySelectorAll(OPUS_BAY_HEAD_EXTRA_SELECTOR).forEach(el => el.remove());
  }, [ticket]);
  return (
    <>
      <Navigate replace to={to + hash} />
      {!ticket && <OpusBayShell halloween={opusBayInHalloween(new Date(), search)} />}
    </>
  );
}
