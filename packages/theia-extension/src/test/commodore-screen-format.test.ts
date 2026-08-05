import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createCharacterSetDocumentFromTemplate
} from '../common/commodore-character-set-format';
import {
  applyScreenCodeSequence,
  applySeqScreenImport,
  createDefaultScreenDocument,
  getScreenCell,
  screenToSeqBytes,
  setScreenCell
} from '../common/commodore-screen-format';

test('applyScreenCodeSequence keeps raw row-major screen-code import', () => {
  const document = setScreenCell(
    createDefaultScreenDocument('Raw screen codes', { columns: 3, rows: 1 }),
    0,
    0,
    { color: 5 }
  );

  const imported = applyScreenCodeSequence(document, Uint8Array.of(1, 2));

  assert.deepEqual(getScreenCell(imported, 0, 0), {
    character: 1,
    color: 5
  });
  assert.deepEqual(getScreenCell(imported, 1, 0), {
    character: 2,
    color: 1
  });
  assert.deepEqual(getScreenCell(imported, 2, 0), {
    character: 32,
    color: 1
  });
});

test('applySeqScreenImport imports a PETSCII control stream', () => {
  const document = createDefaultScreenDocument('PETSCII stream', {
    columns: 4,
    rows: 2
  });

  const imported = applySeqScreenImport(
    document,
    Uint8Array.of(
      0x93,
      0x8e,
      0x90,
      0x41,
      0x05,
      0x42,
      0x0d,
      0x12,
      0x43,
      0x92
    )
  );

  assert.equal(imported.importedCharacters, 3);
  assert.equal(imported.document.characterSet.name, 'C64 Uppercase Graphics');
  assert.deepEqual(getScreenCell(imported.document, 0, 0), {
    character: 1,
    color: 0
  });
  assert.deepEqual(getScreenCell(imported.document, 1, 0), {
    character: 2,
    color: 1
  });
  assert.deepEqual(getScreenCell(imported.document, 0, 1), {
    character: 0x83,
    color: 1
  });
  assert.deepEqual(getScreenCell(imported.document, 1, 1), {
    character: 32,
    color: 14
  });
});

test('applySeqScreenImport handles PETSCII Editor escaped quotes', () => {
  const document = createDefaultScreenDocument('PETSCII quote', {
    columns: 2,
    rows: 1
  });

  const imported = applySeqScreenImport(
    document,
    Uint8Array.of(0x93, 0x8e, 0x12, 0x22, 0x22, 0x14, 0x92)
  );

  assert.equal(imported.importedCharacters, 1);
  assert.deepEqual(getScreenCell(imported.document, 0, 0), {
    character: 0xa2,
    color: 14
  });
  assert.deepEqual(getScreenCell(imported.document, 1, 0), {
    character: 32,
    color: 14
  });
});

test('applySeqScreenImport preserves reverse mode across return', () => {
  const document = createDefaultScreenDocument('PETSCII reverse return', {
    columns: 2,
    rows: 2
  });

  const imported = applySeqScreenImport(
    document,
    Uint8Array.of(0x93, 0x8e, 0x12, 0x41, 0x0d, 0x42, 0x92)
  );

  assert.equal(imported.importedCharacters, 2);
  assert.deepEqual(getScreenCell(imported.document, 0, 0), {
    character: 0x81,
    color: 14
  });
  assert.deepEqual(getScreenCell(imported.document, 0, 1), {
    character: 0x82,
    color: 14
  });
});

test('screenToSeqBytes exports a PETSCII control stream', () => {
  let document = createDefaultScreenDocument('PETSCII export', {
    columns: 3,
    rows: 1
  });
  document = setScreenCell(document, 0, 0, { character: 1, color: 0 });
  document = setScreenCell(document, 1, 0, { character: 0x82, color: 1 });
  document = setScreenCell(document, 2, 0, { character: 0x22, color: 1 });

  const bytes = screenToSeqBytes(document);

  assert.deepEqual([...bytes], [
    0x93,
    0x0e,
    0x90,
    0x41,
    0x05,
    0x12,
    0x42,
    0x92,
    0x22,
    0x22,
    0x14,
    0x92
  ]);

  const imported = applySeqScreenImport(
    createDefaultScreenDocument('PETSCII round trip', { columns: 3, rows: 1 }),
    bytes
  );
  assert.equal(imported.importedCharacters, 3);
  assert.deepEqual(getScreenCell(imported.document, 0, 0), {
    character: 1,
    color: 0
  });
  assert.deepEqual(getScreenCell(imported.document, 1, 0), {
    character: 0x82,
    color: 1
  });
  assert.deepEqual(getScreenCell(imported.document, 2, 0), {
    character: 0x22,
    color: 1
  });
});

test('screenToSeqBytes exports upper/graphics charset control', () => {
  const document = createDefaultScreenDocument('Upper graphics SEQ', {
    columns: 1,
    rows: 1,
    characterSetTemplateId: 'c64-upper-graphics'
  });

  assert.deepEqual([...screenToSeqBytes(document).slice(0, 2)], [0x93, 0x8e]);
});

test('c64-upper-graphics template uses the upper/graphics ROM half', () => {
  const characterSet = createCharacterSetDocumentFromTemplate('c64-upper-graphics');

  assert.equal(characterSet.metadata.machine, 'c64');
  assert.equal(characterSet.glyphs[1], '183C667E66666600');
  assert.equal(characterSet.glyphs[65], '081C3E7F7F1C3E00');
});
