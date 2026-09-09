import type { PostData } from './types';

export function postAvailability(post: Pick<PostData, 'status' | 'confirmedAt' | 'category' | 'type'>, now = Date.now()) {
  if (post.status === 'closed') {
    const label = post.type === 'client' ? '已解决'
      : post.category === '租屋' ? '已出租' : post.category === '闲置' ? '已售出' : '已结束';
    return { label, detail: '发布者已结束这条信息', tone: 'closed' as const };
  }
  const confirmed = post.confirmedAt;
  if (!confirmed || !Number.isFinite(confirmed) || confirmed <= 0 || confirmed > now) {
    return { label: '待确认有效', detail: '尚无发布者确认日期，联系前请确认是否仍然有效。', tone: 'unconfirmed' as const };
  }
  const days = Math.floor((now - confirmed) / 86_400_000);
  if (days > 30) return { label: '需要再次确认', detail: `发布者上次确认在 ${days} 天前，联系前请确认当前情况。`, tone: 'unconfirmed' as const };
  return { label: days === 0 ? '今天确认有效' : `${days} 天前确认有效`, detail: '由发布者确认；平台不保证可用性或交易结果。', tone: 'confirmed' as const };
}
