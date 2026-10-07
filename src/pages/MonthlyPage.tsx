import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { MonthlyEdition } from '../components/MonthlyEdition';
import { MONTHLY_METADATA, WEEKLY_METADATA } from '../lib/monthly-metadata';
import { setPageMetadata } from '../lib/seo';

export default function MonthlyPage() {
  const { pathname } = useLocation();
  useEffect(() => setPageMetadata(pathname.replace(/\/+$/, '') === '/this-week' ? WEEKLY_METADATA : MONTHLY_METADATA), [pathname]);
  return <MonthlyEdition />;
}
