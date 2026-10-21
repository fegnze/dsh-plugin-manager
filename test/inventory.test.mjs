import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInventory, categories, filterInventory, localized } from '../src/inventory.mjs';

const bundle = (name, fields = {}) => ({ name, installed: true, enabled: true,
  official: false, rows: [], ...fields });
const plugin = (entryId, fields = {}) => ({ entryId, moduleName: 'shared-module',
  enabled: true, fiberPhase: 'active', ...fields });

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}

test('localized handles exact, regional, English and deterministic fallback', () => {
  assert.equal(localized('Plain', 'zh'), 'Plain');
  const value = { fr: 'Français', en: 'English', zh: '中文', 'zh-Hant': '繁體' };
  assert.equal(localized(value, 'ZH_hant'), '繁體');
  assert.equal(localized(value, 'zh-Hans-CN'), '中文');
  assert.equal(localized(value, 'de-DE'), 'English');
  assert.equal(localized({ zz: 'last', aa: 'first', en: '' }, 'de'), 'first');
  assert.equal(localized({ en: null, zh: '中' }), '中');
  for (const empty of [null, undefined, {}, 5, { en: '', zh: '  ' }]) {
    assert.equal(localized(empty, 'zh'), '');
  }
});

test('installed only, stable ordering, official fields retained, no input mutation', () => {
  const error = { code: 'operation-error', diagnostic: 'offline' };
  const bundles = freeze([
    bundle('zeta', { enabled: false, error }),
    bundle('alpha', { official: true }),
    bundle('catalog', { installed: false }),
    { name: 'not-installed', rows: [] },
  ]);
  const items = buildInventory(bundles, freeze([]));
  assert.deepEqual(items.map(item => item.name), ['alpha', 'zeta']);
  assert.equal(items[0].source, 'official');
  assert.equal(items[1].source, 'thirdParty');
  assert.equal(items[1].enabled, false);
  assert.equal(items[1].error, error);
  assert.equal(items[1].state, 'problem');
  assert.notEqual(items[0], bundles[1]);
  assert.deepEqual(buildInventory(), []);
});

test('joins strictly by entryId, retaining plugin enabled and fiberPhase', () => {
  const plugins = freeze([
    plugin('wrong', { fiberPhase: 'failed' }),
    plugin('right', { enabled: false, fiberPhase: 'pending' }),
  ]);
  const rows = freeze([
    { rowId: 'row', moduleName: 'shared-module', entryId: 'right' },
    { rowId: 'missing', moduleName: 'shared-module', entryId: 'absent' },
    { rowId: 'anonymous', moduleName: 'shared-module' },
    { rowId: 'alias', moduleName: 'shared-module', entryId: 'right' },
  ]);
  const [item] = buildInventory([bundle('selection', { rows })], plugins);
  assert.deepEqual(item.plugins, [plugins[1]]);
  assert.equal(item.rows[0].plugin, plugins[1]);
  assert.equal(item.rows[1].plugin, undefined);
  assert.equal(item.rows[2].plugin, undefined);
  assert.equal(item.rows[0].plugin.enabled, false);
  assert.equal(item.rows[0].plugin.fiberPhase, 'pending');
  assert.equal(item.state, 'enabled');
  assert.equal(rows[0].plugin, undefined);
});

test('state follows bundle selection, not active fibers, with failed/error precedence', () => {
  for (const enabled of [true, false]) {
    for (const phase of [null, 'pending', 'loading', 'active', 'unloading', 'failed']) {
      for (const pluginEnabled of [true, false]) {
        const [item] = buildInventory([bundle('state', { enabled,
          rows: [{ entryId: 'entry', moduleName: 'module' }] })],
        [plugin('entry', { fiberPhase: phase, enabled: pluginEnabled })]);
        assert.equal(item.state, phase === 'failed' ? 'problem' : enabled ? 'enabled' : 'disabled',
          JSON.stringify({ enabled, phase, pluginEnabled }));
      }
    }
    assert.equal(buildInventory([bundle('empty', { enabled })])[0].state,
      enabled ? 'enabled' : 'disabled');
  }
});

