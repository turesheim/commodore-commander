import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createTextDocumentModel,
  KickAssemblerLookupService,
  type KickAssemblerLookupDocument,
  type TextDocumentModel,
  type ReferenceDocumentKind
} from '../src/runtime/index.ts';

class CountingLookupService extends KickAssemblerLookupService {
  readonly projectCalls: string[] = [];
  readonly referenceCalls: string[] = [];

  protected override analyzeProjectDocument(document: TextDocumentModel) {
    this.projectCalls.push(document.uri);
    return super.analyzeProjectDocument(document);
  }

  protected override analyzeReferenceDocument(kind: ReferenceDocumentKind, document: TextDocumentModel) {
    this.referenceCalls.push(`${kind}:${document.uri}`);
    return super.analyzeReferenceDocument(kind, document);
  }
}

function input(kind: KickAssemblerLookupDocument['kind'], uri: string, text: string, version = 1): KickAssemblerLookupDocument {
  return { kind, document: createTextDocumentModel({ uri, text, version }) };
}

const source = () => input('kickassembler', 'file:///main.asm', 'TARGET:\n  lda TARGET\n');
const mnemonics = () => input('6502-reference', 'file:///6502.xml', '<mnemonics><mnemonic id="LDA" name="Load A"/></mnemonics>');
const io = () => input('c64io-reference', 'file:///c64io.xml', '<iomap><entry address="$d020" id="BORDER" name="Border"/></iomap>');

test('lookup reuses project/token and XML analysis across equivalent document instances and versions', () => {
  const service = new CountingLookupService();
  service.buildIndex([source(), mnemonics()]);
  const current = [source(), mnemonics()];
  current[0]!.document = createTextDocumentModel({ uri: 'file:///main.asm', text: source().document.text, version: 12 });
  const index = service.buildIndex(current);
  assert.equal(service.projectCalls.length, 1);
  assert.equal(service.referenceCalls.length, 1);
  assert.deepEqual(index, new KickAssemblerLookupService().buildIndex(current));
});

test('changed overlay text invalidates only its document and refreshes cross-document reference kinds', () => {
  const service = new CountingLookupService();
  const declaration = input('kickassembler', 'file:///symbols.asm', '.const TARGET = 1\n');
  const usage = input('kickassembler', 'file:///main.asm', 'lda TARGET\n');
  service.buildIndex([declaration, usage, mnemonics()]);
  const overlay = input('kickassembler', declaration.document.uri, 'TARGET:\n rts\n');
  const current = [overlay, usage, mnemonics()];
  const index = service.buildIndex(current);
  assert.equal(service.projectCalls.filter(uri => uri === usage.document.uri).length, 1);
  assert.equal(service.projectCalls.filter(uri => uri === declaration.document.uri).length, 2);
  assert.equal(service.referenceCalls.length, 1);
  assert.equal(index.projectReferencesByName.get('TARGET')?.[0]?.kind, 'label');
  assert.deepEqual(index, new KickAssemblerLookupService().buildIndex(current));
  const reverted = service.buildIndex([declaration, usage, mnemonics()]);
  assert.equal(reverted.projectReferencesByName.get('TARGET')?.[0]?.kind, 'constant');
  assert.equal(service.projectCalls.length, 4);
});

test('changed XML replaces reference facts without reparsing unchanged project text', () => {
  const service = new CountingLookupService();
  service.buildIndex([source(), mnemonics()]);
  const replacement = input('6502-reference', mnemonics().document.uri, '<mnemonics><mnemonic id="STA" name="Store A"/></mnemonics>');
  const current = [source(), replacement];
  const index = service.buildIndex(current);
  assert.equal(service.projectCalls.length, 1);
  assert.equal(service.referenceCalls.length, 2);
  assert.equal(index.referenceDeclarationsByName.has('LDA'), false);
  assert.equal(index.referenceDeclarationsByName.get('STA')?.[0]?.detail, 'Store A');
  assert.deepEqual(index, new KickAssemblerLookupService().buildIndex(current));
});

