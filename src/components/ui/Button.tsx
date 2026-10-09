import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode, type Ref } from 'react';
import { Link } from 'react-router-dom';
import './ui.css';
import { cx } from './ui-copy';

export type ButtonVariant = 'primary' | 'secondary' | 'tonal' | 'text';
type Common = { variant?: ButtonVariant; block?: boolean; icon?: ReactNode; children: ReactNode; className?: string };
type AsButton = Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> & { to?: undefined; href?: undefined };
type AsRoute = Common & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'className' | 'href'> & { to: string; href?: undefined };
type AsAnchor = Common & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'className'> & { href: string; to?: undefined };
export type ButtonProps = AsButton | AsRoute | AsAnchor;

/**
 * Primary (one per section), secondary, tonal (save / add to plan) or text. Renders a <button>, a router
 * <Link> (`to`) or an <a> (`href`). Height 48 on phones, 44 on desktop; no arrows inside buttons.
 */
export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(function Button({ variant = 'secondary', block, icon, children, className, ...rest }, ref) {
  const shared = { className: cx('ui-button', className), 'data-variant': variant, 'data-block': block ? '' : undefined };
  if ('to' in rest && rest.to !== undefined) {
    const { to, ...anchor } = rest as AsRoute;
    return <Link ref={ref as Ref<HTMLAnchorElement>} to={to} {...anchor} {...shared}>{icon}{children}</Link>;
  }
  if ('href' in rest && rest.href !== undefined) {
    return <a ref={ref as Ref<HTMLAnchorElement>} {...(rest as AsAnchor)} {...shared}>{icon}{children}</a>;
  }
  const { type = 'button', ...button } = rest as AsButton;
  return <button ref={ref as Ref<HTMLButtonElement>} type={type} {...button} {...shared}>{icon}{children}</button>;
});

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> & { label: string; children: ReactNode };
/** 40px visual circle with a 44px hit area (48 in simple mode). `label` is required: it is the accessible name. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ label, children, className, type = 'button', ...rest }, ref) {
  return <button ref={ref} type={type} aria-label={label} title={label} className={cx('ui-icon-button', className)} {...rest}>{children}</button>;
});
