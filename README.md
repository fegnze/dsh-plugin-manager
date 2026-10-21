# dsh-plugin-manager

English | [简体中文](./docs/zh.md)

A read-only **Manage** tab inside DSH's official Plugins page. Find installed bundles without replacing the official manager or modifying its DOM.

## Features

- Search names, descriptions, localized metadata, and plugin module names. Whitespace-separated terms match together, across languages.
- Combine independent maintenance (official/non-official), bundle selection and reported-issue filters. More filters exposes removability, read-only management and package-file availability.
- Official-style rounded rows with metadata icons, title and description hierarchy, package name, version, maintenance, selection and reported issues. Activate a row by mouse or keyboard to open official details.
- **Manage** appears between **Installed** and **Discover**.
- Explicit refresh and refresh after official plugin-manager operations.
- English and Simplified Chinese UI following the host locale and theme.

Only installed bundles are listed. All installation and runtime facts come from official `pluginManager.listBundles()` and `listPlugins()`. A failed bundle or linked plugin fiber is marked Problem; Enabled means bundle selection, not a claim that every plugin is active. No purpose is inferred from text. Selection and issues are independent: a selected or unselected bundle can have a reported issue. Metadata diagnostics are not treated as runtime failures; no reported issue is not a health guarantee. Missing optional fields are not guessed.

## Installation and usage

Build locally with `npm run build`, then install this package directory using DSH's official plugin installer in the **desktop** profile. Open **Plugins → Manage**, type search terms and combine factual filters. Clear filters resets the view. Activating a row opens the original official bundle page for configuration and management.

The npm identity is `@fegnze/dsh-plugin-manager`; the project directory and GitHub repository use the short name `dsh-plugin-manager`. Do not install the unrelated unscoped npm package. When migrating a previous local installation, remove the old bundle through the official manager before installing this scoped package; never load both together. Publication status must be verified separately from the manifest metadata.

## Permissions and limits

The Host is inert: no HTTP routes, subprocesses, timers, tools or persistent storage. The Client only reads official inventory, registers locale/Slot resources and subscribes while the view is mounted. Requests finishing after unmount are ignored. Unloading disposes owned resources.

There are no install, uninstall, enable/disable, update, configuration-write or version-exemption controls. Use the official Details page for these operations. No dedicated update API is assumed. A read failure is displayed explicitly instead of pretending the inventory is empty; use Refresh to retry. Changes outside the official manager may require manual refresh.

Compatibility is restricted to DSH `0.2.0-rc.2` or `0.2.1-rc.2`; recheck live contracts after upgrades. Local tests and registration alone do not establish desktop visual acceptance.

## Development

Requires Node 22+. No third-party build/runtime dependency is installed; React comes from DSH. `npm test` builds the Client envelope from the source template and inventory model, then runs native Node tests. Build artifacts are ignored by Git but included in the package payload; build before installation or packaging.

```sh
npm test
npm pack --dry-run --ignore-scripts
```

Development and delivery follow the workspace plugin devkit and native OpenSpec OPSX change, including separately verified source synchronization and npm publication. Local tests do not prove publication.
