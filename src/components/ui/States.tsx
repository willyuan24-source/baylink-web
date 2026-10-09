import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, type LucideIcon } from 'lucide-react';
import './ui.css';
import { Button } from './Button';
import { useUiCopy } from './ui-copy';

export type EmptyStateProps = {
  title: string;
  /** What is happening, in ≤2 lines. */
  body?: string;
  icon?: LucideIcon;
  /** One next step: a primary <Button>, optionally followed by a text <Button>. */
  actions?: ReactNode;
  headingLevel?: 'h2' | 'h3';
};

/** Zero results or nothing saved yet: say what is happening plus one next step. No dashed boxes. */
export function EmptyState({ title, body, icon: Icon = Inbox, actions, headingLevel = 'h2' }: EmptyStateProps) {
  const Heading = headingLevel;
  return <section className="ui-state" data-kind="empty">
    <span className="ui-state__icon" aria-hidden="true"><Icon strokeWidth={1.75} /></span>
    <Heading className="ui-state__title">{title}</Heading>
    {body && <p className="ui-state__body">{body}</p>}
    {actions && <div className="ui-state__actions">{actions}</div>}
  </section>;
}

export type ErrorStateProps = {
  title?: string;
  body?: string;
  /** [重试] primary. Omit when retrying cannot help. */
  onRetry?: () => void;
  /** [回到首页] text link; `null` hides it. */
  homeTo?: string | null;
  headingLevel?: 'h2' | 'h3';
};

/** A load failure (API down, offline, chunk error): the same layout on a danger tint, with retry and a way home. */
export function ErrorState({ title, body, onRetry, homeTo = '/', headingLevel = 'h2' }: ErrorStateProps) {
  const { t } = useUiCopy();
  const Heading = headingLevel;
  return <section className="ui-state" data-kind="error" role="alert">
    <span className="ui-state__icon" aria-hidden="true"><AlertTriangle strokeWidth={1.75} /></span>
    <Heading className="ui-state__title">{title ?? t('暂时没能加载', 'This didn’t load')}</Heading>
    <p className="ui-state__body">{body ?? t('可能是网络不稳或服务暂时繁忙。稍后再试一次。', 'The connection or our service may be busy. Please try again in a moment.')}</p>
    {(onRetry || homeTo) && <div className="ui-state__actions">
      {onRetry && <Button variant="primary" onClick={onRetry}>{t('重试', 'Try again')}</Button>}
      {homeTo && <Button variant="text" to={homeTo}>{t('回到首页', 'Back to home')}</Button>}
    </div>}
  </section>;
}
