import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { bundleLinuxLibraries, isHostLibrary, parseDependencies } from './bundle-linux-libs.mjs';

test('ldd missing dependencies fail packaging instead of producing an incomplete payload', () => {
  assert.throws(() => parseDependencies('libSDL2.so => not found'), /Missing Linux VICE dependency/u);
  assert.throws(() => parseDependencies('unexpected loader output'), /Unrecognized ldd output/u);
});
test('glibc stays with the host loader, while SDL and C++ runtimes are bundled', () => {
  for (const name of ['libc.so.6', 'libm.so.6', 'libpthread.so.0', 'ld-linux-x86-64.so.2']) {
    assert.equal(isHostLibrary(name), true);
  }
  for (const name of ['libSDL2-2.0.so.0', 'libstdc++.so.6', 'libgcc_s.so.1']) {
    assert.equal(isHostLibrary(name), false);
  }
});
test('real ELF dependency chain still runs after the runtime and build libraries move', {
  skip: process.platform !== 'linux'
}, async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'cc-elf-bundle-'));
  const original = path.join(temp, 'build-libraries');
  const runtime = path.join(temp, 'runtime');
  const relocated = path.join(temp, 'relocated runtime');
  const env = Object.fromEntries(Object.entries(process.env)
    .filter(([name]) => name !== 'LD_LIBRARY_PATH' && name !== 'LD_PRELOAD'));
  const run = (command, args) => execFileSync(command, args, { env, encoding: 'utf8' });
  try {
    await mkdir(original);
    await mkdir(path.join(runtime, 'bin'), { recursive: true });
    await writeFile(path.join(temp, 'b.c'), 'int b(void) { return 42; }');
    await writeFile(path.join(temp, 'a.c'), 'extern int b(void); int a(void) { return b(); }');
    await writeFile(path.join(temp, 'main.c'), '#include <stdio.h>\nextern int a(void); int main(void) { printf("%d\\n", a()); return 0; }');
    run('cc', ['-shared', '-fPIC', path.join(temp, 'b.c'), '-Wl,-soname,libcc_b.so', '-o', path.join(original, 'libcc_b.so')]);
    run('cc', ['-shared', '-fPIC', path.join(temp, 'a.c'), `-L${original}`, '-lcc_b', '-Wl,-soname,libcc_a.so',
      `-Wl,-rpath,${original}`, '-o', path.join(original, 'libcc_a.so')]);
    run('cc', [path.join(temp, 'main.c'), `-L${original}`, '-lcc_a', `-Wl,-rpath,${original}`,
      '-o', path.join(runtime, 'bin', 'x64sc')]);
    await bundleLinuxLibraries(runtime);
    await rm(original, { recursive: true });
    await rename(runtime, relocated);
    assert.equal(run(path.join(relocated, 'bin', 'x64sc'), []), '42\n');
    assert.equal(run('patchelf', ['--print-rpath', path.join(relocated, 'bin', 'x64sc')]).trim(), '$ORIGIN/../lib');
    // Packaging an already bundled payload must also work.
    await bundleLinuxLibraries(relocated);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
