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

test('createLookupHoverContent formats Kick Assembler directive descriptions for tooltips', () => {
  const sourceDocument = createTextDocumentModel({
    uri: 'file:///project/main.asm',
    text: '.byte 1\n'
  });
  const lookupService = new KickAssemblerLookupService();
  const index = lookupService.buildIndex([
    {
      kind: 'kickassembler',
      document: sourceDocument
    }
  ]);
  const lookup = lookupService.lookupAtPosition(
    sourceDocument,
    sourceDocument.positionAt(sourceDocument.text.indexOf('.byte')),
    index
  );

  assert.ok(lookup);

  const hover = createLookupHoverContent(lookup);

  assert.ok(hover);
  assert.equal(hover.supportHtml, true);
  assert.match(hover.value, /<h3><code>\.byte &lt;value&gt;\[, \.\.\.\]<\/code><\/h3>/u);
  assert.match(hover.value, /<p>Outputs one or more byte values directly into memory\./u);
  assert.doesNotMatch(hover.value, /<pre>/u);
  assert.equal(
    hover.value,
    '<h3><code>.byte &lt;value&gt;[, ...]</code></h3>\n\n<p>Outputs one or more byte values directly into memory. The guide groups this with .word, .dword, and .text as the standard data directives used to generate literal data in the assembled output.</p>'
  );
});

test('createLookupHoverContent formats Kick Assembler preprocessor descriptions for tooltips', () => {
  const sourceDocument = createTextDocumentModel({
    uri: 'file:///project/main.asm',
    text: '#import "lib.asm"\n'
  });
  const lookupService = new KickAssemblerLookupService();
  const index = lookupService.buildIndex([
    {
      kind: 'kickassembler',
      document: sourceDocument
    }
  ]);
  const lookup = lookupService.lookupAtPosition(
    sourceDocument,
    sourceDocument.positionAt(sourceDocument.text.indexOf('#import')),
    index
  );

  assert.ok(lookup);

  const hover = createLookupHoverContent(lookup);

  assert.ok(hover);
  assert.equal(hover.supportHtml, true);
  assert.match(hover.value, /<h3><code>#import &lt;filename&gt;<\/code><\/h3>/u);
  assert.match(hover.value, /<p>Imports another source file at the current point/u);
  assert.doesNotMatch(hover.value, /<pre>/u);
  assert.equal(
    hover.value,
    '<h3><code>#import &lt;filename&gt;</code></h3>\n\n<p>Imports another source file at the current point before main parsing. The guide recommends this for libraries because it preserves a natural evaluation order and can search directories supplied with -libdir.</p>'
  );
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
