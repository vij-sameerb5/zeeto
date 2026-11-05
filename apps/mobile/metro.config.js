// Lets Metro bundle the shared ../../packages/core TypeScript and reuse the web app's photos.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const config = getDefaultConfig(__dirname);
config.watchFolders = [path.join(root, 'packages/core'), path.join(root, 'apps/web/src/media')];
config.resolver.nodeModulesPaths = [path.join(__dirname, 'node_modules')];
config.resolver.extraNodeModules = { '@zeeto/core': path.join(root, 'packages/core/src') };
module.exports = config;
