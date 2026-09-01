// Monorepo Metro yapılandırması + workspace TS paketlerini (@alarga/*) çözme.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

// SADECE @alarga/* workspace paketlerinin göreli import'ları ".ts"/".tsx" uzantılı
// yazıldı (Node --strip-types gereği). O paketlerden gelen istekte uzantıyı sıyır;
// başka her şeyi (Skia, MapLibre, expo-router…) dokunmadan Expo çözümleyicisine bırak.
const pkgsDir = path.join(workspaceRoot, "packages");
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const chained = upstream ?? context.resolveRequest;
  if (
    moduleName.startsWith(".") &&
    /\.tsx?$/.test(moduleName) &&
    (context.originModulePath ?? "").startsWith(pkgsDir)
  ) {
    return chained(context, moduleName.replace(/\.tsx?$/, ""), platform);
  }
  return chained(context, moduleName, platform);
};

module.exports = config;
