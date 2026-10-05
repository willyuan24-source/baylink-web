import type { SeptemberOpening } from './september-openings';
import type { FreebieOffer } from '../components/FreebieBoard';

/** Bounded 2026-10-05 corrections; an elapsed opening forecast does not prove opening. */
export const CONTENT_AUDIT_OPENING_UPDATES: Record<string, Partial<SeptemberOpening>> = {
  'passdoor-santa-rosa-opening-2026': {
    status: 'open',
    dateLabel: 'Santa Rosa 新址已列营业信息 · 10/1–3 开业庆典已结束',
    summary: 'The Passdoor 官网已列出 Santa Rosa 新址、营业时段及后续活动。珠宝、艺术及家居精选品牌迁至 1160 4th Street；10/1–3 的开业庆典已结束。',
    editorTip: '官网不同页面的营业时段不一致，出发前联系门店确认。开业庆典日期不等于首次接客日，也不代表当前仍有赠品或开业优惠。',
    officialUrl: 'https://www.thepassdoor.net/new-page',
    sourceUrl: 'https://www.thepassdoor.net/new-page',
    sourceLabel: 'The Passdoor 官网 Santa Rosa 地址、营业信息与活动日历',
    verifiedAt: '2026-10-05',
  },
  'hedley-club': {
    dateLabel: '九月重开预告已过 · 实际营业状态仍待确认',
  },
  'woods-wharf': {
    dateLabel: '此前预告九月下旬 · 实际开门日期仍待确认',
  },
};

/** Only offers whose current official terms were reviewed on this date. */
export const CONTENT_AUDIT_OFFER_UPDATES: Record<string, Partial<FreebieOffer>> = {
  'lowes-kids-lollipop': { verifiedAt: '2026-10-05' },
  'ikea-family-hot-drink': { verifiedAt: '2026-10-05' },
  'starbucks-cafe-refills': { verifiedAt: '2026-10-05' },
  'lowes-firefighting-plane-oct17': { verifiedAt: '2026-10-05' },
  'yogurtland-anniversary-oct20': { verifiedAt: '2026-10-05' },
  'svma-free-wednesdays-october': { verifiedAt: '2026-10-05' },
  'smcl-discover-go': {
    title: '半岛图书证，先核对所属馆与服务范围',
    description: '先用所属图书馆的 Discover & Go 入口，并核对居住地是否在该馆服务范围内；San Mateo 市、Redwood City 等有各自入口。最多同时两项预约，入场人数依场馆，打印后不能取消。',
    verifiedAt: '2026-10-05',
  },
  'alameda-county-discover-go': { verifiedAt: '2026-10-05' },
  'santa-clara-library-parks-pass': { verifiedAt: '2026-10-05' },
  'amc-stubs-tuesday-wednesday-base-ticket': {
    sourceUrl: 'https://www.amctheatres.com/50pct-off-tuesdays-and-wednesdays',
    verifiedAt: '2026-10-05',
  },
};
