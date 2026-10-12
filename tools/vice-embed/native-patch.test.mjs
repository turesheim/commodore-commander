import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('macOS launcher include patch applies with the platform patch tool', {
  skip: process.platform === 'win32'
}, async () => {
  const patch = await readFile(new URL('./vice-3.10.0-commodore-embed.patch', import.meta.url), 'utf8');
  const start = patch.indexOf('diff --git a/src/arch/shared/macOS-launcher.c');
  const end = patch.indexOf('diff --git ', start + 1);
  assert.ok(start >= 0 && end > start);
  const temp = await mkdtemp(path.join(os.tmpdir(), 'cc-native-patch-'));
  const fixture = path.join(temp, 'src', 'arch', 'shared', 'macOS-launcher.c');
  try {
    await mkdir(path.dirname(fixture), { recursive: true });
    await writeFile(fixture, '\n'.repeat(23) +
      '#include <stdio.h>\n#include <stdlib.h>\n#include <unistd.h>\n#include <libgen.h>\n#include <limits.h>\n\nint main(int argc, char *argv[])\n{\n    return 0;\n}\n');
    execFileSync('patch', ['-p1', '--forward'], { cwd: temp, input: patch.slice(start, end) });
    const actual = await readFile(fixture, 'utf8');
    assert.ok(actual.includes('#include <mach-o/dyld.h>\n\nint main(int argc, char *argv[])\n{\n    return 0;\n}'));
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('native error-dialog hunk applies with balanced context', async () => {
  const patch = (await readFile(new URL('./vice-3.10.0-commodore-embed.patch', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  const start = patch.indexOf('@@ -892,19 +897,19 @@');
  const end = patch.indexOf('diff --git ', start);
  assert.ok(start >= 0 && end > start);
  const chunk = patch.slice(start, end);
  const original = chunk.split('\n').filter(line => line.startsWith(' ') || line.startsWith('-') || line === '')
    .map(line => line ? line.slice(1) : '').join('\n');
  const temp = await mkdtemp(path.join(os.tmpdir(), 'cc native error patch-'));
  const fixture = path.join(temp, 'src', 'arch', 'sdl', 'ui.c');
  try {
    await mkdir(path.dirname(fixture), { recursive: true });
    await writeFile(fixture, '\n'.repeat(891) + original + '\n{\n    return NULL;\n}\n');
    execFileSync('patch', ['-p1', '--forward'], {
      cwd: temp,
      input: '--- a/src/arch/sdl/ui.c\n+++ b/src/arch/sdl/ui.c\n' + chunk
    });
    assert.ok((await readFile(fixture, 'utf8')).includes('sdl_ui_ready && !cc_embed_is_enabled()'));
  } finally { await rm(temp, { recursive: true, force: true }); }
});
