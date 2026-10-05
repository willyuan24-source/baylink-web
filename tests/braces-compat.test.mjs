import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const source = path.join(root, 'vendor/braces-compat');
const installed = path.dirname(require.resolve('braces/package.json'));
const packageName = '@baylink/braces-compat';
const packageVersion = '3.0.3-baylink.1';

test('installed brace consumers resolve to the reviewed security derivative', () => {
  const expected = require.resolve('braces');
  for (const consumer of ['braces', 'chokidar', 'micromatch', 'tailwindcss']) {
    const localRequire = createRequire(require.resolve(consumer));
    assert.equal(localRequire.resolve('braces'), expected, consumer);
    const identity = localRequire('braces/package.json');
    assert.equal(identity.name, packageName, consumer);
    assert.equal(identity.version, packageVersion, consumer);
    assert.throws(() => localRequire('braces').expand('{'.repeat(3500) + 'x' + '}'.repeat(3500)),
      error => error.code === 'BRACES_DEPTH_LIMIT', consumer);
  }
  const records = Object.entries(lock.packages).filter(([key]) => /(?:^|\/)node_modules\/braces$/.test(key));
  assert.equal(records.length, 1, 'no stale nested upstream braces installation');
  for (const [, record] of records) {
    assert.equal(record.name, packageName);
    assert.equal(record.version, packageVersion);
  }
});

test('fixed tarball, lock integrity, installed code and vendored source are identical', () => {
  const spec = 'file:vendor/baylink-braces-compat-3.0.3-baylink.1.tgz';
  assert.equal(manifest.devDependencies.braces, spec);
  assert.equal(manifest.overrides.braces, '$braces');
  assert.equal(lock.packages[''].devDependencies.braces, spec);
  const record = lock.packages['node_modules/braces'];
  assert.equal(record.resolved, spec);
  const packed = fs.readFileSync(path.join(root, spec.slice(5)));
  assert.equal('sha512-' + createHash('sha512').update(packed).digest('base64'), record.integrity);

  // npm pack uses ordinary ustar files here. Compare every archived byte, not
  // just the guard file, so rebuilding a stale or altered tarball fails CI.
  const tar = gunzipSync(packed);
  const archived = new Set();
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(value => value === 0)) break;
    const name = header.subarray(0, 100).toString().replace(/\0.*$/, '');
    const size = Number.parseInt(header.subarray(124, 136).toString().replace(/\0.*$/, '').trim(), 8);
    assert.ok(Number.isSafeInteger(size) && size >= 0);
    assert.ok(name.startsWith('package/') && !name.includes('..') && !name.includes('\\'));
    const relative = name.slice(8);
    assert.ok(relative.length > 0);
    assert.ok(!archived.has(relative), 'duplicate archive path');
    assert.ok(header[156] === 0 || header[156] === 48, 'only regular files are shipped');
    const content = tar.subarray(offset + 512, offset + 512 + size);
    assert.equal(content.length, size);
    assert.ok(content.equals(fs.readFileSync(path.join(source, relative))), `source: ${relative}`);
    assert.ok(content.equals(fs.readFileSync(path.join(installed, relative))), `installed: ${relative}`);
    archived.add(relative);
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  for (const required of ['LICENSE', 'UPSTREAM.json', 'SOURCE.patch', 'README.md', 'SECURITY-VALIDATION.json', 'package.json', 'index.js', 'lib/traversal-limit.js', 'test/security.test.cjs']) {
    assert.ok(archived.has(required), required);
  }
  for (const file of fs.readdirSync(path.join(source, 'lib'))) assert.ok(archived.has('lib/' + file), file);
  const upstream = JSON.parse(fs.readFileSync(path.join(source, 'UPSTREAM.json'), 'utf8'));
  assert.equal(upstream.name, 'braces');
  assert.equal(upstream.version, '3.0.3');
  assert.equal(upstream.license, 'MIT');
  assert.equal(upstream.resolved, 'https://registry.npmjs.org/braces/-/braces-3.0.3.tgz');
  assert.equal(upstream.integrity, 'sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==');
  assert.match(fs.readFileSync(path.join(source, 'LICENSE'), 'utf8'), /Permission is hereby granted, free of charge/);
});

test('actual installed package passes all ten security and compatibility regressions with a bounded process', () => {
  const childEnv = { ...process.env };
  // A nested Node test process must own its reporter, not inherit the parent's
  // internal child-test IPC mode (which otherwise suppresses captured TAP).
  delete childEnv.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--stack-size=512', '--max-old-space-size=96', '--test', '--test-reporter=tap', 'test/security.test.cjs'], {
    cwd: installed, env: childEnv, encoding: 'utf8', timeout: 10_000, maxBuffer: 64 * 1024,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, (result.stdout || '') + (result.stderr || ''));
  assert.match(result.stdout, /# tests 10\b/);
  assert.match(result.stdout, /# pass 10\b/);
  assert.match(result.stdout, /# fail 0\b/);
});

test('installed matching consumers retain brace glob behavior used by Tailwind and file watchers', () => {
  const micromatch = require('micromatch');
  assert.deepEqual(micromatch(['src/App.tsx', 'src/main.ts', 'src/index.css', 'README.md'], 'src/**/*.{js,ts,jsx,tsx}'), ['src/App.tsx', 'src/main.ts']);
  assert.deepEqual(micromatch.braces('src/{components,pages}/**/*.{ts,tsx}', { expand: true }), [
    'src/components/**/*.ts', 'src/components/**/*.tsx', 'src/pages/**/*.ts', 'src/pages/**/*.tsx',
  ]);
});
