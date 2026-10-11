import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('actual native frame writer resumes partial sends and drops new frames under backpressure', {
  skip: process.platform === 'win32', timeout: 15000
}, async () => {
  const patch = await readFile(new URL('./vice-3.10.0-commodore-embed.patch', import.meta.url), 'utf8');
  const temp = await mkdtemp(path.join(os.tmpdir(), 'cc frame writer-'));
  try {
    // Compile the actual new native files from the patch, without depending on
    // a full SDL/VICE build. The fixture exercises real nonblocking sockets.
    for (const name of ['cc_frame_writer.c', 'cc_frame_writer.h']) {
      const start = patch.indexOf(`diff --git a/src/arch/sdl/${name} `);
      const next = patch.indexOf('diff --git ', start + 1);
      assert.ok(start >= 0);
      const chunk = patch.slice(start, next < 0 ? undefined : next);
      const source = chunk.split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++'))
        .map(line => line.slice(1)).join('\n') + '\n';
      await writeFile(path.join(temp, name), source);
    }
    await writeFile(path.join(temp, 'test.c'), `
#include "cc_frame_writer.h"
#include <assert.h>
#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>
int main(void) {
    int sockets[2], size = 1024, result, loops = 0;
    const size_t length = 512 * 1024;
    size_t received = 0;
    unsigned char header[32] = "CCB1";
    unsigned char *payload = malloc(length);
    unsigned char *actual = malloc(length + sizeof(header));
    cc_frame_writer_t writer = { 0 };
    assert(payload && actual);
    signal(SIGPIPE, SIG_IGN);
    assert(socketpair(AF_UNIX, SOCK_STREAM, 0, sockets) == 0);
    assert(setsockopt(sockets[0], SOL_SOCKET, SO_SNDBUF, &size, sizeof(size)) == 0);
    assert(fcntl(sockets[0], F_SETFL, O_NONBLOCK) == 0);
    assert(fcntl(sockets[1], F_SETFL, O_NONBLOCK) == 0);
    for (size_t i = 0; i < length; i++) { payload[i] = (unsigned char)(i % 251); }
    result = cc_frame_writer_queue(&writer, sockets[0], header, sizeof(header), payload, length);
    assert(result == 0 && writer.offset > 0 && writer.offset < writer.length);
    // A newer record must not overwrite/interleave the partially sent record.
    assert(cc_frame_writer_queue(&writer, sockets[0], "new", 3, "discard", 7) == 0);
    // The writer owns the queued bytes; the renderer may reuse its pixel buffer.
    memset(payload, 0, length);
    while (received < length + sizeof(header)) {
        ssize_t count;
        assert(++loops < 100000);
        count = recv(sockets[1], actual + received, length + sizeof(header) - received, 0);
        if (count > 0) { received += (size_t)count; }
        else { assert(count < 0 && (errno == EAGAIN || errno == EWOULDBLOCK)); }
        assert(cc_frame_writer_flush(&writer, sockets[0]) >= 0);
    }
    assert(writer.data == NULL && writer.length == 0 && writer.offset == 0);
    assert(memcmp(actual, header, sizeof(header)) == 0);
    for (size_t i = 0; i < length; i++) { assert(actual[sizeof(header) + i] == (unsigned char)(i % 251)); }
    assert(recv(sockets[1], actual, 1, 0) < 0 && (errno == EAGAIN || errno == EWOULDBLOCK));
    close(sockets[1]);
    assert(cc_frame_writer_queue(&writer, sockets[0], header, sizeof(header), payload, length) == -1);
    cc_frame_writer_reset(&writer);
    assert(writer.data == NULL && writer.length == 0);
    close(sockets[0]);
    free(actual);
    free(payload);
    return 0;
}
`);
    const executable = path.join(temp, 'test');
    execFileSync('cc', ['-std=c99', '-Wall', '-Wextra', '-Werror', 'cc_frame_writer.c', 'test.c', '-o', executable], {
      cwd: temp, timeout: 10000
    });
    execFileSync(executable, [], { timeout: 3000 });
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