test('machine selection and document order are recomputed while document analysis is reused', () => {
  const service = new CountingLookupService();
  const declaration = input('kickassembler', 'file:///symbols.asm', '.const TARGET = 1\n');
  const usage = input('kickassembler', 'file:///main.asm', 'lda TARGET\nlda BORDER\n');
  const documents = [declaration, usage, io()];
  service.buildIndex(documents, { machineProfileId: 'c64' });
  const reordered = [usage, declaration, io()];
  const vic = service.buildIndex(reordered, { machineProfileId: 'vic20' });
  assert.equal(vic.referenceDeclarationsByName.has('BORDER'), false);
  assert.deepEqual(vic, new KickAssemblerLookupService().buildIndex(reordered, { machineProfileId: 'vic20' }));
  const c64 = service.buildIndex(documents, { machineProfileId: 'c64' });
  assert.equal(c64.referenceDeclarationsByName.get('BORDER')?.[0]?.kind, 'c64-io-id');
  assert.equal(service.projectCalls.length, 2);
  assert.equal(service.referenceCalls.length, 1);
  assert.deepEqual(c64, new KickAssemblerLookupService().buildIndex(documents, { machineProfileId: 'c64' }));
});

test('removing documents evicts analysis and prevents stale symbols from surviving the snapshot', () => {
  const service = new CountingLookupService();
  service.buildIndex([source(), mnemonics()]);
  const empty = service.buildIndex([]);
  assert.equal(empty.projectDeclarationsByName.size, 0);
  assert.equal(empty.referenceDeclarationsByName.has('LDA'), false);
  service.buildIndex([source(), mnemonics()]);
  assert.equal(service.projectCalls.length, 2);
  assert.equal(service.referenceCalls.length, 2);
});

test('clearing document state explicitly releases cached project and XML analysis', () => {
  const service = new CountingLookupService();
  service.buildIndex([source(), mnemonics()]);
  service.clearDocumentCache();
  service.clearDocumentCache();
  const current = [source(), mnemonics()];
  assert.deepEqual(service.buildIndex(current), new KickAssemblerLookupService().buildIndex(current));
  assert.equal(service.projectCalls.length, 2);
  assert.equal(service.referenceCalls.length, 2);
});

test('reference kind and document language changes do not reuse incompatible analyses', () => {
  const service = new CountingLookupService();
  const xml = '<root><mnemonic id="LDA"/><entry address="$d020" id="BORDER"/></root>';
  const referenceDocuments = [
    input('6502-reference', 'file:///combined.xml', xml),
    input('c64io-reference', 'file:///combined.xml', xml)
  ];
  const first = source();
  service.buildIndex([first, ...referenceDocuments]);
  const changedLanguage = { kind: first.kind, document: createTextDocumentModel({ uri: first.document.uri, text: first.document.text, languageId: 'other' }) };
  const current = [changedLanguage, ...referenceDocuments];
  const index = service.buildIndex(current);
  assert.equal(service.projectCalls.length, 2);
  assert.equal(service.referenceCalls.length, 2);
  assert.equal(index.referenceDeclarationsByName.has('LDA'), true);
  assert.equal(index.referenceDeclarationsByName.has('BORDER'), true);
  assert.deepEqual(index, new KickAssemblerLookupService().buildIndex(current));
});

test('mutating a returned index cannot corrupt cached symbol/token/XML locations or reference ranges', () => {
  const service = new CountingLookupService();
  const documents = [source(), mnemonics(), io()];
  const index = service.buildIndex(documents);
  index.projectDeclarationsByName.get('TARGET')![0]!.location.range.start.line = 99;
  index.projectReferencesByName.get('TARGET')![0]!.location.range.start.character = 99;
  index.referenceDeclarationsByName.get('LDA')![0]!.location.range.start.line = 99;
  index.referenceReferencesByName.get('LDA')![0]!.location.range.start.character = 99;
  index.referenceDeclarationsByAddressRange[0]!.addressRange!.start = 99;
  index.projectDeclarationsByName.clear();
  assert.deepEqual(service.buildIndex(documents), new KickAssemblerLookupService().buildIndex(documents));
  assert.equal(service.projectCalls.length, 1);
  assert.equal(service.referenceCalls.length, 2);
});
