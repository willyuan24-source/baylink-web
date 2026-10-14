/**
 * Why the sign-in sheet is open (H76). A guest's 私信 / 请求联系方式 tap records it here just before the sheet opens
 * (app/useContactIntent.ts), so the sheet can say that scene in one line and lead with 注册; every other way into the sheet
 * leaves it empty and gets the generic sheet. Cleared when the contact intent is cancelled or completed.
 */
export type LoginIntent = { kind: 'message'; name?: string };
let current: LoginIntent | null = null;
export const setLoginIntent = (intent: LoginIntent | null): void => { current = intent; };
export const loginIntent = (): LoginIntent | null => current;

/** This browser has signed in or registered before: a returning member's sheet opens on 登录, a new visitor's on 注册. */
const KNOWN_KEY = 'baylink.auth.known.v1';
export const rememberSignedIn = (): void => { try { localStorage.setItem(KNOWN_KEY, '1'); } catch { /* the next sheet opens on 注册 */ } };
export const signedInBefore = (): boolean => { try { return localStorage.getItem(KNOWN_KEY) === '1'; } catch { return false; } };
