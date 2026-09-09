import { jsx as reactJsx, jsxs as reactJsxs } from 'react/jsx-runtime';
import { LocalizedHost, needsLocalization, localizedHostProps } from './host';
export { Fragment } from 'react/jsx-runtime';
export type { JSX } from 'react/jsx-runtime';
export const jsx: typeof reactJsx = (type, props, key) => needsLocalization(type, props)
  ? reactJsx(LocalizedHost, localizedHostProps(type, props), key) : reactJsx(type, props, key);
export const jsxs: typeof reactJsxs = (type, props, key) => needsLocalization(type, props)
  ? reactJsxs(LocalizedHost, localizedHostProps(type, props, true), key) : reactJsxs(type, props, key);
