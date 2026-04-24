import assert from 'node:assert/strict';
import { test } from 'node:test';

import { TextDocumentModel } from '../src/document/text-document-model.ts';
import { createRange } from '../src/location/source-location.ts';

test('TextDocumentModel tracks line offsets across CRLF and LF', () => {
  const document = new TextDocumentModel({
    uri: 'memory://kickassembler/main.asm',
    text: 'lda\r\nrts\n'
  });

  assert.equal(document.lineCount, 3);
  assert.equal(document.lineAt(0), 'lda');
  assert.equal(document.lineAt(1), 'rts');
  assert.deepEqual(document.positionAt(7), { line: 1, character: 2 });
  assert.equal(document.offsetAt({ line: 1, character: 2 }), 7);
  assert.equal(
    document.getText(createRange(0, 1, 1, 1)),
    'da\r\nr'
  );
});
