import { translateText, type Locale } from '../../i18n/locale';

/** Controlled UI copy; publication titles and source URLs remain original evidence. */
export const CONTENT_REVIEW_COPY = {
  '内容复核队列': 'Content review queue',
  '资料复核状态': 'Content review status',
  '往期内容': 'Archived content',
  '所列覆盖日期已结束。此页面保留作往期参考，不表示当前仍可参加、领取或办理。': 'The published coverage period has ended. This page remains available as an archive and does not establish current availability.',
  '查看官方参考资料': 'View official references',
  '查看官方最新说明': 'Check the latest official information',
  '内容更新日期': 'Content update date',
  '原资料核对日期': 'Recorded source check date',
  '建议下次复核': 'Next suggested review',
  '日期未提供': 'Date not provided',
  '读取复核队列…': 'Loading the review queue…',
  '复核队列暂时无法读取，请刷新重试；不能据此认定内容都已复核。': 'The review queue could not be loaded. Refresh to retry; this does not mean all content has been reviewed.',
  '按湾区今天重新计算复核状态；排期与网页读取均不自动更新原核对日期。指南日期只表示内容更新。': 'Review status is recalculated for today in the Bay Area. Scheduling and page fetching do not renew the recorded check date. Guide dates record content updates only.',
  '需要复核': 'Needs review',
  '全部记录': 'All records',
  '筛选复核队列': 'Filter the review queue',
  '到期复核': 'Review due',
  '人工确认': 'Manual confirmation',
  '日期缺失或无效': 'Missing or invalid date',
  '尚未到期': 'Not yet due',
  '已归档': 'Archived',
  '涉及医疗、法律或财务': 'Health, legal or financial information',
  '日期和条件易变化': 'Time-sensitive information',
  '常青资料': 'Evergreen information',
  '原始发布标题': 'Original publication title',
  '记录': 'records',
  '当前筛选没有待处理记录；这不表示所有事实已经重新核验。': 'No records need attention in this filter. This does not mean every fact has been reverified.',
  '显示更多复核记录': 'Show more review records',
} as const;

export const contentReviewText = (key: keyof typeof CONTENT_REVIEW_COPY, locale: Locale) => locale === 'en' ? CONTENT_REVIEW_COPY[key] : translateText(key, locale);
export const contentReviewTextStyle = { fontSize: 'var(--text-body, 1rem)', lineHeight: 1.8, color: 'var(--color-ink, #16352b)', overflowWrap: 'anywhere' as const };
