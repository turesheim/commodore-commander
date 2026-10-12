import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('embedded native errors report to stderr without entering a hidden modal dialog', { timeout: 15000 }, async () => {
  const patch = await readFile(new URL('./vice-3.10.0-commodore-embed.patch', import.meta.url), 'utf8').then(text => text.replace(/\r\n/g, '\n'));
  const start = patch.indexOf(' void ui_error(const char *format, ...)');
  const end = patch.indexOf('\n }\n', start) + 4;
  assert.ok(start >= 0 && end > start);
  const fn = patch.slice(start, end).split('\n').filter(line => line.startsWith(' ') || line.startsWith('+') || line === '')
    .map(line => line ? line.slice(1) : '').join('\n');
  const temp = await mkdtemp(path.join(os.tmpdir(), 'cc native error-'));
  try {
    await writeFile(path.join(temp, 'test.c'), `
#include <assert.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
static int embedded, modal_calls, sdl_ui_ready = 1;
#define MESSAGE_OK 0
static int cc_embed_is_enabled(void) { return embedded; }
static void message_box(const char *title, const char *text, int kind) {
    (void)title; (void)text; (void)kind; modal_calls++;
}
static char *lib_mvsprintf(const char *format, va_list args) {
    char *buffer = malloc(1024);
    assert(buffer);
    vsnprintf(buffer, 1024, format, args);
    return buffer;
}
#define lib_free free
${fn}
int main(void) {
    embedded = 1;
    ui_error("Unavailable %s device", "waveout");
    assert(modal_calls == 0);
    embedded = 0;
    ui_error("Visible external dialog");
    assert(modal_calls == 1);
    sdl_ui_ready = 0;
    ui_error("Before SDL readiness");
    assert(modal_calls == 1);
    return 0;
}
`);
    const executable = path.join(temp, process.platform === 'win32' ? 'test.exe' : 'test');
    execFileSync(process.platform === 'win32' ? 'gcc' : 'cc', ['-Wall', '-Wextra', '-Werror', 'test.c', '-o', executable], { cwd: temp, timeout: 10000 });
    const output = spawnSync(executable, [], { encoding: 'utf8', timeout: 3000 });
    assert.equal(output.status, 0);
    assert.equal(output.stdout, '');
    assert.match(output.stderr, /Unavailable waveout device/);
    assert.match(output.stderr, /Before SDL readiness/);
    assert.doesNotMatch(output.stderr, /Visible external dialog/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});
