import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildKickAssemblerFoldingRanges,
  buildKickAssemblerRenamePlan,
  buildKickAssemblerSemanticTokens,
  createTextDocumentModel,
  findKickAssemblerWorkspaceSymbols,
  formatKickAssemblerText,
  KickAssemblerLookupService,
  prepareKickAssemblerRename,
  provideKickAssemblerCompletions,
  provideKickAssemblerQuickFixes,
  type KickAssemblerLookupDocument
} from '../src/index.ts';

const mnemonicReferencePath = fileURLToPath(
  new URL('../reference/6502.xml', import.meta.url)
);

test('provideKickAssemblerCompletions returns directives, includes, symbols, mnemonics, and addressing modes', () => {
  const document = createTextDocumentModel({
    uri: 'file:///project/main.asm',
    text: [
      '#import "l',
      '.b',
      'Draw:',
      '  rts',
      'Entry:',
      '  jsr Dr',
      '  ld',
      '  lda '
    ].join('\n')
  });
  const index = new KickAssemblerLookupService().buildIndex([lookupDocument(document)]);

  const includeCompletions = provideKickAssemblerCompletions(
    document,
    { line: 0, character: '#import "l'.length },
    {
      includePathCandidates: [{
        path: 'lib/shared.asm',
        detail: 'Workspace source'
      }]
    }
  );
  const directiveCompletions = provideKickAssemblerCompletions(
    document,
    { line: 1, character: '.b'.length }
  );
  const symbolCompletions = provideKickAssemblerCompletions(
    document,
    { line: 5, character: '  jsr Dr'.length },
    { index }
  );
  const mnemonicCompletions = provideKickAssemblerCompletions(
    document,
    { line: 6, character: '  ld'.length }
  );
  const addressingModeCompletions = provideKickAssemblerCompletions(
    document,
    { line: 7, character: '  lda '.length }
  );

  assert.equal(includeCompletions[0]?.label, 'lib/shared.asm');
  assert.equal(
    directiveCompletions.some((item) => item.label === '.byte'),
    true
  );
  assert.equal(
    symbolCompletions.some((item) => item.label === 'Draw'),
    true
  );
  assert.equal(
    mnemonicCompletions.some((item) => item.label === 'lda'),
    true
  );
  assert.equal(
    addressingModeCompletions.some((item) => item.insertText === '#$00'),
    true
  );
});

test('statement-start completions exclude labels and variables but keep macro calls', () => {
  const document = createTextDocumentModel({
    uri: 'file:///project/main.asm',
    text: [
      '.var currentRow = 0',
      '.macro Plot(addr) {',
      '}',
      'Draw:',
      '  rts',
      '  Pl',
      '  Dr',
      '  current',
      '  jsr Dr'
    ].join('\n')
  });
  const index = new KickAssemblerLookupService().buildIndex([lookupDocument(document)]);

  const macroCompletions = provideKickAssemblerCompletions(
    document,
    { line: 5, character: '  Pl'.length },
    { index }
  );
  const labelStartCompletions = provideKickAssemblerCompletions(
    document,
    { line: 6, character: '  Dr'.length },
    { index }
  );
  const variableStartCompletions = provideKickAssemblerCompletions(
    document,
    { line: 7, character: '  current'.length },
    { index }
  );
  const operandCompletions = provideKickAssemblerCompletions(
    document,
    { line: 8, character: '  jsr Dr'.length },
    { index }
  );

  assert.equal(
    macroCompletions.some((item) => item.label === 'Plot'),
    true
  );
  assert.equal(
    labelStartCompletions.some((item) => item.label === 'Draw'),
    false
  );
  assert.equal(
    variableStartCompletions.some((item) => item.label === 'currentRow'),
    false
  );
  assert.equal(
    operandCompletions.some((item) => item.label === 'Draw'),
    true
  );
});

