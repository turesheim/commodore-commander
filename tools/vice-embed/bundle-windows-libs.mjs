import { execFileSync } from 'node:child_process';
import { copyFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function parsePeImports(output) {
  const names = [...output.matchAll(/^\s*DLL Name:\s*(\S+)\s*$/gm)].map(match => match[1]);
  if (!output.includes('file format pei-x86-64')) {
    throw new Error('Expected a native Windows x64 PE executable or DLL.');
  }
  return names;
}

async function directoryFiles(directory) {
  return new Map((await readdir(directory)).map(name => [name.toLowerCase(), path.join(directory, name)]));
}

// Windows searches the executable's directory for DLLs. Follow the PE import
// graph instead of copying the entire build toolchain or trusting its PATH.
export async function bundleWindowsLibraries(runtimeRoot, mingwPrefix, objdumpCommand) {
  if (process.platform !== 'win32') { throw new Error('Windows VICE bundling must run on Windows.'); }
  const binDir = path.join(await realpath(runtimeRoot), 'bin');
  const toolchainDir = path.join(await realpath(mingwPrefix), 'bin');
  const toolchainFiles = await directoryFiles(toolchainDir);
  const systemFiles = await directoryFiles(path.join(process.env.SystemRoot, 'System32'));
  const bundled = await directoryFiles(binDir);
  const executables = [...bundled.values()].filter(file => file.toLowerCase().endsWith('.exe'));
  if (!executables.length) { throw new Error(`No Windows executables in ${binDir}`); }
  const queue = [...executables, ...[...bundled.values()].filter(file => file.toLowerCase().endsWith('.dll'))];
  const visited = new Set();
  let copied = 0;
  for (const file of queue) {
    if (visited.has(file.toLowerCase())) { continue; }
    visited.add(file.toLowerCase());
    const imports = parsePeImports(execFileSync(objdumpCommand ?? path.join(toolchainDir, 'objdump.exe'), ['-p', file], {
      encoding: 'utf8', timeout: 15000
    }));
    for (const name of imports) {
      const key = name.toLowerCase();
      if (path.basename(name) !== name || /^(?:msys-|cygwin)/i.test(name)) {
        throw new Error(`Non-native or invalid Windows dependency: ${name}`);
      }
      if (bundled.has(key)) { queue.push(bundled.get(key)); continue; }
      if (toolchainFiles.has(key)) {
        const target = path.join(binDir, name);
        await copyFile(toolchainFiles.get(key), target);
        bundled.set(key, target);
        queue.push(target);
        copied++;
      } else if (!systemFiles.has(key) && !/^(?:api|ext)-ms-win-.*\.dll$/i.test(name)) {
        throw new Error(`Missing Windows VICE dependency in ${file}: ${name}`);
      }
    }
  }
  console.log(`Bundled Windows VICE: ${executables.length} executables, ${copied} DLLs (${visited.size} PE files verified).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  bundleWindowsLibraries(path.resolve(process.argv[2]), path.resolve(process.argv[3])).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
