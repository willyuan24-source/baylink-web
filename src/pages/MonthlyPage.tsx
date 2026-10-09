import { useEffect } from 'react';
import { MonthlyEdition } from '../components/MonthlyEdition';
import { MONTHLY_METADATA } from '../lib/monthly-metadata';
import { setPageMetadata } from '../lib/seo';

/** /this-month: the events column on 全部日期 (an alias of /events, plan D3). */
export default function MonthlyPage() {
  useEffect(() => setPageMetadata(MONTHLY_METADATA), []);
  return <MonthlyEdition />;
}
