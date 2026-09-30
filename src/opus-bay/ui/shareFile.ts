/**
 * W7-Q4 · how the album's 保存 / 分享 hand a photo over on this browser (ui/Album.tsx). Pure: node-tested.
 *
 *   share      the system sheet with the file (iOS 15+ Safari, Android Chrome, desktop Chrome / Edge for 分享)
 *   download   an <a download> (desktop 保存, and browsers without file sharing that honour a download)
 *   longpress  the photo shown large as a data: image with 长按图片保存到相册: in-app browsers (WeChat's MicroMessenger,
 *              Facebook, Instagram, LINE, Weibo, QQ …) ignore an <a download> on a blob: URL, yet the old code toasted
 *              照片已保存; a long press on a data: image saves it there (not reliably on a blob: one). iOS without file
 *              sharing takes the same path.
 *
 * 保存 shares the file ONLY (no title / text): with a text item iOS treats the share as mixed content and can drop
 * 存储图像 (Save Image), the album's whole point on an iPhone. 分享 adds the words where the browser accepts them.
 */

export type SaveRoute = 'share' | 'download' | 'longpress';

interface NavLike {
  userAgent?: string;
  maxTouchPoints?: number;
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
}

/**
 * W7-Q8 · iOS plays Web Audio in the "ambient" category: the ring / silent switch (or the Action button's silent mode)
 * mutes the whole game. A hint only (sf-w7-lead §6: `navigator.audioSession.type = 'playback'` would pause the player's
 * own music — not without the owner). Shown on touch iOS: under 音效 in Settings, and on the title after sound is on.
 */
export const SILENT_HINT = { zh: '没声音？iPhone 可能开了静音模式', en: 'No sound? Your iPhone may be in silent mode' } as const;

/** An in-app browser (a WKWebView / WebView inside another app). */
export const IN_APP_UA = /MicroMessenger|WeChat|FBAN|FBAV|FB_IAB|Instagram|\bLine\/|Weibo|\bQQ\/|DingTalk|AlipayClient/i;
export const inAppBrowser = (ua = ''): boolean => IN_APP_UA.test(ua);
export const isIOS = (nav: NavLike | null | undefined): boolean => {
  const ua = nav?.userAgent ?? '';
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (nav?.maxTouchPoints ?? 0) > 1);
};

const canShareData = (nav: NavLike | null | undefined, data: ShareData): boolean => {
  try { return !!nav?.share && !!nav.canShare && nav.canShare(data); } catch { return false; }
};

/** Where this tap goes: the share sheet, a download, or the long-press photo. */
export function saveRoute(nav: NavLike | null | undefined, file: File, asSave: boolean, touch: boolean): SaveRoute {
  if (canShareData(nav, { files: [file] }) && (touch || !asSave)) return 'share';
  if (inAppBrowser(nav?.userAgent) || isIOS(nav)) return 'longpress';
  return 'download';
}

/** What goes to navigator.share: 保存 = the file alone; 分享 = the file with the words when the browser accepts both. */
export function sharePayload(nav: NavLike | null | undefined, file: File, text: string, asSave: boolean): ShareData {
  if (asSave) return { files: [file] };
  const rich: ShareData = { files: [file], title: 'Opus Bay', text };
  return canShareData(nav, rich) ? rich : { files: [file] };
}

/** The file as a data: URL (for the long-press photo). */
export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
