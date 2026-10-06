import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { MonthlyEdition } from '../components/MonthlyEdition';
import { MONTHLY_METADATA } from '../lib/monthly-metadata';
import { setPageMetadata } from '../lib/seo';

export default function MonthlyPage() {
  const { pathname } = useLocation();
  useEffect(() => setPageMetadata(pathname.replace(/\/+$/, '') === '/this-week' ? { ...MONTHLY_METADATA, path: '/this-week', title: '本周末湾区活动与官方来源｜BAYLINK' } : MONTHLY_METADATA), [pathname]);
  return <MonthlyEdition />;
}
