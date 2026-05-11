import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';

import {
  findLineMappingForAddress,
  findLineMappingForSourceLine,
  findLineMappingsForSourceRange,
  findNearestLabelBeforeAddress,
  findNearestLineMappingForAddress,
  findSourceForMapping,
  parseKickAssemblerDebugInfo
} from '../kick-assembler-debug-info';
import { disassemble6502 } from '../disassemble6502';

test('parseKickAssemblerDebugInfo reads sources, line mappings, and labels', () => {
  const workspaceRoot = path.resolve('/workspace/project');
  const debugInfo = parseKickAssemblerDebugInfo(
    `<C64debugger version="1.0">
      <Sources values="INDEX,FILE">
        1,kickassembler/hello.asm
        2,kickassembler/lib.asm
      </Sources>
      <Segment name="Default" dest="" values="START,END,FILE_IDX,LINE1,COL1,LINE2,COL2">
        $1000,$1002,1,50,9,50,11
        $1018,$101a,1,65,9,65,11
      </Segment>
      <Labels values="SEGMENT,ADDRESS,NAME,FILE_IDX,LINE1,COL1,LINE2,COL2">
        Default,$1018,Done,1,65,1,65,4
      </Labels>
    </C64debugger>`,
    { sourceRoots: [workspaceRoot] }
  );

  assert.equal(debugInfo.sources.length, 2);
  assert.equal(debugInfo.labels.find((label) => label.name === 'Done')?.address, 0x1018);
  assert.equal(findNearestLabelBeforeAddress(debugInfo, 0x101a)?.name, 'Done');
  assert.equal(findNearestLabelBeforeAddress(debugInfo, 0x1100, 0x20), undefined);
  assert.equal(findLineMappingForAddress(debugInfo, 0x1000)?.startLine, 50);
  assert.equal(
    findLineMappingForSourceLine(
      debugInfo,
      path.join(workspaceRoot, 'kickassembler/hello.asm'),
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
  assert.equal(
    findSourceForMapping(
      debugInfo,
      findLineMappingForAddress(debugInfo, 0x1000)
    )?.path,
    sourcePath
  );
});

test('nearest source mapping resolves nearby unmapped addresses for stack frames', () => {
  const debugInfo = parseKickAssemblerDebugInfo(
    `<C64debugger version="1.0">
      <Sources values="INDEX,FILE">
        1,kickassembler/main.asm
      </Sources>
      <Segment name="Default" dest="" values="START,END,FILE_IDX,LINE1,COL1,LINE2,COL2">
        $1000,$1002,1,12,9,12,11
        $1006,$1008,1,13,9,13,11
        $1020,$1022,1,20,9,20,11
      </Segment>
      <Labels values="SEGMENT,ADDRESS,NAME,FILE_IDX,LINE1,COL1,LINE2,COL2">
      </Labels>
    </C64debugger>`
  );

  assert.equal(findNearestLineMappingForAddress(debugInfo, 0x1001)?.startLine, 12);
  assert.equal(findNearestLineMappingForAddress(debugInfo, 0x1004)?.startLine, 12);
  assert.equal(findNearestLineMappingForAddress(debugInfo, 0x101d)?.startLine, 20);
  assert.equal(findNearestLineMappingForAddress(debugInfo, 0x1100, 0x20), undefined);
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

test('disassemble6502 covers every NMOS 6502 opcode', () => {
  for (let opcode = 0x00; opcode <= 0xff; opcode += 1) {
    const [instruction] = disassemble6502(
      Buffer.from([opcode, 0x34, 0x12]),
      0x2000,
      1
    );

    assert.ok(instruction, `opcode $${opcode.toString(16).padStart(2, '0')}`);
    assert.ok(
      !instruction.instruction.startsWith('.byte'),
      `opcode $${opcode.toString(16).padStart(2, '0')} fell back to .byte`
    );
  }
});

test('disassemble6502 formats undocumented opcodes', () => {
  assert.deepEqual(
    [
      disassemble6502(Buffer.from([0x0b, 0x7f]), 0x2000, 1)[0],
      disassemble6502(Buffer.from([0x1c, 0x34, 0x12]), 0x2000, 1)[0],
      disassemble6502(Buffer.from([0x93, 0x44]), 0x2000, 1)[0],
      disassemble6502(Buffer.from([0x9c, 0x34, 0x12]), 0x2000, 1)[0],
      disassemble6502(Buffer.from([0xcb, 0x10]), 0x2000, 1)[0],
      disassemble6502(Buffer.from([0x02]), 0x2000, 1)[0]
    ].map((instruction) => ({
      text: instruction.instruction,
      undocumented: instruction.undocumented === true
    })),
    [
      { text: 'anc #$7F', undocumented: true },
      { text: 'nop $1234,X', undocumented: true },
      { text: 'ahx ($44),Y', undocumented: true },
      { text: 'shy $1234,X', undocumented: true },
      { text: 'axs #$10', undocumented: true },
      { text: 'kil', undocumented: true }
    ]
  );
});
