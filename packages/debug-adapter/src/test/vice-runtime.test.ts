import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createViceProcessArgs } from '../vice-runtime';

test('createViceProcessArgs omits binary monitor arguments when monitor is disabled', () => {
  const args = createViceProcessArgs({
    program: '/workspace/out/main.prg',
    viceArgs: ['-config', '/workspace/vice.ini']
  });

  assert.deepEqual(args, [
    '-config',
    '/workspace/vice.ini',
    '/workspace/out/main.prg'
  ]);
  assert.equal(args.includes('-binarymonitor'), false);
  assert.equal(args.includes('-binarymonitoraddress'), false);
  assert.equal(args.includes('-initbreak'), false);
});

test('createViceProcessArgs includes binary monitor arguments for debug launches', () => {
  const args = createViceProcessArgs({
    program: '/workspace/out/main.prg',
    viceArgs: ['-config', '/workspace/vice.ini'],
    monitor: {
      host: '127.0.0.1',
      port: 6502
    }
  });

  assert.deepEqual(args, [
    '-config',
    '/workspace/vice.ini',
    '-binarymonitor',
    '-binarymonitoraddress',
    '127.0.0.1:6502',
    '-initbreak',
    'ready',
    '/workspace/out/main.prg'
  ]);
});
