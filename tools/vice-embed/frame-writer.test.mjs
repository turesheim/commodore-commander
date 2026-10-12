import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('actual native frame writer resumes partial sends and drops new frames under backpressure', {
  timeout: 15000
}, async () => {
  const patch = await readFile(new URL('./vice-3.10.0-commodore-embed.patch', import.meta.url), 'utf8');
  const temp = await mkdtemp(path.join(os.tmpdir(), 'cc frame writer-'));
  try {
    // Compile the actual new native files from the patch, without depending on
    // a full SDL/VICE build. The fixture exercises real nonblocking sockets.
    for (const name of ['cc_frame_writer.c', 'cc_frame_writer.h', 'cc_socket.h']) {
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
#ifndef _WIN32
#include <sys/socket.h>
#include <unistd.h>
#endif
static void nonblocking(cc_socket_t socket) {
#ifdef _WIN32
    u_long enabled = 1;
    assert(ioctlsocket(socket, FIONBIO, &enabled) == 0);
#else
    assert(fcntl(socket, F_SETFL, O_NONBLOCK) == 0);
#endif
}
static int would_block(void) {
#ifdef _WIN32
    return WSAGetLastError() == WSAEWOULDBLOCK;
#else
    return errno == EAGAIN || errno == EWOULDBLOCK;
#endif
}
int main(void) {
    cc_socket_t sockets[2];
    int size = 1024, result, loops = 0;
    const size_t length = 512 * 1024;
    size_t received = 0;
    unsigned char header[32] = "CCB1";
    unsigned char *payload = malloc(length);
    unsigned char *actual = malloc(length + sizeof(header));
    cc_frame_writer_t writer = { 0 };
    assert(payload && actual);
#ifdef _WIN32
    WSADATA data;
    struct sockaddr_in address = { 0 };
    int address_length = sizeof(address);
    cc_socket_t listener;
    assert(WSAStartup(MAKEWORD(2, 2), &data) == 0);
    listener = socket(AF_INET, SOCK_STREAM, 0);
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    assert(bind(listener, (struct sockaddr *)&address, sizeof(address)) == 0);
    assert(getsockname(listener, (struct sockaddr *)&address, &address_length) == 0);
    assert(listen(listener, 1) == 0);
    sockets[0] = socket(AF_INET, SOCK_STREAM, 0);
    assert(connect(sockets[0], (struct sockaddr *)&address, sizeof(address)) == 0);
    sockets[1] = accept(listener, NULL, NULL);
    assert(sockets[1] != INVALID_SOCKET);
    closesocket(listener);
#else
    signal(SIGPIPE, SIG_IGN);
    assert(socketpair(AF_UNIX, SOCK_STREAM, 0, sockets) == 0);
#endif
    assert(setsockopt(sockets[0], SOL_SOCKET, SO_SNDBUF, (const char *)&size, sizeof(size)) == 0);
    nonblocking(sockets[0]);
    nonblocking(sockets[1]);
    for (size_t i = 0; i < length; i++) { payload[i] = (unsigned char)(i % 251); }
    result = cc_frame_writer_queue(&writer, sockets[0], header, sizeof(header), payload, length);
    assert(result == 0 && writer.offset > 0 && writer.offset < writer.length);
    // A newer record must not overwrite/interleave the partially sent record.
    assert(cc_frame_writer_queue(&writer, sockets[0], "new", 3, "discard", 7) == 0);
    // The writer owns the queued bytes; the renderer may reuse its pixel buffer.
    memset(payload, 0, length);
    while (received < length + sizeof(header)) {
        int count;
        assert(++loops < 100000);
        count = recv(sockets[1], (char *)actual + received, (int)(length + sizeof(header) - received), 0);
        if (count > 0) { received += (size_t)count; }
        else { assert(count < 0 && (would_block())); }
        assert(cc_frame_writer_flush(&writer, sockets[0]) >= 0);
    }
    assert(writer.data == NULL && writer.length == 0 && writer.offset == 0);
    assert(memcmp(actual, header, sizeof(header)) == 0);
    for (size_t i = 0; i < length; i++) { assert(actual[sizeof(header) + i] == (unsigned char)(i % 251)); }
    assert(recv(sockets[1], (char *)actual, 1, 0) < 0 && (would_block()));
    cc_socket_close(sockets[1]);
    /* A TCP close is asynchronous. Use a closed local handle for fatal error. */
    cc_socket_close(sockets[0]);
    assert(cc_frame_writer_queue(&writer, sockets[0], header, sizeof(header), payload, length) == -1);
    cc_frame_writer_reset(&writer);
    assert(writer.data == NULL && writer.length == 0);
#ifdef _WIN32
    WSACleanup();
#endif
    free(actual);
    free(payload);
    return 0;
}
`);
    const executable = path.join(temp, process.platform === 'win32' ? 'test.exe' : 'test');
    execFileSync(process.platform === 'win32' ? 'gcc' : 'cc', ['-std=c99', '-Wall', '-Wextra', '-Werror', 'cc_frame_writer.c', 'test.c', '-o', executable, ...(process.platform === 'win32' ? ['-lws2_32'] : [])], {
      cwd: temp, timeout: 10000
    });
    execFileSync(executable, [], { timeout: 3000 });
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
