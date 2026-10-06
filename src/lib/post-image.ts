/** Only unsigned public Cloudinary image URLs are resized. Other providers retain their original URL. */
export function postImageUrl(source: string, width = 960): string {
  const match = /^https:\/\/res\.cloudinary\.com\/([a-z0-9_-]+)\/image\/upload\/(.+)$/i.exec(source);
  if (!match || /^s--/.test(match[2]) || !Number.isFinite(width)) return source;
  const size = Math.max(160, Math.min(1600, Math.round(width)));
  return `https://res.cloudinary.com/${match[1]}/image/upload/f_auto,q_auto,c_limit,w_${size}/${match[2]}`;
}
