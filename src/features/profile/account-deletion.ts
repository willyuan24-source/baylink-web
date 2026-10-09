/**
 * The deletion phrase in the reader's language (G2). The API (lib/accountPrivacy.js since API-ACCOUNT) accepts any of
 * the three after NFKC, variant characters (账/帐/賬/帳, 注/註, 销/銷, 号/號), spaces and letter case; this mirrors it.
 */
export const DELETE_PHRASES = { 'zh-Hans': '注销我的账号', 'zh-Hant': '註銷我的帳號', en: 'DELETE MY ACCOUNT' } as const;
const VARIANTS: Record<string, string> = { 註: '注', 銷: '销', 帳: '账', 賬: '账', 帐: '账', 號: '号' };
const deletionKey = (value: string) => value.normalize('NFKC').replace(/[註銷帳賬帐號]/g, char => VARIANTS[char]).replace(/\s+/g, '').toUpperCase();
const ACCEPTED_PHRASES = new Set(Object.values(DELETE_PHRASES).map(deletionKey));
export const confirmsDeletion = (value: string) => ACCEPTED_PHRASES.has(deletionKey(value));
