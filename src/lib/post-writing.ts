/** Tags describe facts supplied by the author; adding the same suggestion twice is a no-op. */
export function appendPostTags(description: string, tags: string[]): string {
  const seen = new Set((description.match(/#[^\s#]+/gu) || []).map(tag => tag.slice(1).toLocaleLowerCase()));
  const missing: string[] = [];
  for (const raw of tags) {
    const tag = String(raw).replace(/^#+/u, '').replace(/\s+/gu, '').trim();
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    missing.push(`#${tag}`);
    if (missing.length === 5) break;
  }
  return missing.length ? `${description.trim()}\n\n${missing.join(' ')}`.trim() : description;
}

/** Advisory only: questions, quotations and lawful shared-living contexts must remain possible. */
export function needsFairHousingReview(text: string): boolean {
  return /(?:只租|限|不租|不接受|拒绝)[\s:：]*(?:华人|中国人|亚洲人|白人|黑人|单身|女性|女生|男性|男生|有孩|小孩|儿童|残障|残疾|Section\s*8)|(?:Chinese|Asian|white|female|male)\s+only|no\s+(?:children|kids|Section\s*8)/iu.test(text);
}

export const FAIR_HOUSING_SOURCE = 'https://calcivilrights.ca.gov/housing/';
