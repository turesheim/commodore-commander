import path from 'node:path';

// Build-time layout shared by asset sync and packaged-runtime smoke tests.
export function bundledViceLayout(platform = process.platform, arch = process.arch) {
  const platformKey = `${platform}-${arch}`;
  if (platformKey === 'darwin-arm64') {
    return { platformKey, packagePath: path.join(platformKey, 'VICE.app'), resourcesPath: path.join('Contents', 'Resources') };
  }
  if (platformKey === 'linux-x64') {
    return { platformKey, packagePath: platformKey, resourcesPath: '' };
  }
  return undefined;
}

export function packagedViceResources(appResourcesDir) {
  const layout = bundledViceLayout();
  if (!layout) { throw new Error(`No bundled VICE layout for ${process.platform}-${process.arch}`); }
  return path.join(appResourcesDir, 'lib', 'backend', 'assets', 'vice', layout.packagePath, layout.resourcesPath);
}
