import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createTextDocumentModel } from '../src/document/text-document-model.ts';
import { buildKickAssemblerOutline } from '../src/outline/kick-assembler-outline-model.ts';

test('buildKickAssemblerOutline groups symbols under active segments and nested blocks', () => {
  const document = createTextDocumentModel({
    uri: 'file:///outline.asm',
    text: [
      '#import "library/macros.asm"',
      '.segment Code "Main code"',
      '.const MODE = $01',
      'EntryPoint:',
      '.namespace Utilities {',
      'Helper:',
      '}',
      '.macro LOAD_SCREEN(index) {',
      'Loop:',
      '}',
      '.segment Data "Data area"',
      'SpriteData:',
      ''
    ].join('\n')
  });

  const outline = buildKickAssemblerOutline(document);

  assert.deepEqual(
    outline.map((symbol) => symbol.name),
    ['library/macros.asm', 'Code', 'Data']
  );
  assert.equal(outline[0]?.kind, 'import');
  assert.equal(outline[1]?.kind, 'segment');
  assert.equal(outline[2]?.kind, 'segment');

  assert.deepEqual(
    outline[1]?.children.map((symbol) => symbol.name),
    ['MODE', 'EntryPoint', 'Utilities', 'LOAD_SCREEN']
  );
  assert.equal(outline[1]?.children[2]?.kind, 'namespace');
  assert.deepEqual(
    outline[1]?.children[2]?.children.map((symbol) => symbol.name),
    ['Helper']
  );
  assert.equal(outline[1]?.children[3]?.kind, 'macro');
  assert.deepEqual(
    outline[1]?.children[3]?.children.map((symbol) => symbol.name),
    ['Loop']
  );
  assert.deepEqual(
    outline[2]?.children.map((symbol) => symbol.name),
    ['SpriteData']
  );
});

test('buildKickAssemblerOutline derives program counter and import labels from line parts', () => {
  const document = createTextDocumentModel({
    uri: 'file:///pc.asm',
    text: [
      '#importif FEATURE_ENABLED "lib/conditional.asm"',
      '.pc = $0801 "Basic Upstart" {',
      'start:',
      '}',
      ''
    ].join('\n')
  });

  const outline = buildKickAssemblerOutline(document);

  assert.deepEqual(
    outline.map((symbol) => symbol.name),
    ['lib/conditional.asm', 'Basic Upstart']
  );
  assert.equal(outline[1]?.kind, 'program-counter');
  assert.deepEqual(
    outline[1]?.children.map((symbol) => symbol.name),
    ['start']
  );
});

test('buildKickAssemblerOutline includes local bang labels and preserves label selection ranges', () => {
  const document = createTextDocumentModel({
    uri: 'file:///labels.asm',
    text: [
      'start:',
      '    !local:',
      '!:',
      'next: .byte 1',
      ''
    ].join('\n')
  });

  const outline = buildKickAssemblerOutline(document);

  assert.deepEqual(
    outline.map((symbol) => symbol.name),
    ['start', '!local', '!', 'next']
  );
  assert.deepEqual(outline.map((symbol) => symbol.kind), [
    'label',
    'label',
    'label',
    'label'
  ]);
  assert.deepEqual(outline[0]?.selectionRange, {
    start: { line: 0, character: 0 },
    end: { line: 0, character: 5 }
  });
  assert.deepEqual(outline[1]?.selectionRange, {
    start: { line: 1, character: 4 },
    end: { line: 1, character: 10 }
  });
  assert.deepEqual(outline[2]?.selectionRange, {
    start: { line: 2, character: 0 },
    end: { line: 2, character: 1 }
  });
  assert.deepEqual(outline[3]?.selectionRange, {
    start: { line: 3, character: 0 },
    end: { line: 3, character: 4 }
  });
});

test('buildKickAssemblerOutline ignores multiline and standalone line comments', () => {
  const document = createTextDocumentModel({
    uri: 'file:///comments.asm',
    text: [
      '/*',
      '    Bouncing ball demo',
      '',
      '    Written by:',
      '    - Øystein Steimler',
      '*/',
      '',
      '// Include .prg file assembly segments',
      '.file [name="demo.prg", segments="Code"]',
      '.segment Code "Main"',
      'start:',
      ''
    ].join('\n')
  });

  const outline = buildKickAssemblerOutline(document);

  assert.deepEqual(
    outline.map((symbol) => symbol.name),
    ['Code']
  );
  assert.equal(outline[0]?.kind, 'segment');
  assert.deepEqual(
    outline[0]?.children.map((symbol) => symbol.name),
    ['start']
  );
});
