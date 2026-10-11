import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { DapConnection } from '../dap-connection';
import { ViceDebugSession, type ViceDebugLaunchArguments } from '../vice-debug-session';

function session(embedded = true) {
  const events: Array<{ event: string; body?: Record<string, unknown> }> = [];
  const outputs: Array<{ text: string; category: string }> = [];
  const connection = {
    sendEvent: (event: string, body?: Record<string, unknown>) => events.push({ event, body }),
    sendOutput: (text: string, category: string) => outputs.push({ text, category })
  };
  const instance = new ViceDebugSession(connection as unknown as DapConnection) as unknown as {
    launchArguments: Partial<ViceDebugLaunchArguments>;
    handleViceStdout(chunk: Buffer): void;
  };
  instance.launchArguments = { viceLaunchMode: embedded ? 'embedded' : 'external' };
  return { accept: (chunk: Buffer) => instance.handleViceStdout(chunk), events, outputs };
}

test('embedded stdout preserves DAP log output while discarding JSON/binary frame forwarding', () => {
  const { accept, events, outputs } = session();
  const record = Buffer.from('43434231010120000400000009000000393000000000000001000100070000000a141eff', 'hex');
  record[5] = 2; // Adapter framing deliberately does not validate pixel semantics.
  const hello = 'CCV1 {"type":"hello","protocol":"commodore-vice-embed-v1"}\n';
  const jsonFrame = 'CCV1 {"type":"frame","frameId":1}\n';
  const stream = Buffer.concat([Buffer.from(`log\n${hello}prefix`), record, record, Buffer.from(jsonFrame)]);
  for (const byte of stream) accept(Buffer.from([byte]));
  assert.deepEqual(outputs, [{ text: 'log\n', category: 'stdout' }, { text: 'prefix', category: 'stdout' }]);
  assert.deepEqual(events.map(event => event.body?.type), ['output', 'hello', 'output', 'status']);
  assert.equal(events[3].body?.message, 'Using direct frame transport; DAP frame forwarding is disabled.');
});

test('embedded malformed JSON reports a status error without forwarding it as output', () => {
  const { accept, events, outputs } = session();
  accept(Buffer.from('CCV1 broken JSON\nnext\n'));
  assert.match(String(events[0].body?.message), /^Invalid patched VICE protocol frame:/u);
  assert.deepEqual(outputs, [{ text: 'next\n', category: 'stdout' }]);
  assert.equal(events[1].body?.type, 'output');
});

test('embedded stdout overflow retains the adapter warning and protocol suppression policy', () => {
  const { accept, events, outputs } = session();
  const oversized = Buffer.alloc(32 * 1024 * 1024 + 1, 65);
  accept(oversized);
  assert.deepEqual(outputs, [{ text: 'Dropped oversized VICE embedded stdout buffer.\n', category: 'stderr' }]);
  assert.equal((events[0].body?.text as string).length, oversized.length);
  Buffer.from('CCV1 ').copy(oversized);
  accept(oversized);
  assert.equal(outputs.length, 2);
  assert.equal(events.length, 1);
  accept(Buffer.from('fresh\n'));
  assert.deepEqual(outputs[2], { text: 'fresh\n', category: 'stdout' });
});

test('external stdout is forwarded immediately without embedded framing', () => {
  const { accept, events, outputs } = session(false);
  accept(Buffer.from('CCV1 incomplete'));
  assert.deepEqual(outputs, [{ text: 'CCV1 incomplete', category: 'stdout' }]);
  assert.deepEqual(events, []);
});
