import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  findNearestRomSymbol,
  findRomSourceForAddress,
  findRomSourceLine,
  loadC64RomSources,
  loadViceSymbolFile
} from '../rom-source';

test('loadViceSymbolFile parses VICE monitor alias symbols', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cc-rom-symbols-'));
  const symbolPath = path.join(directory, 'c64mem.sym');
  await writeFile(symbolPath, [
    'al ffd2 .kCHROUT',
    'al a7e1 .bGONE',
    'bogus',
    ''
  ].join('\n'));

  assert.deepEqual(await loadViceSymbolFile(symbolPath), [
    { address: 0xffd2, name: 'kCHROUT' },
    { address: 0xa7e1, name: 'bGONE' }
  ]);
});

test('loadC64RomSources creates generated BASIC and KERNAL disassembly sources', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cc-rom-source-'));
  const c64Directory = path.join(root, 'share', 'vice', 'C64');
  await mkdir(c64Directory, { recursive: true });
  await writeFile(path.join(c64Directory, 'c64mem.sym'), [
    'al a000 .bRESTART',
    'al a7e1 .bGONE',
    'al ffd2 .kCHROUT'
  ].join('\n'));
  await writeFile(path.join(c64Directory, 'basic-901226-01.bin'), romBytes(0x2000, [
    [0x0000, [0xea]],
    [0x07e1, [0xa9, 0x01, 0xd0, 0xfb]]
  ]));
  await writeFile(path.join(c64Directory, 'kernal-901227-03.bin'), romBytes(0x2000, [
    [0x1fd2, [0x60]]
  ]));

  const sources = await loadC64RomSources(root, 650300);
  const basic = findRomSourceForAddress(sources, 0xa7e2);
  const kernal = findRomSourceForAddress(sources, 0xffd2);

  assert.equal(basic?.name, 'C64 BASIC ROM.disassembly.asm');
  assert.equal(kernal?.name, 'C64 KERNAL ROM.disassembly.asm');
  assert.equal(findNearestRomSymbol(sources, 0xa7e2)?.name, 'bGONE');
  assert.equal(findNearestRomSymbol(sources, 0xe544)?.name, 'KERNAL_CLEAR_SCREEN');
  assert.ok(findRomSourceLine(basic, 0xa7e2));
  assert.match(basic?.content ?? '', /bGONE:/u);
  assert.match(kernal?.content ?? '', /kCHROUT:/u);
});

test('loadC64RomSources accepts a direct VICE data directory', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cc-rom-data-'));
  const c64Directory = path.join(root, 'C64');
  await mkdir(c64Directory, { recursive: true });
  await writeFile(path.join(c64Directory, 'c64mem.sym'), 'al ffd2 .kCHROUT\n');
  await writeFile(path.join(c64Directory, 'basic-901226-01.bin'), romBytes(0x2000, []));
  await writeFile(path.join(c64Directory, 'kernal-901227-03.bin'), romBytes(0x2000, [
    [0x1fd2, [0x60]]
  ]));

  const sources = await loadC64RomSources(root, 650400);

  assert.equal(findRomSourceForAddress(sources, 0xffd2)?.sourceReference, 650401);
});

function romBytes(
  length: number,
  patches: readonly [number, readonly number[]][]
): Buffer {
  const bytes = Buffer.alloc(length, 0xea);
  for (const [offset, values] of patches) {
    Buffer.from(values).copy(bytes, offset);
  }
  return bytes;
}
