import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { bundleWindowsLibraries, parsePeImports } from './bundle-windows-libs.mjs';

test('PE import parsing rejects non-x64 inputs and preserves DLL names', () => {
  assert.deepEqual(parsePeImports('a.exe: file format pei-x86-64\n DLL Name: KERNEL32.dll\n DLL Name: SDL2.dll\n'), ['KERNEL32.dll', 'SDL2.dll']);
  assert.throws(() => parsePeImports('file format pei-i386'), /native Windows x64/);
});

test('real PE DLL chain runs after removing build libraries and relocating runtime', {
  skip: process.platform !== 'win32', timeout: 30000
}, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cc PE relocation-'));
  const prefix = path.join(root, 'build libraries');
  const bin = path.join(root, 'runtime', 'bin');
  const compile = (args) => execFileSync('gcc', args, { cwd: root, timeout: 10000 });
  try {
    await mkdir(path.join(prefix, 'bin'), { recursive: true });
    await mkdir(bin, { recursive: true });
    await writeFile(path.join(root, 'leaf.c'), '__declspec(dllexport) int leaf(void) { return 42; }\n');
    await writeFile(path.join(root, 'middle.c'), '__declspec(dllimport) int leaf(void); __declspec(dllexport) int middle(void) { return leaf(); }\n');
    await writeFile(path.join(root, 'main.c'), '__declspec(dllimport) int middle(void); int main(void) { return middle() == 42 ? 0 : 1; }\n');
    compile(['-shared', '-static-libgcc', 'leaf.c', '-o', path.join(prefix, 'bin', 'ccleaf.dll'), '-Wl,--out-implib,leaf.a']);
    compile(['-shared', '-static-libgcc', 'middle.c', 'leaf.a', '-o', path.join(prefix, 'bin', 'ccmiddle.dll'), '-Wl,--out-implib,middle.a']);
    compile(['-static-libgcc', 'main.c', 'middle.a', '-o', path.join(bin, 'test.exe')]);
    await bundleWindowsLibraries(path.join(root, 'runtime'), prefix, 'objdump');
    await rename(path.join(root, 'runtime'), path.join(root, 'relocated runtime'));
    await rm(prefix, { recursive: true });
    const systemRoot = process.env.SystemRoot;
    execFileSync(path.join(root, 'relocated runtime', 'bin', 'test.exe'), [], {
      cwd: os.tmpdir(), env: { ...process.env, PATH: `${systemRoot}\\System32;${systemRoot}` }, timeout: 5000
    });
    // A missing transitive import must fail packaging before product launch.
    await mkdir(path.join(prefix, 'bin'), { recursive: true });
    await rm(path.join(root, 'relocated runtime', 'bin', 'ccleaf.dll'));
    await assert.rejects(bundleWindowsLibraries(path.join(root, 'relocated runtime'), prefix, 'objdump'), /Missing Windows VICE dependency.*ccleaf.dll/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
