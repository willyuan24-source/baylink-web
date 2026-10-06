import { useEffect } from 'react';
import { PublicContentDirectory } from '../components/PublicContentDirectory';
import { useLocale } from '../i18n/locale';
import { ARCHIVE_METADATA } from '../lib/archive-metadata';
import { setPageMetadata } from '../lib/seo';

export default function ArchivePage() {
  const locale = useLocale();
  useEffect(() => { setPageMetadata(ARCHIVE_METADATA); }, [locale]);
  return <PublicContentDirectory />;
}
