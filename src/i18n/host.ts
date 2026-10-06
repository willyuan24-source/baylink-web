import { cloneElement, createContext, createElement, forwardRef, Fragment, isValidElement, useContext, type ReactNode, type ElementType } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { translateText, useLocale, localizedUrl, type Locale } from './locale';
import { pathLanguage } from '../lib/language-path';

const TranslationEnabled = createContext(true);
const attributes = ['title', 'alt', 'placeholder', 'aria-label', 'aria-description', 'aria-valuetext'] as const;
const neverTranslate = new Set(['script', 'style', 'code']);
const textComponents = new Set<unknown>();
export const registerLocaleTextComponents = (...components: unknown[]) => { components.forEach(component => textComponents.add(component)); };
type HostProps = Record<string, unknown> & { children?: ReactNode };
const textChildren = (children: ReactNode, locale: Locale): ReactNode => {
  if (typeof children === 'string') return translateText(children, locale);
  if (Array.isArray(children)) return children.map((child) => textChildren(child, locale));
  if (isValidElement<{ children?: ReactNode }>(children) && children.type === Fragment) {
    return cloneElement(children, undefined, textChildren(children.props.children, locale));
  }
  return children;
};

/** React owns localized nodes. No DOM rewriting, external widget or HTML injection. */
export const LocalizedHost = forwardRef<unknown, { tag: ElementType; hostProps: HostProps; staticChildren: boolean }>(function LocalizedHost({ tag, hostProps, staticChildren }, ref) {
  const locale = useLocale();
  const inherited = useContext(TranslationEnabled);
  const enabled = inherited && hostProps.translate !== 'no' && !hostProps.contentEditable && !(typeof tag === 'string' && neverTranslate.has(tag));
  const props: HostProps = { ...hostProps, ref };
  if (tag === 'a' && typeof props.href === 'string' && props.href.startsWith('/') && !props.href.startsWith('//') && !/\.[a-z0-9]{2,6}(?:$|[?#])/i.test(props.href) && !props.href.startsWith('/api/')) {
    const original = new URL(props.href, 'https://www.baylink.us');
    const specified = original.searchParams.get('lang');
    const linkLocale = /^\/(en|zh-Hant)(\/|$)/.test(original.pathname) ? pathLanguage(original.pathname)
      : specified === 'en' || specified === 'zh-Hant' || specified === 'zh-Hans' ? specified : locale;
    const url = new URL(localizedUrl(props.href, linkLocale));
    props.href = url.pathname + url.search + url.hash;
  }
  if (enabled) {
    for (const key of attributes) if (typeof props[key] === 'string') props[key] = translateText(props[key] as string, locale);
    if (tag === 'option' && props.value === undefined && typeof props.children === 'string') props.value = props.children;
    if (tag !== 'textarea') props.children = textChildren(props.children, locale);
  }
  const element = (staticChildren ? jsxs : jsx)(tag, props);
  return enabled === inherited ? element : createElement(TranslationEnabled.Provider, { value: enabled }, element);
});

export const needsLocalization = (tag: unknown, value: unknown): tag is ElementType => {
  // Stable component identity even when text appears/disappears or changes script.
  // Router Route/Fragments and other structural components must retain their element type.
  // Link/NavLink are the two external text sinks; app components localize at native elements.
  return (typeof tag === 'string' || textComponents.has(tag)) && !!value;
};
export const localizedHostProps = (tag: ElementType, value: unknown, staticChildren = false) => {
  const props = value as HostProps;
  return { tag, hostProps: props, ref: props.ref, staticChildren };
};
