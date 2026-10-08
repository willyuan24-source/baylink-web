import { Link } from 'react-router-dom';
import { translateText, useLocale } from '../i18n/locale';

const resources = {
  rent: { slug: 'bay-area-rental-scam-guide', zh: '租房防骗指南', en: 'Rental scam guide' },
  used: { slug: 'bay-area-used-trading-safety-guide', zh: '二手交易安全指南', en: 'Secondhand trading safety' },
  service: { slug: 'local-service-safety-guide', zh: '本地服务安全指南', en: 'Local service safety' },
  job: { slug: 'bay-area-part-time-job-safety-guide', zh: '兼职防骗指南', en: 'Job scam guide' },
} as const;
const categories: Record<string, keyof typeof resources> = { 租屋: 'rent', 室友: 'rent', 闲置: 'used', 搬家: 'service', 清洁: 'service', 维修: 'service', 接送: 'service', 翻译: 'service', 其他: 'service', 兼职: 'job' };

export function CategorySafetyNotice({ category, onNavigate }: { category?: string | null; onNavigate?: () => void }) {
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const kind = category ? categories[category] : undefined;
  const tip = kind === 'rent' ? t('未看房、未核验出租权限前不要转账；不要向陌生人提供验证码。', 'Do not transfer money before viewing and verifying rental authority. Never give a stranger verification codes.')
    : kind === 'used' ? t('公共地点面交并检查物品；警惕假支票、超额付款和不可追回的转账。', 'Meet publicly and inspect the item. Watch for fake checks, overpayments and irreversible transfers.')
      : kind === 'job' ? t('先核验招聘主体和报酬；不要付费入职、代转钱款或替陌生人转寄包裹。', 'Verify the employer and pay. Never pay to get a job, move money or forward packages for strangers.')
        : kind === 'service' ? t('先确认服务范围、总价和取消规则；未核验前不要支付大额预付款。', 'Confirm the scope, total price and cancellation terms. Avoid large advance payments before verification.')
          : t('先核实对方和交易条件；不要发送密码或验证码，付款前独立核验。', 'Verify the person and terms. Never send passwords or verification codes; check independently before paying.');
  const links = kind ? [resources[kind]] : [resources.rent, resources.used, resources.service];
  return <aside aria-label={t('联系前安全提醒', 'Safety before contact')} className="shrink-0 border-b border-baylink-border/40 bg-baylink-section/40 px-4 py-3 text-base leading-relaxed text-baylink-text-secondary">
    <p>{tip}</p><nav className="flex flex-wrap gap-x-4" aria-label={t('交易安全指南', 'Trading safety guides')}>{links.map(resource => <Link key={resource.slug} to={`/guides/${resource.slug}`} onClick={onNavigate} className="inline-flex min-h-11 items-center font-semibold text-baylink-green underline underline-offset-4">{t(resource.zh, resource.en)}</Link>)}</nav>
  </aside>;
}
