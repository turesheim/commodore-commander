import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
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

test('KickAssemblerLookupService prefers project declarations over mnemonic references', async () => {
  const sourceDocument = createTextDocumentModel({
    uri: 'file:///project/shadowing.asm',
    text: [
      'ADC:',
      '  rts',
      '',
      'main:',
      '  jsr ADC'
    ].join('\n')
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
    sourceDocument.positionAt(sourceDocument.text.lastIndexOf('ADC')),
    index
  );

  assert.ok(lookup);
  assert.equal(lookup.queryOrigin, 'project');
  assert.equal(lookup.declarations.length, 1);
  assert.equal(lookup.declarations[0]?.location.uri, sourceDocument.uri);
});

test('KickAssemblerLookupService resolves 6502 mnemonic and C64 I/O reference symbols', async () => {
  const sourceDocument = createTextDocumentModel({
    uri: 'file:///project/main.asm',
    text: [
      'main:',
      '  lda $d020',
      '  sta $d021',
      '  lda SP0X',
      '  adc value',
      '',
      'value:',
      '  .byte 1'
    ].join('\n')
  });
  const lookupService = new KickAssemblerLookupService();
  const index = lookupService.buildIndex([
    {
      kind: 'kickassembler',
      document: sourceDocument
    },
    ...(await loadReferenceDocuments())
  ]);
  const mnemonicLookup = lookupService.lookupAtPosition(
    sourceDocument,
    sourceDocument.positionAt(sourceDocument.text.indexOf('lda $d020')),
    index
  );
  const addressLookup = lookupService.lookupAtPosition(
    sourceDocument,
    sourceDocument.positionAt(sourceDocument.text.indexOf('$d020') + 1),
    index
  );
  const registerLookup = lookupService.lookupAtPosition(
    sourceDocument,
    sourceDocument.positionAt(sourceDocument.text.indexOf('SP0X')),
    index
  );

  assert.ok(mnemonicLookup);
  assert.equal(mnemonicLookup.queryOrigin, 'reference');
  assert.equal(
    mnemonicLookup.declarations.some((occurrence) => (
      occurrence.kind === '6502-mnemonic' &&
      occurrence.location.uri.endsWith('/reference/6502.xml')
    )),
    true
  );
  assert.equal(mnemonicLookup.references.length, 2);

  assert.ok(addressLookup);
  assert.equal(addressLookup.queryOrigin, 'reference');
  assert.equal(addressLookup.declarations[0]?.kind, 'c64-io-address');
  assert.equal(
    addressLookup.declarations[0]?.location.uri.endsWith('/reference/c64/c64io.xml'),
    true
  );
  assert.equal(addressLookup.references.length, 1);

  assert.ok(registerLookup);
  assert.equal(registerLookup.queryOrigin, 'reference');
  assert.equal(registerLookup.declarations[0]?.kind, 'c64-io-id');
  assert.equal(registerLookup.references.length, 1);
});

test('KickAssemblerLookupService resolves directive and preprocessor keyword references', () => {
  const sourceDocument = createTextDocumentModel({
    uri: 'file:///project/main.asm',
    text: [
      '#import "lib.asm"',
      '.byte 1',
      '.printnow "ready"',
      '  lda #$d020'
    ].join('\n')
  });
  const lookupService = new KickAssemblerLookupService();
  const index = lookupService.buildIndex([
    {
      kind: 'kickassembler',
      document: sourceDocument
    }
  ]);

  const importLookup = lookupService.lookupAtPosition(
    sourceDocument,
    sourceDocument.positionAt(sourceDocument.text.indexOf('#import')),
    index
  );
  const byteLookup = lookupService.lookupAtPosition(
    sourceDocument,
    sourceDocument.positionAt(sourceDocument.text.indexOf('.byte')),
    index
  );
  const printNowLookup = lookupService.lookupAtPosition(
    sourceDocument,
    sourceDocument.positionAt(sourceDocument.text.indexOf('.printnow')),
    index
  );
  const immediateAddressLookup = lookupService.lookupAtPosition(
    sourceDocument,
    sourceDocument.positionAt(sourceDocument.text.indexOf('$d020') + 1),
    index
  );

  assert.ok(importLookup);
  assert.equal(importLookup.queryName, '#IMPORT');
  assert.equal(
    importLookup.declarations[0]?.kind,
    'kickassembler-preprocessor-directive'
  );
  assert.equal(importLookup.references.length, 1);

  assert.ok(byteLookup);
  assert.equal(byteLookup.declarations[0]?.kind, 'kickassembler-directive');
  assert.equal(byteLookup.declarations[0]?.syntax, '<value>[, ...]');
  assert.match(byteLookup.declarations[0]?.description ?? '', /byte values/u);
  assert.equal(byteLookup.references.length, 1);

  assert.ok(printNowLookup);
  assert.equal(printNowLookup.declarations[0]?.kind, 'kickassembler-directive');
  assert.match(printNowLookup.declarations[0]?.description ?? '', /immediately/u);

  assert.ok(immediateAddressLookup);
  assert.notEqual(
    immediateAddressLookup.declarations[0]?.kind,
    'kickassembler-preprocessor-directive'
  );
});

test('KickAssemblerLookupService filters reference symbols by machine profile', async () => {
  const sourceDocument = createTextDocumentModel({
    uri: 'file:///project/machine.asm',
    text: [
      'main:',
      '  lda SP0X',
      '  lda $9000',
      '  jsr BASIC35_COLD_START'
    ].join('\n')
  });
  const lookupService = new KickAssemblerLookupService();
  const c64Index = lookupService.buildIndex(
    [
      {
        kind: 'kickassembler',
        document: sourceDocument
      },
      ...(await loadReferenceDocuments())
    ],
    { machineProfileId: 'c64' }
  );
  const vic20Index = lookupService.buildIndex(
    [
      {
        kind: 'kickassembler',
        document: sourceDocument
      },
      ...(await loadReferenceDocuments())
    ],
    { machineProfileId: 'vic20' }
  );
  const plus4Index = lookupService.buildIndex(
    [
      {
        kind: 'kickassembler',
        document: sourceDocument
      },
      ...(await loadReferenceDocuments())
    ],
    { machineProfileId: 'plus4' }
  );

  const c64SpriteLookup = lookupService.lookupAtPosition(
    sourceDocument,
    sourceDocument.positionAt(sourceDocument.text.indexOf('SP0X')),
    c64Index
  );
  const vic20C64SpriteLookup = lookupService.lookupAtPosition(
    sourceDocument,
    sourceDocument.positionAt(sourceDocument.text.indexOf('SP0X')),
    vic20Index
  );
  const vic20IoLookup = lookupService.lookupAtPosition(
    sourceDocument,
    sourceDocument.positionAt(sourceDocument.text.indexOf('$9000') + 1),
    vic20Index
  );
  const c64TedLookup = lookupService.lookupAtPosition(
    sourceDocument,
    sourceDocument.positionAt(sourceDocument.text.indexOf('BASIC35_COLD_START')),
    c64Index
  );
  const plus4TedLookup = lookupService.lookupAtPosition(
    sourceDocument,
    sourceDocument.positionAt(sourceDocument.text.indexOf('BASIC35_COLD_START')),
    plus4Index
  );

  assert.ok(c64SpriteLookup);
  assert.equal(
    c64SpriteLookup.declarations.some((occurrence) =>
      occurrence.kind === 'c64-io-id'
    ),
    true
  );
  assert.equal(vic20C64SpriteLookup, undefined);

  assert.ok(vic20IoLookup);
  assert.equal(vic20IoLookup.queryOrigin, 'reference');
  assert.equal(vic20IoLookup.declarations[0]?.kind, 'machine-io-address');
  assert.equal(vic20IoLookup.declarations[0]?.machineProfileId, 'vic20');

  assert.equal(c64TedLookup, undefined);
  assert.ok(plus4TedLookup);
  assert.equal(plus4TedLookup.declarations[0]?.kind, 'machine-rom-symbol');
  assert.equal(plus4TedLookup.declarations[0]?.machineProfileId, 'plus4');
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
