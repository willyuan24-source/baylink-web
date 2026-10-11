import React, { type ReactNode } from 'react';
import { AnonymousSiteChrome } from '../src/components/SiteChrome';

/**
 * The prerendered pages' first paint is the app's own chrome (WEB-SHELL2, FA-07, REG-06): SiteChrome with an anonymous
 * reader, so the header, footer and tab bar a reader sees before the app boots are the ones the app renders (same links,
 * same names, same classes); tests/site-chrome-parity.test.tsx compares the two. SiteChrome imports its stylesheet, so
 * scripts/prerender.tsx loads this module after registering a .css loader.
 */
export const Shell = ({ children, path }: { children: ReactNode; path: string }) =>
  <AnonymousSiteChrome pathname={path}>{children}</AnonymousSiteChrome>;
