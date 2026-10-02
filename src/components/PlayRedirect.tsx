import { Navigate, useLocation } from 'react-router-dom';
import { OpusBayShell } from './OpusBayShell';
import { opusBayInHalloween, playRedirectTarget } from '../lib/opus-bay-metadata';

/**
 * W9-E-switch · /play is now the 3D San Francisco game (where it sends whom: lib/opus-bay-metadata.ts playRedirectTarget).
 * The /play route: a replace-redirect (no history entry for /play); the game's first paint meanwhile, nothing for a ticket. */
export function PlayRedirect() {
  const { search, hash } = useLocation();
  const to = playRedirectTarget(search);
  return (
    <>
      <Navigate replace to={to + hash} />
      {to.startsWith('/opus-bay') && <OpusBayShell halloween={opusBayInHalloween(new Date(), search)} />}
    </>
  );
}
