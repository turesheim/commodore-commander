import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  disassemble6502,
  type Disassembled6502Instruction
} from './disassemble6502';
import {
  findLineMappingForAddress,
  findSourceForMapping,
  type KickAssemblerDebugInfo
} from './kick-assembler-debug-info';

export interface PrgImage {
  path: string;
  loadAddress: number;
  bytes: Buffer;
  endAddress: number;
}

export interface PrgInstructionLine {
  startAddress: number;
  endAddress: number;
  line: number;
}

export interface PrgDisassemblySource {
  name: string;
  content: string;
  sourceReference: number;
  instructionLines: readonly PrgInstructionLine[];
}

export async function loadPrgImage(programPath: string): Promise<PrgImage> {
  const fileBytes = await readFile(programPath);
  if (fileBytes.length < 2) {
    throw new Error('PRG file is missing its two-byte load address.');
  }

  const loadAddress = fileBytes.readUInt16LE(0);
  const bytes = fileBytes.subarray(2);
  if (loadAddress + bytes.length > 0x10000) {
    throw new Error(
      `PRG body at $${hexWord(loadAddress)} exceeds the 64K C64 address space.`
    );
  }

  return {
    path: programPath,
    loadAddress,
    bytes,
    endAddress: bytes.length === 0 ? loadAddress : loadAddress + bytes.length - 1
  };
}

export function prgContainsAddress(
  image: PrgImage | undefined,
  address: number
): image is PrgImage {
  if (!image || image.bytes.length === 0) {
    return false;
  }
  const normalized = address & 0xffff;
  return normalized >= image.loadAddress && normalized <= image.endAddress;
}

export function createPrgDisassemblySource(
  image: PrgImage,
  sourceReference: number,
  debugInfo: KickAssemblerDebugInfo | undefined
): PrgDisassemblySource {
  const labels = new Map(
    (debugInfo?.labels ?? []).map((label) => [label.address, label.name])
  );
  const instructions = disassemble6502(
    image.bytes,
    image.loadAddress,
    image.bytes.length,
    labels
  );
  const instructionLines: PrgInstructionLine[] = [];
  const lines = [
    `// Disassembly of ${path.basename(image.path)}`,
    `// Load range: $${hexWord(image.loadAddress)}-$${hexWord(image.endAddress)}`,
    `// Source: ${image.path}`,
    '',
    `* = $${hexWord(image.loadAddress)}`,
    ''
  ];

  if (instructions.length === 0) {
    lines.push('// Empty PRG body.');
  }

  for (const instruction of instructions) {
    if (instruction.symbol) {
      lines.push(`${instruction.symbol}:`);
    }
    const lineNumber = lines.length + 1;
    lines.push(formatPrgInstruction(instruction, debugInfo));
    instructionLines.push({
      startAddress: instruction.address,
      endAddress: (instruction.address + instruction.length - 1) & 0xffff,
      line: lineNumber
    });
  }

  return {
    name: `${path.basename(image.path)}.disassembly.asm`,
    content: `${lines.join('\n')}\n`,
    sourceReference,
    instructionLines
  };
}

export function findPrgDisassemblyLine(
  source: PrgDisassemblySource | undefined,
  address: number
): number | undefined {
  if (!source) {
    return undefined;
  }
  const normalized = address & 0xffff;
  const containing = source.instructionLines.find((line) =>
    normalized >= line.startAddress && normalized <= line.endAddress
  );
  if (containing) {
    return containing.line;
  }

  let nearestBefore: PrgInstructionLine | undefined;
  for (const line of source.instructionLines) {
    if (line.startAddress > normalized) {
      break;
    }
    nearestBefore = line;
  }
  return nearestBefore?.line;
}

function formatPrgInstruction(
  instruction: Disassembled6502Instruction,
  debugInfo: KickAssemblerDebugInfo | undefined
): string {
  const comments = [
    `$${hexWord(instruction.address)}  ${instruction.instructionBytes}`
  ];
  const mapping = findLineMappingForAddress(debugInfo, instruction.address);
  const source = findSourceForMapping(debugInfo, mapping);
  if (source && mapping) {
    comments.push(`${source.path}:${mapping.startLine}`);
  }
  if (instruction.undocumented) {
    comments.push('undocumented');
  }
  return `    ${instruction.instruction.padEnd(18)} // ${comments.join('  ')}`;
}

function hexWord(value: number): string {
  return (value & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}
