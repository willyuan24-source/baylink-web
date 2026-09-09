import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

test('compiled post function starts in native Node ESM without a bundler or tsx', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const directory = mkdtempSync(join(tmpdir(), 'baylink-post-runtime-'));
  try {
    const config = ts.readConfigFile(join(root, 'tsconfig.json'), ts.sys.readFile);
    assert.equal(config.error, undefined);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
    const program = ts.createProgram([join(root, 'api/post-page.ts')], {
      ...parsed.options,
      rootDir: root,
      outDir: directory,
      noEmit: false,
      strict: true,
      skipLibCheck: true,
      types: ['node'],
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.deepEqual(diagnostics.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')), []);
    assert.equal(program.emit().emitSkipped, false);
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ type: 'module' }));
    const entry = pathToFileURL(join(directory, 'api/post-page.js')).href;
    const template = readFileSync(join(root, 'index.html'), 'utf8');
    const script = `
      import assert from 'node:assert/strict';
      const { default: handler, renderPublicPostPage } = await import(${JSON.stringify(entry)});
      assert.equal(typeof handler.fetch, 'function');
      const result = await renderPublicPostPage(new Request('https://www.baylink.us/posts/runtime-check'), {
        readTemplate: async () => ${JSON.stringify(template)},
        fetch: async () => Response.json({ id: 'runtime-check', title: 'Native runtime check', description: 'Public content' }),
      });
      assert.equal(result.status, 200);
      assert.match(await result.text(), /Native runtime check/);
      console.log('native-runtime-ok');
    `;
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: '' },
      timeout: 20_000,
    });
    assert.match(output, /native-runtime-ok/);
  } finally {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(directory.startsWith(join(tmpdir(), 'baylink-post-runtime-')));
    rmSync(directory, { recursive: true, force: true });
  }
});
