import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../app/context';
import { OutingsHub } from '../features/outings/OutingsHub';
import { useOutingCopy } from '../features/outings/outing-copy';
import { setPageMetadata } from '../lib/seo';
import { PageContainer } from '../components/ui/PageHeader';
import './together-page.css';

/** /together in the site's page frame (PageContainer, H30); together-page.css maps the hub's controls onto the shared looks. */
export default function TogetherPage() {
  const app = useApp(), { t } = useOutingCopy();
  const selectedOuting = new URLSearchParams(useLocation().search).get('outing');
  useEffect(() => {
    if (selectedOuting) return;
    setPageMetadata({ title: t('一起去 · 小队同行 | BAYLINK', 'Outings · Find company | BAYLINK'), description: t('浏览、发起和管理湾区成年人自发小队。具体日期、公共地点，申请后由发起人确认。', 'Browse, host and manage independent adult outings in the Bay Area, with clear dates, public places and host-approved requests.'), path: '/together', noindex: true, preserveText: true });
  }, [t, selectedOuting]);
  return <PageContainer className="together-page"><section translate="no"><OutingsHub app={app}/></section></PageContainer>;
}
