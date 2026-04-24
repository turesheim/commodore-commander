import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

import {
  findLineMappingForAddress,
  findLineMappingForSourceLine,
  findLineMappingsForSourceRange,
  parseKickAssemblerDebugInfo
} from '../kick-assembler-debug-info';
import { disassemble6502 } from '../disassemble6502';

test('parseKickAssemblerDebugInfo reads sources, line mappings, and labels', async () => {
  const repoRoot = path.resolve(__dirname, '../../../..');
  const fixturePath = path.resolve(
    repoRoot,
    'example-workspace/out/hello.dbg'
  );
  const debugInfo = parseKickAssemblerDebugInfo(
    await readFile(fixturePath, 'utf8')
  );

  assert.equal(debugInfo.sources.length, 2);
  assert.equal(debugInfo.labels.find((label) => label.name === 'Done')?.address, 0x1018);
  assert.equal(findLineMappingForAddress(debugInfo, 0x1000)?.startLine, 50);
  assert.equal(
    findLineMappingForSourceLine(
      debugInfo,
      path.resolve(repoRoot, 'example-workspace/kickassembler/hello.asm'),
      50
    )?.startAddress,
    0x1000
  );
});

test('source mappings resolve relative debug-info paths against source roots', () => {
  const workspaceRoot = path.resolve('/workspace/project');
  const debugInfo = parseKickAssemblerDebugInfo(
    `<C64debugger version="1.0">
      <Sources values="INDEX,FILE">
        1,kickassembler/main.asm
      </Sources>
      <Segment name="Default" dest="" values="START,END,FILE_IDX,LINE1,COL1,LINE2,COL2">
        $1000,$1002,1,12,9,12,11
        $1003,$1004,1,13,9,13,11
      </Segment>
      <Labels values="SEGMENT,ADDRESS,NAME,FILE_IDX,LINE1,COL1,LINE2,COL2">
      </Labels>
    </C64debugger>`,
    { sourceRoots: [workspaceRoot] }
  );
  const sourcePath = path.join(workspaceRoot, 'kickassembler/main.asm');

  assert.equal(
    findLineMappingForSourceLine(debugInfo, sourcePath, 12)?.startAddress,
    0x1000
  );
  assert.deepEqual(
    findLineMappingsForSourceRange(debugInfo, sourcePath, 12, 13)
      .map((mapping) => mapping.startAddress),
    [0x1000, 0x1003]
  );
});

test('disassemble6502 formats common instructions and labels', () => {
  const instructions = disassemble6502(
    Buffer.from([0xa9, 0x01, 0x8d, 0x20, 0xd0, 0xd0, 0xfb]),
    0x1000,
    3,
    new Map([[0x1002, 'Loop']])
  );

  assert.deepEqual(
    instructions.map((instruction) => instruction.instruction),
    ['lda #$01', 'sta $D020', 'bne Loop']
  );
});

test('disassemble6502 stops at the available bytes', () => {
  const instructions = disassemble6502(
    Buffer.from([0xea, 0xea]),
    0x0801,
    10
  );

  assert.deepEqual(
    instructions.map((instruction) => instruction.instruction),
    ['nop', 'nop']
  );
});
