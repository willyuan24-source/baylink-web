# braces compatibility security candidate: final isolated validation

Date: 2026-10-05. Node 24.18.0 / npm 11.16.0, Windows. This is a reviewed candidate, not an upstream release or a claim that it has been deployed. Product files and shared node_modules were not modified.

## Deliverables

- `candidate/`: official braces 3.0.3 plus the minimal implementation delta.
- `candidate.patch`: source-only delta against `upstream/` (six existing implementation files plus one traversal helper; unchanged API index and MIT LICENSE).
- `vendor/source/`: transparent `@baylink/braces-compat@3.0.3-baylink.1` distribution source, original MIT LICENSE, UPSTREAM.json, SOURCE.patch, README, SECURITY-VALIDATION.json and portable security tests.
- `vendor/baylink-braces-compat-3.0.3-baylink.1.tgz`: final packed candidate.
- `consumer/package.json` and `consumer/package-lock.json`: exact successful dependency recipe using the real current frontend manifest/lock as the base.
- `candidate-validation.json`, `candidate-upstream-tests.log`, and `installation-validation.json`: detailed results.
- `reproduction.json`: original vulnerable implementation probes and verified official archive integrity.

Final tarball SHA-256: `24f1e42c47d962f36fb4ff5dcb477d7a1769dc7bccd8f62600d3b1e9de77de2a`.

Final tarball integrity: `sha512-VvY7+ZPix8r23TKplT0WgPVOWnjXyK1NBmVc/oT2Ts8kNQwLORxuJr01ULYLG+WHAxlZMVS6iIkazq+goEBDUA==`.

## Actual patch boundary

The parser rejects brace/parenthesis nesting over 64 before recursive cleanup. Public and deep-import compile/expand/stringify entry points iteratively validate data AST child edges: at most depth 64 and 20,000 visited nodes. Nodes collections must be Arrays; value/commas/ranges cannot be objects/functions. This prevents Set/array-like child collections or deeply nested array scalar values from bypassing the preflight. Internal append, flatten and expansion parent-chain traversal have independent depth guards. Caller options cannot remove these limits. Errors are controlled RangeError/TypeError with BRACES_DEPTH_LIMIT, BRACES_NODE_LIMIT or BRACES_AST_INVALID.

The independent review found non-Array nodes and implicit value coercion bypasses in an earlier candidate. Both were fixed before this archive, with explicit regressions; commas/ranges coercion received the same narrow safeguard. Parent/prev back-references in ordinary parser ASTs are retained.

Intentional compatibility restriction: extreme nesting/node counts and malformed hand-constructed AST shapes formerly accepted by upstream now fail. The patch targets the announced recursive stack exhaustion. It does NOT implement aggregate expansion-cardinality/output/batch limits or sandbox arbitrary JavaScript getters/Proxies. Earlier broader proposals in DESIGN.md are superseded. Existing rangeLimit semantics remain unchanged. Callers must continue handling invalid-pattern errors.

## Results

1. Original failure reproduced: supplied 20,000-deep or cyclic ASTs exhaust the default Node stack; nested string/parsed-AST traversal reproduces at a 512 KiB stack. The same 3,500-nesting string did not fail on this runtime's default 984 KiB stack; no universal default-stack claim is made.
2. Patched candidate: 49/49 malicious child-process probes passed, each bounded to a 512 KiB stack, 96 MiB heap and 3-second timeout. Includes strings, parser entry points, malformed/unclosed/parenthesis/dollar forms, cycles, wide/deep ASTs, deep imports, parent loops, flatten, Set/array-like nodes and deep scalar arrays.
3. 4,480 ordinary output comparisons against official 3.0.3 matched exactly across four public APIs, representative options, ranges, escaped/literal input, Unicode and nested patterns.
4. 764/764 original upstream fixtures passed unchanged under a node:test shim for Mocha's describe/it API. Git Bash was available for the original bash comparisons.
5. Actual project src/index.css + tailwind.config.js compiled with the unchanged Tailwind 3/PostCSS/autoprefixer to identical 81,504-byte CSS. Both SHA-256 values: `f480e20b345ca0a13ec0ee8c3b17303c27c545903cf9a95714ed1466dcda5840`. This is actual project stylesheet generation, not a rerun of the entire Vite/site build.
6. Actual content glob produced the same 1,207 paths. Chokidar brace-glob fixture observed identical add seed.js, add added.ts, change added.ts, unlink added.ts, and ignored .txt for upstream, candidate, and fresh installed package.
7. Packed package tests passed 10/10 on actual installed code. Root require('braces') and require resolution from both Chokidar and Micromatch point to the installed patched package, with the malicious string rejected. Nine implementation/license files match the validated candidate byte for byte.

## Portable installation validation

Use the following root manifest recipe, keeping the tarball committed at that relative path:

```json
{
  "devDependencies": {
    "braces": "file:vendor/baylink-braces-compat-3.0.3-baylink.1.tgz"
  },
  "overrides": {
    "braces": "$braces"
  }
}
```

The direct root dependency plus `$braces` reference is required for the tested portable recipe. A direct nested override to a relative tarball alone was rejected by npm's nested path resolution; that failed attempt is not the recipe above.

With empty user/global npm configuration and the public registry, `npm install --ignore-scripts --no-fund` produced the lock. Only its root package record and `node_modules/braces` record differ from the product lock. The braces record has the transparent scoped name, relative `file:vendor/...tgz` resolution and the SHA-512 above; it contains no machine paths.

Copied only manifest, lock and tarball to a new, different empty directory (`baylink-braces-relocated-LbAHbA`) and ran standard `npm ci --no-fund`. It succeeded with 431 installed packages. No ignore-scripts flag was used for ci; npm 11 separately reported its normal pending approval for esbuild postinstall. The candidate has no install scripts. The installed CSS/glob/watch checks above subsequently succeeded using the newly installed dependency tree without resolution hooks.

Full `npm audit --json` was run after the clean install, without omit, severity filtering or ignored advisories: zero vulnerabilities. This does not by itself establish security because the audit database does not inspect private derivatives. Remediation evidence is the reviewed source delta, original reproduction and malicious-input tests. Full audit remains required in product CI.

## Maintenance and adoption

Keep source, license, upstream integrity, patch, tests and tarball together. CI should check the tarball/installed-source identity and run the shipped security tests in addition to the existing full audit and product checks. A source change requires repacking and updating the lock integrity, then rerunning security and output checks. Monitor upstream for an official repair and remove the derivative when a verified compatible fix or approved browser-baseline migration is available.

No full product test suite was rerun here, per scope: the unchanged product baseline had just completed its full checks. Adoption still requires the normal product CI/build/review, with no audit waiver. This candidate preserves Tailwind 3 and does not change the browser/CSS baseline.

Official references:
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://registry.npmjs.org/braces/-/braces-3.0.3.tgz
- https://github.com/micromatch/braces/tree/3.0.3
- https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#overrides
