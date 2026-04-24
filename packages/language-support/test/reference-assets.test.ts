import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { BUNDLED_REFERENCE_ASSET_SPECS } from '../src/runtime/index.ts';

test('bundled reference asset specs resolve packaged XML datasets', async () => {
  assert.equal(BUNDLED_REFERENCE_ASSET_SPECS.length, 2);

  for (const spec of BUNDLED_REFERENCE_ASSET_SPECS) {
    assert.equal(spec.assetUrl.protocol, 'file:');

    const content = await readFile(fileURLToPath(spec.assetUrl), 'utf8');

    assert.ok(content.length > 0);
    if (spec.kind === '6502-reference') {
      assert.match(content, /<mnemonics>/u);
    } else {
      assert.match(content, /<iomap>/u);
    }
  }
});
