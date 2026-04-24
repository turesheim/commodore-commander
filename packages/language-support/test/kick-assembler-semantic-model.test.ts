import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createTextDocumentModel,
  parseKickAssemblerExpression,
  parseKickAssemblerSemanticModel
} from '../src/index.ts';

test('parseKickAssemblerExpression builds operator, call, member, and index nodes', () => {
  const result = parseKickAssemblerExpression('screen.base($d020 + table[i])');

  assert.equal(result.diagnostics.length, 0);
  assert.equal(result.expression?.kind, 'call');

  const call = result.expression;
  assert.equal(call?.kind, 'call');
  if (call?.kind !== 'call') {
    return;
  }
  assert.equal(call.callee.kind, 'member');
  assert.equal(call.args[0]?.kind, 'binary');
});

test('parseKickAssemblerSemanticModel extracts scopes, imports, conditionals, and generated symbols', () => {
  const document = createTextDocumentModel({
    uri: 'file:///semantic.asm',
    text: [
      '#importonce',
      '#import "lib/shared.asm"',
      '#importif FEATURE_ENABLED "lib/conditional.asm"',
      '.segmentdef Code [start=$0801]',
      '.segment Code "Main" {',
      '.namespace Game {',
      '.const SCREEN = $0400',
      'Start:',
      '    !loop:',
      '    lda #<SCREEN',
      '.macro Poke(addr, value=$00) {',
      'GeneratedLabel:',
      '.for (var i=0; i<4; i++) {',
      'LoopLabel:',
      '}',
      '}',
      '.pseudocommand mov src:dst {',
      'MoveGenerated:',
      '}',
      '.struct Sprite {',
      'x: .byte $00',
      'y: .byte %00000001',
      '}',
      '.enum Mode {',
      'Idle = 0',
      'Run',
      '}',
      '.if (SCREEN == $0400) {',
      '.label ActiveScreen = SCREEN',
      '} else {',
      '.label InactiveScreen = $0000',
      '}',
      '}',
      '}',
      ''
    ].join('\n')
  });

  const model = parseKickAssemblerSemanticModel(document);
  const symbol = (name: string) =>
    model.symbols.find((candidate) => candidate.name === name);

  assert.equal(model.importOnce, true);
  assert.deepEqual(
    model.imports.map((entry) => entry.kind),
    ['importonce', 'import', 'importif']
  );
  assert.equal(model.imports[2]?.condition?.kind, 'identifier');
  assert.equal(symbol('Game')?.kind, 'namespace');
  assert.equal(symbol('Poke')?.kind, 'macro');
  assert.equal(symbol('mov')?.kind, 'pseudocommand');
  assert.equal(symbol('Sprite')?.kind, 'struct');
  assert.equal(symbol('Mode')?.kind, 'enum');
  assert.equal(symbol('Idle')?.kind, 'enum-member');
  assert.equal(symbol('Run')?.kind, 'enum-member');
  assert.equal(symbol('!loop')?.kind, 'local-label');
  assert.equal(symbol('GeneratedLabel')?.generated, true);
  assert.equal(symbol('LoopLabel')?.kind, 'label');
  assert.equal(symbol('i')?.kind, 'for-variable');
  assert.equal(model.conditionals.length, 2);
  assert.equal(model.segments[0]?.kind, 'definition');
  assert.equal(model.segments[1]?.kind, 'selection');
  assert.equal(symbol('x')?.data?.byteLength, 1);
  assert.equal(symbol('y')?.data?.presentation, 'binary');
  assert.equal(symbol('SCREEN')?.value?.kind, 'literal');
});
