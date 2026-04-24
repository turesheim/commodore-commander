import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
  createLookupHoverContent,
  createTextDocumentModel,
  KickAssemblerLookupService,
  type KickAssemblerLookupDocument
} from '../src/runtime/index.ts';

const mnemonicReferencePath = fileURLToPath(
  new URL('../reference/6502.xml', import.meta.url)
);
const c64IoReferencePath = fileURLToPath(
  new URL('../reference/c64/c64io.xml', import.meta.url)
);

test('createLookupHoverContent formats mnemonic reference descriptions for tooltips', async () => {
  const sourceDocument = createTextDocumentModel({
    uri: 'file:///project/main.asm',
    text: '  asl value\nvalue:\n  .byte 1\n'
  });
  const lookupService = new KickAssemblerLookupService();
  const index = lookupService.buildIndex([
    {
      kind: 'kickassembler',
      document: sourceDocument
    },
    ...(await loadReferenceDocuments())
  ]);
  const lookup = lookupService.lookupAtPosition(
    sourceDocument,
    sourceDocument.positionAt(sourceDocument.text.indexOf('asl')),
    index
  );

  assert.ok(lookup);

  const hover = createLookupHoverContent(lookup);

  assert.ok(hover);
  assert.equal(hover.supportHtml, true);
  assert.match(hover.value, /ASL/u);
  assert.match(hover.value, /Arithmetic Shift Left/u);
  assert.match(hover.value, /<pre>/u);
  assert.match(hover.value, /<svg/u);
});

test('createLookupHoverContent formats C64 I/O reference descriptions for tooltips', async () => {
  const sourceDocument = createTextDocumentModel({
    uri: 'file:///project/main.asm',
    text: '  lda SPENA\n'
  });
  const lookupService = new KickAssemblerLookupService();
  const index = lookupService.buildIndex([
    {
      kind: 'kickassembler',
      document: sourceDocument
    },
    ...(await loadReferenceDocuments())
  ]);
  const lookup = lookupService.lookupAtPosition(
    sourceDocument,
    sourceDocument.positionAt(sourceDocument.text.indexOf('SPENA')),
    index
  );

  assert.ok(lookup);

  const hover = createLookupHoverContent(lookup);

  assert.ok(hover);
  assert.equal(hover.supportHtml, true);
  assert.match(hover.value, /\$D015/u);
  assert.match(hover.value, /Sprite display Enable/u);
  assert.match(hover.value, /<table>/u);
});

async function loadReferenceDocuments(): Promise<KickAssemblerLookupDocument[]> {
  const [mnemonicXml, c64IoXml] = await Promise.all([
    readFile(mnemonicReferencePath, 'utf8'),
    readFile(c64IoReferencePath, 'utf8')
  ]);

  return [
    {
      kind: '6502-reference',
      document: createTextDocumentModel({
        uri: `file://${mnemonicReferencePath}`,
        text: mnemonicXml,
        languageId: 'xml'
      })
    },
    {
      kind: 'c64io-reference',
      document: createTextDocumentModel({
        uri: `file://${c64IoReferencePath}`,
        text: c64IoXml,
        languageId: 'xml'
      })
    }
  ];
}
