// Reads the frozen prototype (docs/prototype/soccerfriends.html) WITHOUT changing it,
// finds every top-level declaration, and computes the full dependency closure of the
// scoring functions using real scope analysis (local variables that shadow a global
// name, like `rr` or `A` inside a function, are NOT counted as dependencies).
import { readFileSync } from 'node:fs';
import * as espree from 'espree';
import * as eslintScope from 'eslint-scope';

export const SCORING_ROOTS = ['rateMatch', 'roundScores', 'playerOVR', 'teamDay', 'gkCounts', 'autoGk'];
// Not part of the port: used only by this script to "re-save" a round the way the prototype does.
export const TOOL_ROOTS = ['updateRatings'];

const JS_BUILTINS = new Set([
  'Math', 'Object', 'Array', 'Set', 'Map', 'JSON', 'Number', 'String', 'Boolean', 'isFinite', 'isNaN',
  'parseInt', 'parseFloat', 'Infinity', 'NaN', 'undefined', 'console', 'Error', 'Symbol',
]);

export function loadPrototype(htmlPath) {
  const html = readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if (scripts.length !== 1) throw new Error(`expected exactly one inline <script>, found ${scripts.length}`);
  const match = scripts[0];
  const src = match[1];
  const lineOffset = html.slice(0, match.index + '<script>'.length).split('\n').length - 1;

  const ast = espree.parse(src, { ecmaVersion: 'latest', range: true, loc: true });
  const scopeManager = eslintScope.analyze(ast, { ecmaVersion: 2022 });
  const globalScope = scopeManager.globalScope;

  // name -> { kind, line, stmtRange, stmtNames }
  const symbols = new Map();
  for (const stmt of ast.body) {
    let names = [];
    let kind;
    if (stmt.type === 'FunctionDeclaration') { names = [stmt.id.name]; kind = 'function'; }
    else if (stmt.type === 'VariableDeclaration') {
      kind = stmt.kind;
      for (const d of stmt.declarations) {
        if (d.id.type !== 'Identifier') throw new Error(`destructuring at top level is not supported (line ${stmt.loc.start.line + lineOffset})`);
        names.push(d.id.name);
      }
    } else continue;
    for (const n of names) {
      symbols.set(n, { name: n, kind, line: stmt.loc.start.line + lineOffset, stmtRange: stmt.range, stmtNames: names, declRange: stmt.type === 'VariableDeclaration' ? stmt.declarations.find(d => d.id.name === n).range : stmt.range });
    }
  }

  const ownerOf = pos => {
    for (const s of symbols.values()) if (s.declRange[0] <= pos && pos < s.declRange[1]) return s.name;
    return null;
  };
  const deps = new Map([...symbols.keys()].map(n => [n, new Set()]));
  const unresolved = new Map([...symbols.keys()].map(n => [n, new Set()]));
  const walk = scope => {
    for (const ref of scope.references) {
      const owner = ownerOf(ref.identifier.range[0]);
      if (!owner) continue;
      // In script (non-module) code eslint-scope may leave references to global
      // declarations unresolved; a reference with no local binding is a global one.
      const name = ref.identifier.name;
      const isGlobal = ref.resolved ? ref.resolved.scope === globalScope : symbols.has(name);
      if (isGlobal) {
        if (name !== owner) deps.get(owner).add(name);
      } else if (!ref.resolved && !JS_BUILTINS.has(name)) {
        unresolved.get(owner).add(ref.identifier.name);
      }
    }
    scope.childScopes.forEach(walk);
  };
  walk(globalScope);

  const textOf = name => src.slice(...symbols.get(name).declRange);

  function closure(roots) {
    const seen = new Set();
    const queue = [...roots];
    while (queue.length) {
      const n = queue.shift();
      if (seen.has(n)) continue;
      if (!symbols.has(n)) throw new Error(`prototype has no top-level symbol "${n}"`);
      seen.add(n);
      deps.get(n).forEach(d => queue.push(d));
    }
    return [...seen].sort((a, b) => symbols.get(a).line - symbols.get(b).line || a.localeCompare(b));
  }

  function flagsOf(name) {
    const t = textOf(name);
    const s = symbols.get(name);
    const f = [];
    const sUse = [...new Set(t.match(/\bS\.\w+/g) || [])];
    if (sUse.length && name !== 'S') f.push(`reads ${sUse.join(', ')}`);
    if (name === 'S') f.push('global app state');
    if (s.kind === 'let' || s.kind === 'var') f.push(`mutable global (${s.kind})`);
    const writesCache = /\bOVRC\s*\[[^\]]+\]\s*=(?!=)/.test(t);
    if (writesCache) f.push('writes OVRC cache');
    if (/Date\.now|new Date/.test(t)) f.push('uses Date');
    if (/Math\.random/.test(t)) f.push('uses Math.random');
    if (/localStorage|sessionStorage|indexedDB|\bstorage\b/.test(t)) f.push('uses storage');
    if (/\bdocument\.|\bwindow\./.test(t)) f.push('touches DOM');
    const u = [...unresolved.get(name)];
    if (u.length) f.push(`undeclared globals: ${u.join(', ')}`);
    return f;
  }

  // Source of the given symbols, whole statements, in original order.
  function extract(names) {
    const want = new Set(names);
    const stmts = new Map();
    for (const n of names) {
      const s = symbols.get(n);
      const partial = s.stmtNames.filter(x => !want.has(x));
      if (partial.length) {
        // e.g. `const OVR_MIN=83,OVR_MAX=99;` – take only the needed declarators
        stmts.set(`${s.stmtRange[0]}:${n}`, { pos: s.declRange[0], text: `${s.kind} ${src.slice(...s.declRange)};` });
      } else {
        stmts.set(`${s.stmtRange[0]}`, { pos: s.stmtRange[0], text: src.slice(...s.stmtRange) });
      }
    }
    return [...stmts.values()].sort((a, b) => a.pos - b.pos).map(x => x.text).join('\n');
  }

  return { html, symbols, deps, closure, flagsOf, extract, textOf };
}
