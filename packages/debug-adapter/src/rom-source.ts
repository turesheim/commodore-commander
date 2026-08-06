import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  disassemble6502,
  type Disassembled6502Instruction
} from './disassemble6502';
import type { PrgInstructionLine } from './prg-image';

export interface RomSymbol {
  address: number;
  name: string;
}

export interface RomSource {
  id: string;
  name: string;
  startAddress: number;
  endAddress: number;
  sourceReference: number;
  content: string;
  instructionLines: readonly PrgInstructionLine[];
  symbols: readonly RomSymbol[];
}

interface RomSpec {
  id: string;
  name: string;
  fileName: string;
  startAddress: number;
  endAddress: number;
}

const C64_ROM_SPECS: readonly RomSpec[] = [
  {
    id: 'c64-basic',
    name: 'C64 BASIC ROM',
    fileName: 'basic-901226-01.bin',
    startAddress: 0xa000,
    endAddress: 0xbfff
  },
  {
    id: 'c64-kernal',
    name: 'C64 KERNAL ROM',
    fileName: 'kernal-901227-03.bin',
    startAddress: 0xe000,
    endAddress: 0xffff
  }
];

const EXTRA_C64_ROM_SYMBOLS: readonly RomSymbol[] = [
  { address: 0xe544, name: 'KERNAL_CLEAR_SCREEN' }
];

export async function loadC64RomSources(
  viceResourcesPath: string,
  sourceReferenceBase: number
): Promise<RomSource[]> {
  const c64Directory = await resolveC64RomDirectory(viceResourcesPath);
  const symbols = [
    ...await loadViceSymbolFile(path.join(c64Directory, 'c64mem.sym')),
    ...EXTRA_C64_ROM_SYMBOLS
  ];
  const sources: RomSource[] = [];
  for (const [index, spec] of C64_ROM_SPECS.entries()) {
    const bytes = await readFile(path.join(c64Directory, spec.fileName));
    sources.push(createRomSource(
      spec,
      bytes,
      sourceReferenceBase + index,
      symbols.filter((symbol) =>
        symbol.address >= spec.startAddress &&
        symbol.address <= spec.endAddress
      )
    ));
  }
  return sources;
}

async function resolveC64RomDirectory(viceResourcesPath: string): Promise<string> {
  const candidates = [
    path.join(viceResourcesPath, 'share', 'vice', 'C64'),
    path.join(viceResourcesPath, 'C64')
  ];
  for (const candidate of candidates) {
    if (await isReadable(path.join(candidate, C64_ROM_SPECS[0].fileName))) {
      return candidate;
    }
  }
  return candidates[0];
}

async function isReadable(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function findRomSourceForAddress(
  sources: readonly RomSource[],
  address: number
): RomSource | undefined {
  const normalized = address & 0xffff;
  return sources.find((source) =>
    normalized >= source.startAddress &&
    normalized <= source.endAddress
  );
}

export function findRomSourceLine(
  source: RomSource | undefined,
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

export function findNearestRomSymbol(
  sources: readonly RomSource[],
  address: number,
  maxDistance = 0x1000
): RomSymbol | undefined {
  const normalized = address & 0xffff;
  return sources
    .flatMap((source) => source.symbols)
    .map((symbol) => ({
      symbol,
      distance: normalized - symbol.address
    }))
    .filter((candidate) =>
      candidate.distance >= 0 &&
      candidate.distance <= maxDistance
    )
    .sort((left, right) =>
      left.distance - right.distance ||
      left.symbol.name.localeCompare(right.symbol.name)
    )[0]?.symbol;
}

export async function loadViceSymbolFile(symbolPath: string): Promise<RomSymbol[]> {
  const text = await readFile(symbolPath, 'utf8');
  const symbols: RomSymbol[] = [];
  for (const rawLine of text.split(/\r?\n/u)) {
    const match = /^\s*al\s+([0-9a-f]{1,6})\s+\.?(\S+)/iu.exec(rawLine);
    if (!match) {
      continue;
    }
    const address = Number.parseInt(match[1], 16);
    const name = match[2].replace(/[^\w.$@]/gu, '_');
    if (!Number.isFinite(address) || !name) {
      continue;
    }
    symbols.push({ address: address & 0xffff, name });
  }
  return symbols;
}

function createRomSource(
  spec: RomSpec,
  bytes: Buffer,
  sourceReference: number,
  symbols: readonly RomSymbol[]
): RomSource {
  const symbolMap = new Map(symbols.map((symbol) => [symbol.address, symbol.name]));
  const instructions = disassemble6502(
    bytes,
    spec.startAddress,
    bytes.length,
    symbolMap
  );
  const instructionLines: PrgInstructionLine[] = [];
  const lines = [
    `// ${spec.name}`,
    `// Generated from VICE ROM image ${spec.fileName}`,
    `// Address range: $${hexWord(spec.startAddress)}-$${hexWord(spec.endAddress)}`,
    '',
    `* = $${hexWord(spec.startAddress)}`,
    ''
  ];

  for (const instruction of instructions) {
    if (instruction.symbol) {
      lines.push(`${instruction.symbol}:`);
    }
    const lineNumber = lines.length + 1;
    lines.push(formatRomInstruction(instruction));
    instructionLines.push({
      startAddress: instruction.address,
      endAddress: (instruction.address + instruction.length - 1) & 0xffff,
      line: lineNumber
    });
  }

  return {
    id: spec.id,
    name: `${spec.name}.disassembly.asm`,
    startAddress: spec.startAddress,
    endAddress: spec.endAddress,
    sourceReference,
    content: `${lines.join('\n')}\n`,
    instructionLines,
    symbols
  };
}

function formatRomInstruction(instruction: Disassembled6502Instruction): string {
  return `    ${instruction.instruction.padEnd(18)} // ` +
    `$${hexWord(instruction.address)}  ${instruction.instructionBytes}` +
    `${instruction.undocumented ? '  undocumented' : ''}`;
}

function hexWord(value: number): string {
  return (value & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}
