// Runs the prototype's ORIGINAL scoring source (extracted as text, unchanged) inside a
// Node vm sandbox. The only things provided from outside are the app state `S` (filled
// with exported data) and the OVRC cache, which we can reset between calls.
// Date.now(), `new Date()` and Math.random() throw inside the sandbox, so any hidden
// dependency on time or randomness fails loudly instead of producing unstable goldens.
import vm from 'node:vm';

export function createSandbox(source, exportNames) {
  const context = vm.createContext({});
  vm.runInContext(`
    'use strict';
    const __D = Date;
    globalThis.Date = new Proxy(__D, {
      construct(t, args) { if (!args.length) throw new Error('scoring called new Date() (time-dependent)'); return new t(...args); },
      apply() { throw new Error('scoring called Date() (time-dependent)'); },
      get(t, k) { if (k === 'now') return () => { throw new Error('scoring called Date.now() (time-dependent)'); }; return Reflect.get(t, k); },
    });
    Math.random = () => { throw new Error('scoring called Math.random() (non-deterministic)'); };
  `, context);

  // Top-level const/let/function in a vm script live in the context's global lexical
  // scope. We append a small accessor so the host can reach them.
  const accessor = `
;globalThis.__api = {
  ${exportNames.map(n => `${JSON.stringify(n)}: (...a) => ${n}(...a)`).join(',\n  ')},
  S,
  parse: (json) => JSON.parse(json),
  resetCache() { OVRC = {}; },
  cacheSize() { return Object.keys(OVRC).length; },
};`;
  vm.runInContext(source + accessor, context, { filename: 'soccerfriends.scoring.js' });
  return context.__api;
}
