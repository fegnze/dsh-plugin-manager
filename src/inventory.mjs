/** Local display categories, not authoritative plugin-manager metadata. */
export const categories = Object.freeze([
  'developer', 'appearance', 'productivity', 'model', 'mcp', 'knowledge', 'other',
]);

const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const localeKey = value => String(value).toLowerCase().replaceAll('_', '-');
const texts = value => typeof value === 'string' ? [value]
  : value && typeof value === 'object'
    ? Object.keys(value).sort(compare).map(key => value[key]).filter(v => typeof v === 'string')
    : [];

/** Exact locale, progressively less specific locale, English, then stable fallback. */
export function localized(value, locale = 'en') {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const keys = Object.keys(value).sort(compare);
  const get = key => {
    const match = keys.find(candidate => localeKey(candidate) === key);
    return match && typeof value[match] === 'string' && value[match].trim() ? value[match] : '';
  };
  let requested = localeKey(locale || 'en');
  while (requested) {
    const result = get(requested);
    if (result) return result;
    const end = requested.lastIndexOf('-');
    requested = end < 0 ? '' : requested.slice(0, end);
  }
  return get('en') || texts(value).find(text => text.trim()) || '';
}

function searchable(item) {
  const values = [];
  const add = record => {
    if (!record) return;
    values.push(record.name, record.moduleName, record.description,
      ...texts(record.meta?.title), ...texts(record.meta?.description));
  };
  add(item);
  for (const row of item.rows || []) { add(row); add(row.plugin); }
  for (const plugin of item.plugins || []) add(plugin);
  return values.filter(value => typeof value === 'string').join(' ').toLowerCase();
}

// Specific protocols/domains precede generic tooling words. English keywords use
// word boundaries (so "theme" does not match "themedley"); Chinese uses phrases.
// First matching rule wins; unmatched metadata is explicitly Other.
const purposeRules = [
  ['mcp', /\bmcp\b|model context protocol|模型上下文协议/u],
  ['knowledge', /\b(knowledge|memory|notes?|retrieval|rag)\b|知识|记忆|笔记|检索/u],
  ['model', /\b(llm|inference|openai|anthropic|ollama|vision)\b|\bmodel[- ](?:provider|service|routing|selection)s?\b|模型(?:服务|供应商|选择|路由)|推理|视觉/u],
  ['appearance', /\b(themes?|appearance|wallpaper|transparent|typography|fonts?)\b|主题|外观|壁纸|透明|字体/u],
  ['developer', /\b(developer|development|devtools?|debug(?:ger|ging)?|code|coding|git|terminal|console|openspec)\b|开发|调试|代码|终端/u],
  ['productivity', /\b(productivity|tasks?|calendar|workflow|automation|clipboard|shortcuts?|launcher|todo)\b|效率|任务|日历|工作流|自动化|剪贴板|快捷/u],
];

/**
 * Derive a read-only display inventory from official BundleInfo/PluginInfo arrays.
 * Only entry identity joins rows: module names are not unique runtime identities.
 * Enabled means selected, NOT active; failed fibers (or bundle errors) are problems.
 * Input objects are never changed; ordering is locale-independent by package name.
 */
export function buildInventory(bundles = [], plugins = []) {
  const byEntry = new Map(plugins.filter(plugin => plugin.entryId != null)
    .map(plugin => [plugin.entryId, plugin]));
  return bundles.filter(bundle => bundle.installed === true).map(bundle => {
    const rows = (bundle.rows || []).map(row => {
      const plugin = row.entryId == null ? undefined : byEntry.get(row.entryId);
      return plugin ? { ...row, plugin } : { ...row };
    });
    const matched = [...new Map(rows.filter(row => row.plugin)
      .map(row => [row.plugin.entryId, row.plugin])).values()]
      .sort((a, b) => compare(a.entryId, b.entryId));
    const item = {
      ...bundle,
      rows,
      plugins: matched,
      source: bundle.official ? 'official' : 'thirdParty',
      state: bundle.error || matched.some(plugin => plugin.fiberPhase === 'failed')
        ? 'problem' : bundle.enabled ? 'enabled' : 'disabled',
    };
    const haystack = searchable(item);
    item.category = purposeRules.find(([, rule]) => rule.test(haystack))?.[0] || 'other';
    return item;
  }).sort((a, b) => compare(a.name, b.name));
}

/** All independent filters intersect; query tokens AND across every metadata locale. */
export function filterInventory(items, { query = '', source, state, category } = {}, locale = 'en') {
  // Locale selects display text, never which translations are searchable.
  const tokens = String(query || '').trim().toLowerCase().split(/\s+/u).filter(Boolean);
  const accepts = (filter, value) => !filter || filter === 'all' || filter === value;
  return items.filter(item => {
    if (!accepts(source, item.source) || !accepts(state, item.state)
      || !accepts(category, item.category)) return false;
    const haystack = `${searchable(item)} ${localized(item.meta?.title, locale).toLowerCase()}`;
    return tokens.every(token => haystack.includes(token));
  });
}
