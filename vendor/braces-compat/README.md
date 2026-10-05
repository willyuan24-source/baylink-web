# BAYLINK braces compatibility candidate

This is a private, source-vendored security derivative of official `braces@3.0.3`, not an upstream release. The implementation remains MIT licensed; keep LICENSE with all distributions.

Purpose: address GHSA-vfj7-8cjw-p6xm / CVE-2026-93687 by bounding recursive traversal before it can exhaust the JavaScript call stack, while retaining the normal glob semantics used by Tailwind CSS 3, Micromatch and Chokidar. It preserves BAYLINK's current browser/CSS baseline.

Changes: iterative AST preflight caps child-edge depth at 64 and visited nodes at 20,000 before compile/expand/stringify; parser checks nesting before pushing a new brace/parenthesis; append, flatten and expand's parent walks have depth guards. Internal modules are protected as well as public exports. Supplied data ASTs must use Array child collections and primitive value/commas/ranges fields, preventing iterable/array-like traversal and implicit coercion from bypassing the guard. Parser parent/prev back-references are not recursively traversed as child nodes. Caller options cannot disable these hard bounds. Errors have `BRACES_DEPTH_LIMIT`, `BRACES_NODE_LIMIT`, or `BRACES_AST_INVALID` codes.

These limits deliberately reject extreme patterns/ASTs accepted by upstream. This patch addresses recursive stack exhaustion, including cycles and related recursive entry points; it is not a claim that every possible resource-exhaustion issue or execution of arbitrary JavaScript getters/Proxies is sandboxed. Existing rangeLimit behavior remains unchanged. Applications must still handle invalid-pattern/limit errors.

UPSTREAM.json records the official source URL, integrity and derivative identity. SOURCE.patch records the source delta. SECURITY-VALIDATION.json records local malicious-input checks, normal output comparisons, original upstream fixtures, project CSS/glob parity and watcher results.

Use a fixed local tarball through a root npm override so every transitive `require('braces')` resolves to this implementation. Do not edit node_modules after install. A clean npm ci and unchanged full npm audit are required before use. Audit does not inspect private source patches: zero findings for a new package identity is not evidence of remediation. The source patch and malicious-input regressions provide that evidence.

Maintenance: track upstream braces/Micromatch/Tailwind changes and advisories; rerun security, upstream and application CSS/glob/watch checks on updates. Remove this derivative when an official verified fix is available or a browser-baseline migration is approved. No telemetry, install scripts or network behavior is added.

References:
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/micromatch/braces/tree/3.0.3
- https://github.com/micromatch/braces/pull/75 (unmerged reference only; this candidate is independently implemented)
