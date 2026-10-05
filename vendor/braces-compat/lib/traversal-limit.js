'use strict';

// BAYLINK candidate patch for GHSA-vfj7-8cjw-p6xm, based on braces 3.0.3.
// Hard limits apply to parsed strings and supplied ASTs, including deep imports.
// They are deliberately not disabled by caller options. Parent/prev pointers
// are not child edges: legitimate parser ASTs contain those back-references.
const MAX_DEPTH = 64;
const MAX_NODES = 20000;

const assertDepth = depth => {
  if (depth > MAX_DEPTH) {
    const error = new RangeError('Brace traversal exceeds maximum nesting depth (64)');
    error.code = 'BRACES_DEPTH_LIMIT';
    throw error;
  }
};

const invalidAst = field => {
  const error = new TypeError(`Invalid brace AST ${field}`);
  error.code = 'BRACES_AST_INVALID';
  throw error;
};

const assertAst = ast => {
  const pending = [[ast, 0]];
  let visited = 0;
  while (pending.length) {
    const [node, depth] = pending.pop();
    assertDepth(depth);
    if (++visited > MAX_NODES || pending.length + visited > MAX_NODES) {
      const error = new RangeError('Brace traversal exceeds maximum node count (20000)');
      error.code = 'BRACES_NODE_LIMIT';
      throw error;
    }
    if (!node) continue;
    // These data fields are coerced by the upstream walkers. Objects/arrays
    // could recurse through implicit toString even without any child edges.
    for (const field of ['value', 'commas', 'ranges']) {
      const value = node[field];
      if (value !== null && (typeof value === 'object' || typeof value === 'function')) invalidAst(field);
    }
    if (node.nodes === undefined) continue;
    // All parser-created child collections are arrays. Iterable and array-like
    // substitutes must not skip validation and reach an unbounded walker.
    if (!Array.isArray(node.nodes)) invalidAst('nodes');
    if (node.nodes.length + pending.length + visited > MAX_NODES) {
      const error = new RangeError('Brace traversal exceeds maximum node count (20000)');
      error.code = 'BRACES_NODE_LIMIT';
      throw error;
    }
    for (let index = node.nodes.length - 1; index >= 0; index--) {
      pending.push([node.nodes[index], depth + 1]);
    }
  }
};

module.exports = { assertAst, assertDepth, MAX_DEPTH, MAX_NODES };
