// Components import their own lazily loaded stylesheets (plan D6), which Node cannot load. The test runner preloads
// this hook so a page or component test can import them; a test that checks CSS reads the file itself.
import { registerHooks } from 'node:module';

registerHooks({ load(url, context, nextLoad) {
  return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {};' } : nextLoad(url, context);
} });