test('purpose rules cover categories, deterministic precedence, and unknown fallback', () => {
  assert.deepEqual(categories, ['developer', 'appearance', 'productivity', 'model', 'mcp', 'knowledge', 'other']);
  assert.ok(Object.isFrozen(categories));
  const cases = [
    ['dsh-debugger', {}, 'developer'],
    ['unknown', { meta: { title: { zh: '透明主题' } } }, 'appearance'],
    ['unknown', { description: 'Calendar and workflow helper' }, 'productivity'],
    ['unknown', { rows: [{ moduleName: 'ollama-provider' }] }, 'model'],
    ['unknown', { description: 'MCP model provider' }, 'mcp'],
    ['unknown', { meta: { description: { ja: 'knowledge retrieval' } } }, 'knowledge'],
    ['dsh-xyzzy', {}, 'other'],
    ['dsh-balance-bar', { description: 'Display DeepSeek account balance' }, 'other'],
    ['dsh-some-tool', { description: 'A DeepSeek Harness plugin' }, 'other'],
    ['dsh-modlens', { description: 'Plug-in vision for text-only LLMs' }, 'model'],
    ['themedley', { description: 'memorial equipment' }, 'other'],
  ];
  for (const [name, fields, expected] of cases) {
    assert.equal(buildInventory([bundle(name, fields)])[0].category, expected, name);
  }
});

test('search ANDs case-insensitive tokens across package, every locale, and matched modules', () => {
  const items = buildInventory([bundle('dsh-example', {
    meta: { title: { en: 'Research', zh: '知识助手' },
      description: { fr: 'Mémoire distante', en: 'Remote archive' } },
    rows: [{ entryId: 'p', moduleName: 'row-module', meta: { title: { de: 'Sammlung' } } }],
  })], [plugin('p', { moduleName: 'hidden-runtime',
    meta: { description: { ja: '日本語検索' } } })]);
  for (const locale of ['en', 'zh', 'de']) {
    assert.equal(filterInventory(items, { query: '  DSH-EXAMPLE\n知识助手 MÉMOIRE row-module HIDDEN-RUNTIME 日本語検索 Sammlung  ' }, locale).length, 1);
    assert.equal(filterInventory(items, { query: 'Research absent' }, locale).length, 0);
  }
  assert.deepEqual(filterInventory(items, { query: ' \t\n' }), items);
});

test('source/state/category/query filters intersect for every boundary combination', () => {
  const items = buildInventory([
    bundle('official-code', { official: true }),
    bundle('third-code'),
    bundle('disabled-code', { enabled: false }),
    bundle('problem-code', { rows: [{ entryId: 'bad' }] }),
    bundle('unknown-package'),
  ], [plugin('bad', { fiberPhase: 'failed' })]);
  const original = items.slice();
  for (const source of [undefined, 'all', 'official', 'thirdParty', 'invalid']) {
    for (const state of [undefined, 'all', 'enabled', 'disabled', 'problem', 'invalid']) {
      for (const category of [undefined, 'all', 'developer', 'other', 'invalid']) {
        for (const query of ['', 'CODE', 'unknown', 'not found']) {
          const expected = items.filter(item =>
            (!source || source === 'all' || item.source === source)
            && (!state || state === 'all' || item.state === state)
            && (!category || category === 'all' || item.category === category)
            && query.toLowerCase().split(' ').every(token => item.name.includes(token)));
          assert.deepEqual(filterInventory(items, { source, state, category, query }), expected);
        }
      }
    }
  }
  assert.deepEqual(items, original);
  assert.notEqual(filterInventory(items), items);
  assert.deepEqual(filterInventory([], { query: 'x', category: 'other' }), []);
});
