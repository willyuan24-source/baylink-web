import { useMemo } from 'react';
import { useSavedEntries } from '../../lib/saves';
import { ReadingShelfView } from '../../components/ReaderLibrary';

/** The reading shelf with its saved guides from the one save list. Loaded on its own by ReadingShelf. */
export default function ReadingShelfSaved({ compact }: { compact?: boolean }) {
  const list = useSavedEntries();
  const { entries, count, busyKeys, remove } = list;
  const saved = useMemo(() => {
    const guides = entries.filter(entry => entry.kind === 'guide');
    return {
      ids: guides.map(entry => entry.id),
      known: count !== null,
      busy: (slug: string) => busyKeys.includes(`guide:${slug}`),
      remove: (slug: string) => { const entry = guides.find(item => item.id === slug); if (entry) void remove(entry); },
    };
  }, [entries, count, busyKeys, remove]);
  return <ReadingShelfView compact={compact} saved={saved} />;
}
