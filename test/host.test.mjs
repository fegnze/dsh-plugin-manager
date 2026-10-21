import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { apply } from '../src/host.mjs';

test('Host is inert: no routes, tools or mutations', () => {
  apply(new Proxy({}, { get() { throw new Error('Unexpected Host capability'); } }));
});

test('built Client registers an owned additive tab and disposes it', async () => {
  let plugin, definition;
  vm.runInNewContext(await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load({ factory }) { plugin = factory(name => { assert.equal(name, 'react'); return {}; }); } } },
  });
  let cleaned = 0;
  const effects = [];
  const ctx = { effect(fn) { effects.push(fn()); }, locale: { register() { return () => cleaned++; }, bind() { return key => key; } }, slots: { inject(key, fn) { assert.equal(key, 'plugins.tab'); return fn(); }, register(def, component) { definition = def; assert.equal(typeof component, 'function'); return () => cleaned++; } } };
  plugin.apply(ctx);
  assert.equal(definition.id, 'dsh-plugin-manager');
  assert.equal(definition.name, 'plugins.tab');
  assert.equal(definition.order, -10);
  assert.equal(definition.label(), 'tab');
  effects.reverse().forEach(dispose => dispose?.());
  assert.equal(cleaned, 2);
});

test('Remote decoder rejects failures and malformed inventory instead of empty success', async () => {
  let decode;
  const source = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'))
    .replace("return { inject: ['slots', 'locale'], apply };", 'return { decode: unwrap };');
  vm.runInNewContext(source, { window: { __ModuleLoader__: { load({ factory }) { decode = factory(() => ({})).decode; } } } });
  const values = [{ name: 'example' }];
  assert.equal(decode(values), values);
  assert.equal(decode({ ok: true, value: values }), values);
  assert.throws(() => decode({ ok: false, error: { message: 'Access denied' } }), /Access denied/);
  assert.throws(() => decode({ ok: false, error: { code: 'offline' } }), /offline/);
  for (const value of [null, undefined, {}, { ok: true, value: null }]) {
    assert.throws(() => decode(value), /Invalid official inventory response/);
  }
});

test('scoped manifest and loader identity preserve stable component id', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  const patch = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8');
  assert.equal(manifest.name, '@fegnze/dsh-plugin-manager');
  assert.match(client, /load\(\{ id: '@fegnze\/dsh-plugin-manager'/);
  assert.match(patch, /id: dsh-plugin-manager/);
  assert.match(patch, /name: '@fegnze\/dsh-plugin-manager'/);
  assert.match(client, /tab: '管理'/);
  assert.match(client, /h\('button', \{ type: 'button', className: 'dpm-row'/);
  assert.match(client, /h\(PackageIcon, \{ icon: item.meta\?\.icon \}/);
  assert.match(client, /onError: \(\) => setFailed\(true\)/);
});

test('runtime has read-only official API boundary and native navigation', async () => {
  const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  assert.match(client, /pm\.listBundles\(\)/);
  assert.match(client, /pm\.listPlugins\(\)/);
  assert.match(client, /openPackage\(item.name\)/);
  assert.doesNotMatch(client, /setBundleEnabled|setPluginEnabled|removeBundle|installBundle|setVersionExemption|document\.body|fetch\(/);
  assert.match(client, /result\?\.ok === false/);
  assert.match(client, /generation.current\+\+/);
});
