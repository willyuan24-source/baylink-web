import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import './links.css';
import { cx } from './ui-copy';

type Target = { to: string; href?: undefined; reloadDocument?: boolean } | { href: string; to?: undefined; reloadDocument?: undefined };
export type TextLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className' | 'children'> & Target & {
  children: ReactNode;
  className?: string;
};

const anchor = ({ to, href, reloadDocument, ...rest }: Omit<TextLinkProps, 'children' | 'className'>, className: string, extra: Record<string, string | undefined>, children: ReactNode) =>
  to !== undefined
    ? <Link to={to} reloadDocument={reloadDocument} {...rest} {...extra} className={className}>{children}</Link>
    : <a href={href} {...rest} {...extra} className={className}>{children}</a>;

/**
 * Two link looks site-wide (UI9-F2), one underline offset. TextLink: a link inside text, brand and underlined at rest
 * (`standalone` for a link on a line of its own: then a 44px target, 48 in 简洁显示). MoreLink: "看全部 →", brand, no
 * underline until hover, a 44px target. A router <Link> for `to`, an <a> for `href`.
 */
export function TextLink({ children, className, standalone, ...target }: TextLinkProps & { standalone?: boolean }) {
  return anchor(target, cx('ui-link', className), { 'data-standalone': standalone ? '' : undefined }, children);
}

export function MoreLink({ children, className, ...target }: TextLinkProps) {
  return anchor(target, cx('ui-more', className), {}, <>{children}<ArrowRight className="ui-more__arrow" aria-hidden="true" strokeWidth={1.75} /></>);
}
