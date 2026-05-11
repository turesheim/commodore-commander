import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  createPrgDisassemblySource,
  findPrgDisassemblyLine,
  loadPrgImage,
  prgContainsAddress,
  type PrgImage
} from '../prg-image';
import { parseKickAssemblerDebugInfo } from '../kick-assembler-debug-info';

test('loadPrgImage reads the PRG load address and body range', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cc-prg-image-'));
  const prgPath = path.join(directory, 'demo.prg');
  await writeFile(prgPath, Buffer.from([0x01, 0x08, 0xa9, 0x01, 0x60]));

  const image = await loadPrgImage(prgPath);

  assert.equal(image.loadAddress, 0x0801);
  assert.equal(image.endAddress, 0x0803);
  assert.deepEqual([...image.bytes], [0xa9, 0x01, 0x60]);
  assert.equal(prgContainsAddress(image, 0x0801), true);
  assert.equal(prgContainsAddress(image, 0x0803), true);
  assert.equal(prgContainsAddress(image, 0x0804), false);
});

test('createPrgDisassemblySource maps C64 addresses to generated source lines', () => {
  const workspaceRoot = path.resolve('/workspace/project');
  const debugInfo = parseKickAssemblerDebugInfo(
    `<C64debugger version="1.0">
      <Sources values="INDEX,FILE">
        1,main.asm
      </Sources>
      <Segment name="Default" dest="" values="START,END,FILE_IDX,LINE1,COL1,LINE2,COL2">
        $1002,$1003,1,42,1,42,8
      </Segment>
      <Labels values="SEGMENT,ADDRESS,NAME,FILE_IDX,LINE1,COL1,LINE2,COL2">
        Default,$1002,Illegal,1,42,1,42,7
      </Labels>
    </C64debugger>`,
    { sourceRoots: [workspaceRoot] }
  );
  const image: PrgImage = {
    path: path.join(workspaceRoot, 'demo.prg'),
    loadAddress: 0x1000,
    endAddress: 0x1004,
    bytes: Buffer.from([0xa9, 0x01, 0x0b, 0x7f, 0x60])
  };

  const source = createPrgDisassemblySource(image, 650201, debugInfo);
  const illegalLine = findPrgDisassemblyLine(source, 0x1002);
  assert.ok(illegalLine);
  assert.equal(findPrgDisassemblyLine(source, 0x1003), illegalLine);

  const lines = source.content.split('\n');
  assert.match(lines[illegalLine - 1], /anc #\$7F/u);
  assert.match(lines[illegalLine - 1], /main\.asm:42/u);
  assert.match(lines[illegalLine - 1], /undocumented/u);
  assert.equal(findPrgDisassemblyLine(source, 0x0fff), undefined);
});
