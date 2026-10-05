const test = require('node:test');
const assert = require('node:assert/strict');
const braces = require('..');
const depthError = error => error instanceof RangeError && error.code === 'BRACES_DEPTH_LIMIT' && !/call stack/i.test(error.message);
const nodeError = error => error instanceof RangeError && error.code === 'BRACES_NODE_LIMIT';
const shapeError = error => error instanceof TypeError && error.code === 'BRACES_AST_INVALID';
const deepAst = () => { let ast = { type: 'text', value: 'x' }; for (let n = 0; n < 3500; n++) ast = { type: 'root', nodes: [ast] }; return ast; };

for (const method of ['parse', 'create', 'compile', 'expand', 'stringify']) {
  test(`${method}: over-depth strings are rejected before stack exhaustion`, () => {
    for (const pattern of ['{'.repeat(3500) + 'a,b' + '}'.repeat(3500), '('.repeat(3500) + 'x' + ')'.repeat(3500), '{'.repeat(3500) + 'x', '${' + '{'.repeat(3500) + 'x' + '}'.repeat(3501)]) {
      assert.throws(() => braces[method](pattern, { maxDepth: Infinity, maxLength: Infinity }), depthError);
    }
  });
}
for (const method of ['compile', 'expand', 'stringify']) {
  test(`${method}: supplied ASTs and deep imports cannot bypass the guard`, () => {
    assert.throws(() => braces[method](deepAst()), depthError);
    assert.throws(() => require('../lib/' + method)(deepAst()), depthError);
    const ast = { type: 'root', nodes: [] }; ast.nodes.push(ast);
    assert.throws(() => braces[method](ast), depthError);
    assert.throws(() => braces[method]({ type: 'root', nodes: Array.from({ length: 20001 }, () => ({ type: 'text', value: 'x' })) }), nodeError);
    for (const collection of ['set', 'arraylike']) {
      const ast = { type: 'root' };
      ast.nodes = collection === 'set' ? new Set([ast]) : { 0: ast, length: 1 };
      assert.throws(() => braces[method](ast), shapeError);
      assert.throws(() => require('../lib/' + method)(ast), shapeError);
    }
    for (const field of ['value', 'commas', 'ranges']) {
      let value = '1'; for (let n = 0; n < 3500; n++) value = [value];
      const malformed = { type: 'root', nodes: [{ type: 'brace', nodes: [], [field]: value }] };
      assert.throws(() => braces[method](malformed), shapeError);
      assert.throws(() => require('../lib/' + method)(malformed), shapeError);
    }
  });
}
test('parent-chain and array flatten cycles fail within the depth bound', () => {
  const ast = { type: 'root', nodes: [] };
  const child = { type: 'paren', nodes: [{ type: 'text', value: 'x' }] };
  child.parent = child; ast.nodes.push(child);
  assert.throws(() => braces.expand(ast), depthError);
  const array = []; array.push(array);
  assert.throws(() => require('../lib/utils').flatten(array), depthError);
});
test('normal braces, literal nesting, ranges and parsed back-references retain their results', () => {
  assert.deepEqual(braces.expand('src/**/*.{js,ts,jsx,tsx}'), ['src/**/*.js', 'src/**/*.ts', 'src/**/*.jsx', 'src/**/*.tsx']);
  assert.deepEqual(braces.expand('a{1..3}b{c,d}'), ['a1bc', 'a1bd', 'a2bc', 'a2bd', 'a3bc', 'a3bd']);
  assert.equal(braces.compile('{a,b{1..2}}'), '(a|b(1|2))');
  const literal = '{'.repeat(1000) + 'x' + '}'.repeat(1000);
  assert.equal(braces.stringify('"' + literal + '"'), literal);
  assert.deepEqual(braces.expand(braces.parse('a/{b,c}/d')), ['a/b/d', 'a/c/d']);
  assert.throws(() => braces.expand('{1..2000}'), /range limit/);
});
