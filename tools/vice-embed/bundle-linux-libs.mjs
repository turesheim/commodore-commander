import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, open, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Keep the host's glibc and ELF loader together. This is a glibc build, not a
// musl/static distribution; graphics/audio drivers loaded by SDL remain host-owned.
export function isHostLibrary(name) {
  return /^(?:ld-linux[^/]*|lib(?:c|m|pthread|dl|rt|resolv|util|anl)\.so\.\d+)$/u.test(name);
}

export function parseDependencies(output) {
  const dependencies = [];
  for (const line of output.split('\n').map(value => value.trim()).filter(Boolean)) {
    // ldd reports this for shared ELF libraries with no DT_NEEDED entries too.
    if (line === 'statically linked') { continue; }
    if (/^linux-vdso[^ ]* /u.test(line)) { continue; }
    if (/=> not found$/u.test(line)) { throw new Error(`Missing Linux VICE dependency: ${line}`); }
    const linked = /^(\S+) => (\/.*?) \(0x[\da-f]+\)$/u.exec(line);
    const loader = /^(\/.*?) \(0x[\da-f]+\)$/u.exec(line);
    if (linked) {
      dependencies.push({ name: linked[1], source: linked[2] });
    } else if (loader) {
      dependencies.push({ name: path.basename(loader[1]), source: loader[1] });
    } else {
      throw new Error(`Unrecognized ldd output: ${line}`);
    }
  }
  return dependencies;
}

const env = Object.fromEntries(Object.entries(process.env)
  .filter(([name]) => name !== 'LD_LIBRARY_PATH' && name !== 'LD_PRELOAD'));
env.LC_ALL = 'C';
function run(command, args) {
  return execFileSync(command, args, { env, encoding: 'utf8', timeout: 15000 });
}
async function elfFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile()) { continue; }
    const filePath = path.join(directory, entry.name);
    const handle = await open(filePath, 'r');
    try {
      const magic = Buffer.alloc(4);
      await handle.read(magic, 0, 4, 0);
      if (magic.equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) { files.push(filePath); }
    } finally { await handle.close(); }
  }
  return files;
}

export async function bundleLinuxLibraries(runtimeRoot) {
  if (process.platform !== 'linux') { throw new Error('Linux VICE bundling must run on Linux.'); }
  const root = await realpath(path.resolve(runtimeRoot));
  const libDir = path.join(root, 'lib');
  await mkdir(libDir, { recursive: true });
  const binaries = await elfFiles(path.join(root, 'bin'));
  if (binaries.length === 0) { throw new Error(`No VICE ELF executables in ${root}/bin`); }
  const queue = [...binaries, ...await elfFiles(libDir)];
  const sources = new Map();
  const visited = new Set();
  // Resolve before rewriting search paths, including transitive dependencies.
  for (let index = 0; index < queue.length; index++) {
    const file = queue[index];
    if (visited.has(file)) { continue; }
    visited.add(file);
    for (const { name, source } of parseDependencies(run('ldd', [file]))) {
      if (isHostLibrary(name)) { continue; }
      if (path.basename(name) !== name) { throw new Error(`Invalid dependency name: ${name}`); }
      const canonical = await realpath(source);
      const previous = sources.get(name);
      if (previous && previous !== canonical) { throw new Error(`Conflicting Linux libraries named ${name}`); }
      sources.set(name, canonical);
      const target = path.join(libDir, name);
      if (canonical !== target && !visited.has(target) && !queue.includes(target)) {
        await copyFile(canonical, target);
        queue.push(target);
      }
    }
  }
  for (const file of visited) {
    run('patchelf', ['--set-rpath', path.dirname(file) === libDir ? '$ORIGIN' : '$ORIGIN/../lib', file]);
  }
  // A library's own RUNPATH resolves its direct dependencies. Verify every ELF
  // without loader overrides, rejecting fallbacks to build-host libraries.
  for (const file of visited) {
    for (const { name, source } of parseDependencies(run('ldd', [file]))) {
      if (!isHostLibrary(name) && path.dirname(await realpath(source)) !== libDir) {
        throw new Error(`Unbundled Linux dependency in ${file}: ${name} => ${source}`);
      }
    }
  }
  console.log(`Bundled Linux VICE: ${binaries.length} executables, ${sources.size} non-glibc shared libraries.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) { throw new Error('Usage: node bundle-linux-libs.mjs <runtime root>'); }
  await bundleLinuxLibraries(process.argv[2]);
}
