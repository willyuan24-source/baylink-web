// opencc's per-dictionary modules used for 繁體 (traditional.ts, traditional-full.ts, scripts/generate-traditional-phrases.ts).
declare module 'opencc-js/dict/STCharacters' {
  import type { DictLike } from 'opencc-js/core';
  const dictionary: DictLike;
  export default dictionary;
}

declare module 'opencc-js/dict/STPhrases' {
  const dictionary: string;
  export default dictionary;
}

declare module 'opencc-js/dict/TWVariantsPhrases' {
  import type { DictLike } from 'opencc-js/core';
  const dictionary: DictLike;
  export default dictionary;
}

declare module 'opencc-js/dict/TWVariants' {
  import type { DictLike } from 'opencc-js/core';
  const dictionary: DictLike;
  export default dictionary;
}
