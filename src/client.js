window.__ModuleLoader__.load({ id: '@fegnze/dsh-plugin-manager', factory: require => {
  const React = require('react'), h = React.createElement;
  /* INVENTORY_MODEL */
  const NS = 'dshPluginManager';
  const dictionaries = {
    zh: { tab: '管理', search: '搜索名称、描述或模块', source: '维护归属', state: '启用配置', issue: '异常', more: '更多条件', removable: '允许移除', readOnly: '只读管理', availability: '包文件', yes: '是', no: '否', missing: '缺失', available: '可读取', none: '无已报告异常', all: '全部', official: '官方', thirdParty: '非官方', enabled: '已选用', disabled: '未选用', problem: '异常', refresh: '刷新', reset: '清除筛选', details: '详情', loading: '正在读取插件…', unavailable: '官方插件管理服务不可用', empty: '没有匹配的已安装插件', count: '已安装', retry: '重试', unknownVersion: '版本未知' },
    en: { tab: 'Manage', search: 'Search names, descriptions or modules', source: 'Maintenance', state: 'Selection', issue: 'Issues', more: 'More filters', removable: 'Removable', readOnly: 'Read-only management', availability: 'Package files', yes: 'Yes', no: 'No', missing: 'Missing', available: 'Readable', none: 'No reported issues', all: 'All', official: 'Official', thirdParty: 'Non-official', enabled: 'Selected', disabled: 'Not selected', problem: 'Problem', refresh: 'Refresh', reset: 'Clear filters', details: 'Details', loading: 'Loading plugins…', unavailable: 'Official plugin manager unavailable', empty: 'No matching installed plugins', count: 'Installed', retry: 'Retry', unknownVersion: 'Unknown version' },
  };
  function getOptional(ctx, key) { try { return ctx.get(key); } catch { return undefined; } }
  function unwrap(result) {
    if (result?.ok === false) throw new Error(result.error?.message || result.error?.code || 'Remote request failed');
    const value = result?.ok === true ? result.value : result;
    if (!Array.isArray(value)) throw new Error('Invalid official inventory response');
    return value;
  }
  function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, dictionaries));
    const t = ctx.locale.bind(NS);
    function PackageIcon({ icon }) {
      const [failed, setFailed] = React.useState(false);
      React.useEffect(() => setFailed(false), [icon]);
      const usable = typeof icon === 'string' && /^(data:image\/|https?:\/\/)/i.test(icon);
      return h('span', { className: 'dpm-icon', 'aria-hidden': true }, usable && !failed
        ? h('img', { src: icon, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer', onError: () => setFailed(true) })
        : h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 }, h('rect', { x: 4, y: 4, width: 6, height: 6, rx: 1.5 }), h('rect', { x: 14, y: 4, width: 6, height: 6, rx: 1.5 }), h('rect', { x: 4, y: 14, width: 6, height: 6, rx: 1.5 }), h('rect', { x: 14, y: 14, width: 6, height: 6, rx: 1.5 })));
    }
    function Page({ openPackage }) {
      const localeState = React.useSyncExternalStore(fn => ctx.locale.subscribe(fn), () => ctx.locale.getSnapshot());
      const language = localeState.active;
      const [data, setData] = React.useState(null), [error, setError] = React.useState(''), [loading, setLoading] = React.useState(true);
      const [query, setQuery] = React.useState(''), [source, setSource] = React.useState('all'), [state, setState] = React.useState('all'), [issue, setIssue] = React.useState('all'), [removable, setRemovable] = React.useState('all'), [readOnly, setReadOnly] = React.useState('all'), [availability, setAvailability] = React.useState('all');
      const generation = React.useRef(0);
      const load = React.useCallback(async () => {
        const seq = ++generation.current;
        setLoading(true); setError('');
        try {
          const pm = getOptional(ctx, 'remote.pluginManager');
          if (!pm) throw new Error(t('unavailable'));
          const [bundles, plugins] = await Promise.all([pm.listBundles(), pm.listPlugins()]);
          const items = buildInventory(unwrap(bundles), unwrap(plugins));
          if (seq === generation.current) setData(items);
        } catch (e) { if (seq === generation.current) setError(String(e?.message || e)); }
        finally { if (seq === generation.current) setLoading(false); }
      }, []);
      React.useEffect(() => {
        void load();
        const remote = getOptional(ctx, 'remote');
        let off;
        try { off = remote?.$on?.('plugin-manager/changed', load); } catch { /* explicit refresh remains available */ }
        return () => { generation.current++; if (typeof off === 'function') off(); };
      }, [load]);
      const items = filterInventory(data || [], { query, source, state, issue, removable, readOnly, availability }, language);
      const select = (name, value, change, choices) => h('label', { className: 'dpm-select', key: name }, h('span', null, t(name)), h('select', { value, onChange: e => change(e.target.value), 'aria-label': t(name) }, ['all', ...choices].map(id => h('option', { key: id, value: id }, t(id)))));
      return h('section', { className: 'dpm-root', 'aria-busy': loading },
        h('style', { 'data-plugin': 'dsh-plugin-manager' }, CSS),
        h('div', { className: 'dpm-toolbar' }, h('input', { type: 'search', value: query, onChange: e => setQuery(e.target.value), placeholder: t('search'), 'aria-label': t('search') }), h('button', { type: 'button', onClick: load, disabled: loading }, t('refresh'))),
        h('div', { className: 'dpm-filters' }, select('source', source, setSource, ['official', 'thirdParty']), select('state', state, setState, ['enabled', 'disabled']), select('issue', issue, setIssue, ['problem', 'none']), h('button', { type: 'button', onClick: () => { setQuery(''); setSource('all'); setState('all'); setIssue('all'); setRemovable('all'); setReadOnly('all'); setAvailability('all'); } }, t('reset'))),
        h('details', { className: 'dpm-advanced' }, h('summary', null, t('more')), h('div', { className: 'dpm-filters' }, select('removable', removable, setRemovable, ['yes', 'no']), select('readOnly', readOnly, setReadOnly, ['yes', 'no']), select('availability', availability, setAvailability, ['missing', 'available']))),
        error ? h('div', { role: 'alert', className: 'dpm-error' }, error, ' ', h('button', { type: 'button', onClick: load, disabled: loading }, t('retry'))) : null,
        h('div', { className: 'dpm-count', role: 'status' }, loading ? t('loading') : error ? '' : `${t('count')} ${items.length} / ${data?.length || 0}`),
        !error && data && !items.length && !loading ? h('p', { className: 'dpm-empty' }, t('empty')) : null,
        !error ? h('div', { className: 'dpm-list' }, items.map(item => h('button', { type: 'button', className: 'dpm-row', key: item.name, disabled: typeof openPackage !== 'function', onClick: () => openPackage(item.name), 'aria-label': `${t('details')} · ${localized(item.meta?.title, language) || item.name}` },
          h(PackageIcon, { icon: item.meta?.icon }),
          h('span', { className: 'dpm-copy' }, h('span', { className: 'dpm-title' }, h('strong', null, localized(item.meta?.title, language) || item.name), h('span', { className: 'dpm-tag' }, t(item.source))), h('code', null, item.name), h('span', { className: 'dpm-description' }, localized(item.meta?.description, language) || item.description || '')),
          h('span', { className: 'dpm-meta' }, h('span', null, item.version ? `v${item.version}` : t('unknownVersion')), h('span', null, t(item.enabled ? 'enabled' : 'disabled')), item.state === 'problem' && h('span', { 'data-state': 'problem' }, t('problem')), h('span', { className: 'dpm-chevron', 'aria-hidden': true }, '›'))
        ))) : null);
    }
    ctx.effect(() => ctx.slots.inject('plugins.tab', () => ctx.slots.register({ name: 'plugins.tab', id: 'dsh-plugin-manager', order: -10, label: () => t('tab'), locale: NS }, Page)));
  }
  const CSS = `.dpm-root{color:var(--dsw-alias-label-primary);font-family:inherit;font-size:14px;line-height:1.5;min-width:0;padding:8px 0 24px}.dpm-root *{box-sizing:border-box}.dpm-root button,.dpm-root input,.dpm-root select{font:inherit;color:inherit;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);border-radius:8px;padding:7px 10px}.dpm-root button{cursor:pointer;white-space:nowrap}.dpm-root button:hover{background:var(--dsw-alias-interactive-bg-hover)}.dpm-root button:disabled{opacity:.5;cursor:default}.dpm-root :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.dpm-toolbar{display:flex;gap:10px}.dpm-toolbar input{flex:1;min-width:0}.dpm-filters{display:flex;align-items:end;gap:12px;flex-wrap:wrap;margin:14px 0}.dpm-select{display:grid;gap:4px;min-width:110px}.dpm-select>span,.dpm-count{font-size:12px;color:var(--dsw-alias-label-tertiary)}.dpm-count{margin:12px 0}.dpm-advanced{font-size:12px;color:var(--dsw-alias-label-secondary)}.dpm-advanced summary{cursor:pointer}.dpm-list{display:grid;gap:4px;margin:0 -8px}.dpm-root .dpm-row{display:flex;align-items:center;gap:16px;width:100%;padding:12px 8px;border:0;border-radius:12px;background:transparent;text-align:left;white-space:normal}.dpm-root .dpm-row:hover{background:var(--dsw-alias-interactive-bg-hover)}.dpm-icon{width:48px;height:48px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-tertiary)}.dpm-icon img,.dpm-icon svg{width:28px;height:28px;object-fit:contain}.dpm-copy{min-width:0;flex:1}.dpm-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.dpm-title strong{font-weight:600}.dpm-tag{font-size:11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border-radius:4px;padding:1px 6px}.dpm-copy code{display:block;overflow-wrap:anywhere;font-size:12px;color:var(--dsw-alias-label-tertiary);margin-top:2px}.dpm-description{display:block;font-size:14px;color:var(--dsw-alias-label-secondary);margin:4px 0 0;overflow-wrap:anywhere}.dpm-chevron{font-size:22px;margin-left:4px}.dpm-title strong{font-size:15px}.dpm-meta{display:flex;align-items:center;justify-content:end;gap:12px;flex-shrink:0;font-size:12px;color:var(--dsw-alias-label-tertiary)}.dpm-meta [data-state=problem],.dpm-error{color:var(--dsw-alias-state-error-primary)}.dpm-empty{padding:28px 0;color:var(--dsw-alias-label-secondary)}@media(max-width:760px){.dpm-root .dpm-row{flex-wrap:wrap;gap:12px}.dpm-copy{flex-basis:calc(100% - 64px)}.dpm-meta{margin-left:60px;flex-wrap:wrap}.dpm-filters{gap:8px}.dpm-select{min-width:90px}}`;
  return { inject: ['slots', 'locale'], apply };
} });
