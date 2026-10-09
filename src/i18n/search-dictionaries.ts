// opencc's traditional → simplified dictionaries for search (src/i18n/locale.ts simplifySearch), one lazily loaded
// chunk: not part of the shell or the homepage (WEB-HOMEPREP, RC-8 iii). Phrases come first (they take precedence).
export { ConverterFactory } from 'opencc-js/core';
export { default as searchPhrases } from 'opencc-js/dict/TSPhrases';
export { default as searchCharacters } from 'opencc-js/dict/TSCharacters';
