const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const rootNodeModules = path.resolve(workspaceRoot, 'node_modules');

/**
 * Metro configuration for the KiteView monorepo.
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      rootNodeModules,
    ],
    disableHierarchicalLookup: true,
    extraNodeModules: {
      '@kiteview/core': path.resolve(workspaceRoot, 'packages/core'),
      '@kiteview/ui': path.resolve(workspaceRoot, 'packages/ui'),
      '@kiteview/pdf-engine': path.resolve(workspaceRoot, 'packages/pdf-engine'),
      '@supabase/supabase-js': path.resolve(
        workspaceRoot,
        'node_modules/@supabase/supabase-js',
      ),
      '@supabase/auth-js': path.resolve(
        workspaceRoot,
        'node_modules/@supabase/auth-js',
      // Hoisted workspace deps — pin explicit paths so package-local imports resolve
      // when disableHierarchicalLookup is on.
      'pdf-lib': path.resolve(rootNodeModules, 'pdf-lib'),
      '@react-native-async-storage/async-storage': path.resolve(
        rootNodeModules,
        '@react-native-async-storage/async-storage',
      ),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
