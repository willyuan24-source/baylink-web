/** The "发给家人" form of a link: it opens at 特大 with 简洁显示 on (product.md §5 family links). Hash and other parameters are kept. */
export function withFamilyReading(url: string): string {
  const hashAt = url.indexOf('#');
  const hash = hashAt >= 0 ? url.slice(hashAt) : '';
  const beforeHash = hashAt >= 0 ? url.slice(0, hashAt) : url;
  const queryAt = beforeHash.indexOf('?');
  const path = queryAt >= 0 ? beforeHash.slice(0, queryAt) : beforeHash;
  const params = new URLSearchParams(queryAt >= 0 ? beforeHash.slice(queryAt + 1) : '');
  params.set('reading', 'extra-large');
  params.set('simple', '1');
  return `${path}?${params.toString()}${hash}`;
}
