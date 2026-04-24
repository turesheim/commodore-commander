import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { injectable } from '@theia/core/shared/inversify';
import {
  disassemble6502,
  type Disassembled6502Instruction
} from '@commodore-commander/debug-adapter';

import {
  type CommodorePrgService,
  type DisassemblePrgRequest,
  type DisassemblePrgResult
} from '../common/commodore-prg-service';

@injectable()
export class CommodorePrgServiceImpl implements CommodorePrgService {
  async disassemble(
    request: DisassemblePrgRequest
  ): Promise<DisassemblePrgResult> {
    const filePath = fileURLToPath(request.resourceUri);
    if (path.extname(filePath).toLowerCase() !== '.prg') {
      throw new Error('Only .prg files can be disassembled.');
    }

    const fileBytes = await readFile(filePath);
    if (fileBytes.length < 2) {
      throw new Error('PRG file is missing its two-byte load address.');
    }

    const loadAddress = fileBytes[0] | (fileBytes[1] << 8);
    const programBytes = fileBytes.subarray(2);
    const instructions = disassemble6502(
      programBytes,
      loadAddress,
      programBytes.length
    );

    return {
      resourceUri: request.resourceUri,
      loadAddress,
      byteLength: programBytes.length,
      instructionCount: instructions.length,
      text: formatDisassembly(
        request.resourceUri,
        filePath,
        loadAddress,
        programBytes.length,
        instructions
      )
    };
  }
}

function formatDisassembly(
  resourceUri: string,
  filePath: string,
  loadAddress: number,
  byteLength: number,
  instructions: readonly Disassembled6502Instruction[]
): string {
  const lines = [
    `// Disassembly of ${path.basename(filePath)}`,
    `// Source: ${resourceUri}`,
    `// Load address: $${hexWord(loadAddress)}`,
    `// Program bytes: ${byteLength}`,
    '',
    `* = $${hexWord(loadAddress)}`,
    ''
  ];

  if (instructions.length === 0) {
    lines.push('// Empty PRG body.');
  }

  for (const instruction of instructions) {
    if (instruction.symbol) {
      lines.push(`${instruction.symbol}:`);
    }
    lines.push(
      `    ${instruction.instruction.padEnd(18)} // ` +
        `$${hexWord(instruction.address)}  ${instruction.instructionBytes}`
    );
  }

  return `${lines.join('\n')}\n`;
}

function hexWord(value: number): string {
  return (value & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}