test('rename, workspace symbols, semantic tokens, folding, formatting, and quick fixes use shared feature services', () => {
  const document = createTextDocumentModel({
    uri: 'file:///project/main.asm',
    text: [
      '#import lib/shared.asm',
      '.namespace Game {',
      '.const SCREEN=$0400',
      'Draw:',
      '  lda SCREEN',
      'Entry:',
      '  jsr Draw',
      '}'
    ].join('\n')
  });
  const index = new KickAssemblerLookupService().buildIndex([lookupDocument(document)]);
  const drawReference = document.positionAt(document.text.lastIndexOf('Draw'));
  const rename = buildKickAssemblerRenamePlan(
    document,
    drawReference,
    'Render',
    index
  );
  const prepared = prepareKickAssemblerRename(document, drawReference, index);
  const workspaceSymbols = findKickAssemblerWorkspaceSymbols(index, 'Draw');
  const semanticTokens = buildKickAssemblerSemanticTokens(document, index);
  const foldingRanges = buildKickAssemblerFoldingRanges(document);
  const formatted = formatKickAssemblerText(document.text, { finalNewline: false });
  const quickFixes = provideKickAssemblerQuickFixes(
    document,
    {
      start: { line: 0, character: 0 },
      end: { line: 0, character: document.lineAt(0).length }
    }
  );

  assert.equal(prepared?.placeholder, 'Draw');
  assert.equal(rename?.edits.length, 2);
  assert.equal(workspaceSymbols[0]?.name, 'Draw');
  assert.equal(
    semanticTokens.some((token) => token.type === 'label'),
    true
  );
  assert.equal(
    semanticTokens.some((token) => token.type === 'keyword'),
    true
  );
  assert.deepEqual(
    foldingRanges.map((range) => [range.kind, range.startLine, range.endLine]),
    [['region', 1, 7]]
  );
  assert.match(formatted, /\.const SCREEN = \$0400/u);
  assert.equal(quickFixes[0]?.title, 'Quote include path "lib/shared.asm"');
});

test('mnemonic completions use 6502 reference syntax, opcodes, and documentation', async () => {
  const source = createTextDocumentModel({
    uri: 'file:///project/main.asm',
    text: [
      '  ld',
      '  lda ',
      '  bne ',
      '  clc '
    ].join('\n')
  });
  const mnemonicReference = createTextDocumentModel({
    uri: `file://${mnemonicReferencePath}`,
    languageId: 'xml',
    text: await readFile(mnemonicReferencePath, 'utf8')
  });
  const index = new KickAssemblerLookupService().buildIndex([
    lookupDocument(source),
    {
      kind: '6502-reference',
      document: mnemonicReference
    }
  ]);

  const mnemonicCompletions = provideKickAssemblerCompletions(
    source,
    { line: 0, character: '  ld'.length },
    { index }
  );
  const lda = mnemonicCompletions.find((item) => item.label === 'lda');
  assert.match(lda?.detail ?? '', /LoaD Accumulator/u);
  assert.match(lda?.documentation ?? '', /Immediate: LDA #\$44 \(\$A9\)/u);

  const ldaAddressingModes = provideKickAssemblerCompletions(
    source,
    { line: 1, character: '  lda '.length },
    { index }
  );
  const immediate = ldaAddressingModes.find((item) =>
    item.kind === 'addressing-mode' && item.detail?.includes('Immediate')
  );
  assert.equal(immediate?.insertText, '#$00');
  assert.match(immediate?.detail ?? '', /\$A9/u);

  const branchAddressingModes = provideKickAssemblerCompletions(
    source,
    { line: 2, character: '  bne '.length },
    { index }
  );
  assert.deepEqual(
    branchAddressingModes
      .filter((item) => item.kind === 'addressing-mode')
      .map((item) => [item.insertText, item.detail]),
    [['Label', 'Relative - opcode $D0']]
  );

  const impliedAddressingModes = provideKickAssemblerCompletions(
    source,
    { line: 3, character: '  clc '.length },
    { index }
  );
  assert.deepEqual(
    impliedAddressingModes
      .filter((item) => item.kind === 'addressing-mode')
      .map((item) => [item.insertText, item.detail]),
    [['', 'Implied - opcode $18']]
  );
});

function lookupDocument(
  document: ReturnType<typeof createTextDocumentModel>
): KickAssemblerLookupDocument {
  return {
    kind: 'kickassembler',
    document
  };
}
