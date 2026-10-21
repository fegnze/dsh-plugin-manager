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
    values.push(record.name, record.moduleName, record.description, record.rowId, record.entryId,
      ...texts(record.meta?.title), ...texts(record.meta?.description));
  };
  add(item);
  for (const row of item.rows || []) { add(row); add(row.plugin); }
  for (const plugin of item.plugins || []) add(plugin);
  return values.filter(value => typeof value === 'string').join(' ').toLowerCase();
}

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
    const issue = Boolean(bundle.error) || matched.some(plugin => plugin.fiberPhase === 'failed');
    return {
      ...bundle,
      rows,
      plugins: matched,
      source: bundle.official ? 'official' : 'thirdParty',
      // Keep the legacy derived state for list compatibility; selection is factual.
      state: issue ? 'problem' : bundle.enabled ? 'enabled' : 'disabled',
      selectionState: bundle.enabled === true ? 'enabled' : bundle.enabled === false ? 'disabled' : undefined,
      issue: issue ? 'problem' : 'none',
      metadataIssue: Boolean(bundle.meta?.error),
    };
  }).sort((a, b) => compare(a.name, b.name));
}

/** All independent factual filters intersect; query tokens AND across metadata. */
export function filterInventory(items, {
  query = '', source, state, issue, removable, readOnly, availability,
} = {}, locale = 'en') {
  // Locale selects display text, never which translations are searchable.
  const tokens = String(query || '').trim().toLowerCase().split(/\s+/u).filter(Boolean);
  const accepts = (filter, value) => !filter || filter === 'all' || filter === value;
  const boolFilter = (filter, value) => {
    if (!filter || filter === 'all') return true;
    if (filter === 'yes') return value === true;
    if (filter === 'no') return value === false;
    return false;
  };
  const availabilityValue = item => item.availability === 'missing' ? 'missing'
    : ['profile', 'installation'].includes(item.availability) ? 'available' : undefined;
  return items.filter(item => {
    // state is a compatibility field; filtering enabled/disabled is the package fact.
    const selectionState = item.enabled === true ? 'enabled' : item.enabled === false ? 'disabled' : undefined;
    const issueValue = item.issue === 'problem' || item.issue === 'none'
      ? item.issue
      : Boolean(item.error) || (item.plugins || []).some(plugin => plugin.fiberPhase === 'failed')
        ? 'problem' : 'none';
    const readOnlyValue = Boolean(item.readOnlyReason);
    if (!accepts(source, item.source) || !accepts(state, selectionState)
      || !accepts(issue, issueValue) || !boolFilter(removable, item.removable)
      || !boolFilter(readOnly, readOnlyValue) || !accepts(availability, availabilityValue(item))) return false;
    const haystack = `${searchable(item)} ${localized(item.meta?.title, locale).toLowerCase()}`;
    return tokens.every(token => haystack.includes(token));
  });
}
