import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('native command reader polls without blocking and reads fragmented Node pipe input', { timeout: 15000 }, async () => {
  const patch = await readFile(new URL('./vice-3.10.0-commodore-embed.patch', import.meta.url), 'utf8');
  const temp = await mkdtemp(path.join(os.tmpdir(), 'cc command reader-'));
  let child;
  try {
    for (const name of ['cc_command_reader.c', 'cc_command_reader.h']) {
      const start = patch.indexOf(`diff --git a/src/arch/sdl/${name} `);
      const next = patch.indexOf('diff --git ', start + 1);
      assert.ok(start >= 0);
      const source = patch.slice(start, next < 0 ? undefined : next).split('\n')
        .filter(line => line.startsWith('+') && !line.startsWith('+++')).map(line => line.slice(1)).join('\n');
      await writeFile(path.join(temp, name), source + '\n');
    }
    await writeFile(path.join(temp, 'test.c'), `
#include "cc_command_reader.h"
#include <stdio.h>
#ifdef _WIN32
#include <windows.h>
#include <fcntl.h>
#include <io.h>
#else
#include <fcntl.h>
#include <unistd.h>
#endif
int main(void) {
    char buffer[2];
    int count, total = 0, polls = 0;
#ifndef _WIN32
    fcntl(0, F_SETFL, O_NONBLOCK);
#endif
#ifdef _WIN32
    _setmode(_fileno(stdout), _O_BINARY);
#endif
    setvbuf(stdout, NULL, _IONBF, 0);
    if (cc_command_read(0, buffer, sizeof(buffer)) != 0) { return 1; }
    puts("poll-ready");
    while (total < 5 && polls++ < 5000) {
        count = cc_command_read(0, buffer, sizeof(buffer));
        if (count < 0) { return 2; }
        if (count) { fwrite(buffer, 1, count, stdout); total += count; }
#ifdef _WIN32
        Sleep(1);
#else
        usleep(1000);
#endif
    }
    return total == 5 ? 0 : 3;
}
`);
    const executable = path.join(temp, process.platform === 'win32' ? 'test.exe' : 'test');
    execFileSync(process.platform === 'win32' ? 'gcc' : 'cc', ['-Wall', '-Wextra', '-Werror', 'cc_command_reader.c', 'test.c', '-o', executable], { cwd: temp, timeout: 10000 });
    child = spawn(executable, [], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let output = '';
    let errors = '';
    child.stderr.on('data', chunk => { errors += chunk; });
    const ready = new Promise(resolve => child.stdout.once('data', resolve));
    child.stdout.on('data', chunk => { output += chunk; });
    const ended = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    await ready;
    assert.equal(output, 'poll-ready\n');
    child.stdin.write('CC');
    await new Promise(resolve => setTimeout(resolve, 25));
    child.stdin.end('V1\n');
    assert.equal(await ended, 0, errors);
    assert.ok(output.endsWith('CCV1\n'));
  } finally {
    if (child?.exitCode === null) { child.kill('SIGKILL'); }
    await rm(temp, { recursive: true, force: true });
  }
});
