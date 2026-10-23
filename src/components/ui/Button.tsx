import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode, type Ref } from 'react';
import { Link } from 'react-router-dom';
import './ui.css';
import './covers.css';
import './cards.css';
import { cx } from './ui-copy';

/**
 * Three button looks site-wide (H29 / SV13-06): `primary` (brand fill, one per section), `secondary` (white with the control
 * border, ink text) and `quiet` (no fill or border, brand text). `tonal` and `text` are the names callers used before; they
 * render as `secondary` and `quiet`, so an older call site keeps working and still shows one of the three.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'quiet';
/** @deprecated Use `secondary` (was `tonal`) or `quiet` (was `text`). */
export type LegacyButtonVariant = 'tonal' | 'text';
/** The look a variant name renders (the legacy names fold into the three). */
const buttonVisual = (variant: ButtonVariant | LegacyButtonVariant): ButtonVariant => variant === 'tonal' ? 'secondary' : variant === 'text' ? 'quiet' : variant;

type Common = { variant?: ButtonVariant | LegacyButtonVariant; block?: boolean; icon?: ReactNode; children: ReactNode; className?: string };
type AsButton = Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> & { to?: undefined; href?: undefined };
type AsRoute = Common & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'className' | 'href'> & { to: string; href?: undefined; reloadDocument?: boolean };
type AsAnchor = Common & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'className'> & { href: string; to?: undefined };
export type ButtonProps = AsButton | AsRoute | AsAnchor;

/**
 * Renders a <button>, a router <Link> (`to`) or an <a> (`href`). Height 48 on phones, 44 on desktop; no arrows inside
 * buttons (an external link may end in ↗).
 */
export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(function Button({ variant = 'secondary', block, icon, children, className, ...rest }, ref) {
  const shared = { className: cx('ui-button', className), 'data-variant': buttonVisual(variant), 'data-block': block ? '' : undefined };
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
