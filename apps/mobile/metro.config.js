// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// pnpm monorepo wiring — Metro must:
//   1. watch the workspace root so it sees @smartshaadi/* packages + hoisted deps
//   2. resolve modules from BOTH the app's node_modules and the root store
// The workspace-level @smartshaadi/* packages are additionally hoisted into the
// root node_modules via the root `.npmrc` (public-hoist-pattern=@smartshaadi/*),
// so this app resolves their built `dist/` output cleanly.
// Modern Expo Metro already follows symlinks and does hierarchical lookup, so we
// only add the two monorepo essentials: watch the workspace root, and resolve
// modules from both the app store and the root store.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = withNativeWind(config, { input: './src/global.css' });
