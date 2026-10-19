import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button, type ButtonVariant } from './ui/Button';
import { useUiCopy } from './ui/ui-copy';
import { useFamilySend } from './family-send';

export type FamilyLinkButtonProps = {
  /** The page to send, as a site path without the language prefix ("/guides?topic=elders"); `from=family` is added. */
  path: string;
  /** What the page is, already in the reader's language: the share sheet's title and the first line of the message. */
  title: string;
  variant?: ButtonVariant;
  block?: boolean;
  className?: string;
};

/**
 * 发给家人（大字版） (HOMEIA-07, product.md §5): shares a link that opens at 特大 with 简洁显示 on
 * (`?reading=extra-large&simple=1`), so an adult child can send a parent a page that is big and simple from the first paint
 * (public/reading-init.js applies both before the page draws). For home's 长辈与家属 entry; the detail bar has the same send.
 */
export function FamilyLinkButton({ path, title, variant = 'secondary', block, className }: FamilyLinkButtonProps) {
  const { t } = useUiCopy();
  const [status, setStatus] = useState('');
  const send = useFamilySend(path, title);
  return <span className={['family-link', className].filter(Boolean).join(' ')}>
    <Button variant={variant} block={block} onClick={() => { setStatus(''); void send().then(result => { if (result) setStatus(result.message); }); }} icon={<Send aria-hidden="true" strokeWidth={1.75} />}>{t('发给家人（大字版）', 'Send to family (large text)')}</Button>
    <span className="family-link__status" role="status">{status}</span>
  </span>;
}
