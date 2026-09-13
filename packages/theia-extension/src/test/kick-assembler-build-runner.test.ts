import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';

import type { KickAssemblerBuildProgram } from '@commodore-commander/language-support';
import { createKickAssemblerProgramInvocation } from '../node/kick-assembler-build-runner';

const program: KickAssemblerBuildProgram = {
  name: 'game',
  entryPath: path.resolve('/workspace/src/game.asm'),
  entryUri: 'file:///workspace/src/game.asm',
  dependencyPaths: [],
  dependencyUris: [],
  javaRuntime: '/opt/java',
  javaArgs: ['-Xmx512m'],
  kickAssemblerJar: '/opt/KickAss.jar',
  libraryRootPaths: [],
  outputDirectoryPath: path.resolve('/workspace/out'),
  workingDirectoryPath: path.resolve('/workspace'),
  showMemory: false,
  debug: false,
  viceSymbols: false,
  debugDump: true,
  symbolFile: false,
  assemblerArgs: [],
  generatedAssetPaths: [],
  sidScoreModules: []
};

test('KickAssembler builds without SIDScore modules keep the ordinary jar launch', () => {
  const invocation = createKickAssemblerProgramInvocation(program);
  assert.deepEqual(invocation.args.slice(0, 4), [
    '-Xmx512m', '-jar', '/opt/KickAss.jar', program.entryPath
  ]);
  assert.equal(invocation.cwd, program.workingDirectoryPath);
});

test('SIDScore module builds pass source, placement, and generated ASM path to the plugin', () => {
  const sourcePath = path.resolve('/workspace/music/theme.sidscore');
  const invocation = createKickAssemblerProgramInvocation({
    ...program,
    sidScoreModules: [{ sourcePath, namespace: 'Music', origin: 0x3000 }]
  });

  assert.equal(invocation.command, '/opt/java');
  assert.ok(invocation.args.includes('-Dcc.sidscore.count=1'));
  assert.ok(invocation.args.includes(`-Dcc.sidscore.0.source=${sourcePath}`));
  assert.ok(invocation.args.includes('-Dcc.sidscore.0.namespace=Music'));
  assert.ok(invocation.args.includes('-Dcc.sidscore.0.origin=12288'));
  assert.ok(invocation.args.includes(
    `-Dcc.sidscore.0.generatedAsm=${path.join(program.outputDirectoryPath, 'generated', 'sidscore', 'Music.asm')}`
  ));
  const classpathIndex = invocation.args.indexOf('-cp');
  assert.ok(classpathIndex > 0);
  assert.ok(invocation.args[classpathIndex + 1]?.includes('/opt/KickAss.jar'));
  assert.equal(invocation.args[classpathIndex + 2], 'kickass.KickAssembler');
  assert.deepEqual(invocation.args.slice(classpathIndex + 3, classpathIndex + 5), [
    program.entryPath, '-odir'
  ]);
});
