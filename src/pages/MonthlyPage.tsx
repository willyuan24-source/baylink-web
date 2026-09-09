import { useEffect } from 'react';
import { MonthlyEdition } from '../components/MonthlyEdition';
import { MONTHLY_METADATA } from '../lib/monthly-metadata';
import { setPageMetadata } from '../lib/seo';

export default function MonthlyPage() {
  useEffect(() => setPageMetadata(MONTHLY_METADATA), []);
  return <MonthlyEdition />;
}
