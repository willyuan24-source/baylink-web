import { jsxDEV as reactJsxDEV } from 'react/jsx-dev-runtime';
import { LocalizedHost, needsLocalization, localizedHostProps } from './host';
export { Fragment } from 'react/jsx-dev-runtime';
export type { JSX } from 'react/jsx-dev-runtime';
export const jsxDEV: typeof reactJsxDEV = (type, props, key, isStaticChildren, source, self) => needsLocalization(type, props)
  ? reactJsxDEV(LocalizedHost, localizedHostProps(type, props, isStaticChildren), key, false, source, self)
  : reactJsxDEV(type, props, key, isStaticChildren, source, self);
