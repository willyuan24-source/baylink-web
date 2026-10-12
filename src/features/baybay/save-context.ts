import { createContext, useContext } from 'react';

/**
 * Whose saves the answer cards' ♡ writes: the panel's signed-in owner, or a guest (undefined). The panel passes it down
 * because it can open outside the router outlet, where the app context's user is not the one it was opened for.
 */
export const BayBayOwnerContext = createContext<string | undefined>(undefined);
export const useBayBayOwner = () => useContext(BayBayOwnerContext);
