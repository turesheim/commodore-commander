#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Inspect original images before rewriting them: @loader_path and LC_RPATH
// belong to the source library, including dependencies not yet copied here.
const resources = path.resolve(process.argv[2]);
const libraryDir = path.join(resources, 'lib');
fs.mkdirSync(libraryDir, { recursive: true });
const images = new Map();
const librarySources = new Map();

function run(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function collectFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(file) : entry.isFile() ? [file] : [];
  });
}

function isMachO(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const magic = Buffer.alloc(4);
    return fs.readSync(fd, magic, 0, 4, 0) === 4 &&
      [0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe,
        0xcafebabe, 0xbebafeca, 0xcafebabf, 0xbfbafeca].includes(magic.readUInt32BE());
  } finally {
    fs.closeSync(fd);
  }
}

function expandLoaderPath(value, source) {
  if (value.startsWith('@executable_path/')) {
    return path.resolve(resources, 'bin', value.slice('@executable_path/'.length));
  }
  return value.startsWith('@loader_path/')
    ? path.resolve(path.dirname(source), value.slice('@loader_path/'.length))
    : value;
}

function systemDependency(value) {
  return value.startsWith('/usr/lib/') || value.startsWith('/System/Library/');
}

function inspect(source, target, inheritedRunpaths = []) {
  if (images.has(target)) {
    return;
  }
  const loadCommands = run('otool', ['-l', source]);
  const ownRunpaths = [...loadCommands.matchAll(/cmd LC_RPATH\s+cmdsize \d+\s+path (.+) \(offset \d+\)/gu)]
    .map(match => match[1]);
  const runpaths = [...ownRunpaths.map(value => expandLoaderPath(value, source)), ...inheritedRunpaths];
  const id = run('otool', ['-D', source]).split('\n')[1]?.trim();
  const dependencies = run('otool', ['-L', source]).split('\n').slice(1)
    .map(line => line.trim().split(' (compatibility version')[0])
    .filter(value => value && value !== id);
  const image = { target, id, ownRunpaths, changes: [] };
  images.set(target, image);

  for (const dependency of dependencies) {
    if (systemDependency(dependency)) {
      continue;
    }
    const candidates = dependency.startsWith('@rpath/')
      ? runpaths.map(directory => path.join(directory, dependency.slice('@rpath/'.length)))
      : [expandLoaderPath(dependency, source)];
    const resolved = candidates.find(candidate => path.isAbsolute(candidate) && fs.existsSync(candidate));
    if (!resolved) {
      throw new Error(`Cannot bundle ${dependency} required by ${source}; searched: ${candidates.join(', ')}`);
    }
    const name = path.basename(resolved);
    const previous = librarySources.get(name);
    const realSource = fs.realpathSync(resolved);
    if (previous && previous !== realSource &&
        !fs.readFileSync(previous).equals(fs.readFileSync(realSource))) {
      throw new Error(`Conflicting libraries named ${name}: ${previous} and ${realSource}`);
    }
    librarySources.set(name, realSource);
    const libraryTarget = path.join(libraryDir, name);
    if (!images.has(libraryTarget)) {
      if (path.resolve(resolved) !== libraryTarget) {
        if (fs.existsSync(libraryTarget) && fs.lstatSync(libraryTarget).isSymbolicLink()) {
          fs.unlinkSync(libraryTarget);
        }
        fs.copyFileSync(realSource, libraryTarget);
      }
      inspect(resolved, libraryTarget, runpaths);
    }
    image.changes.push([dependency, `@executable_path/../lib/${name}`]);
  }
}

for (const file of [...collectFiles(path.join(resources, 'bin')), ...collectFiles(libraryDir)]) {
  if (isMachO(file)) {
    inspect(file, file);
  }
}

// sdl2-compat loads SDL3 with dlopen(), so otool cannot report this edge.
// Its macOS loader first tries @loader_path/libSDL3.dylib beside SDL2:
// https://github.com/libsdl-org/sdl2-compat/blob/main/src/sdl2_compat.c
const sdl2 = path.join(libraryDir, 'libSDL2-2.0.0.dylib');
if (fs.existsSync(sdl2) && fs.readFileSync(sdl2).includes(Buffer.from('sdl2-compat:'))) {
  const sdl3Target = path.join(libraryDir, 'libSDL3.dylib');
  if (!fs.existsSync(sdl3Target)) {
    const sdl3Source = path.join(run('pkg-config', ['--variable=libdir', 'sdl3']).trim(), 'libSDL3.dylib');
    fs.copyFileSync(fs.realpathSync(sdl3Source), sdl3Target);
    inspect(sdl3Source, sdl3Target);
  }
}

for (const { target, id, ownRunpaths, changes } of images.values()) {
  fs.chmodSync(target, fs.statSync(target).mode | 0o200);
  const args = [];
  if (id) {
    args.push('-id', `@executable_path/../lib/${path.basename(target)}`);
  }
  for (const [before, after] of changes) {
    if (before !== after) {
      args.push('-change', before, after);
    }
  }
  // All non-system dependencies are explicit bundled paths after rewriting.
  // Remove build-machine search paths so Homebrew cannot mask missing files.
  for (const runpath of new Set(ownRunpaths)) {
    if (path.isAbsolute(runpath) && !systemDependency(`${runpath}/`)) {
      args.push('-delete_rpath', runpath);
    }
  }
  if (args.length) {
    run('install_name_tool', [...args, target]);
  }
}
console.log(`Bundled dependency closure for ${images.size} Mach-O images in ${resources}`);
