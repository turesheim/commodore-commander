export interface Disassembled6502Instruction {
  address: number;
  instructionBytes: string;
  instruction: string;
  length: number;
  symbol?: string;
  undocumented?: boolean;
}

type AddressingMode =
  | 'imm'
  | 'zp'
  | 'zpx'
  | 'zpy'
  | 'indx'
  | 'indy'
  | 'rel'
  | 'abs'
  | 'absx'
  | 'absy'
  | 'ind'
  | 'acc'
  | 'imp';

interface Opcode {
  mnemonic: string;
  mode: AddressingMode;
  undocumented?: boolean;
}

export function disassemble6502(
  bytes: Buffer,
  startAddress: number,
  instructionCount: number,
  labels: ReadonlyMap<number, string> = new Map()
): Disassembled6502Instruction[] {
  const instructions: Disassembled6502Instruction[] = [];
  let offset = 0;
  while (instructions.length < instructionCount && offset < bytes.length) {
    const address = (startAddress + offset) & 0xffff;
    const opcode = bytes[offset] ?? 0x00;
    const definition = OPCODES.get(opcode);
    if (!definition) {
      instructions.push({
        address,
        instructionBytes: hexByte(opcode),
        instruction: `.byte $${hexByte(opcode)}`,
        length: 1,
        ...(labels.has(address) ? { symbol: labels.get(address) } : {})
      });
      offset += 1;
      continue;
    }

    const length = modeLength(definition.mode);
    const instructionBytes = bytes
      .subarray(offset, Math.min(offset + length, bytes.length))
      .toString('hex')
      .match(/../gu)
      ?.map((value) => value.toUpperCase())
      .join(' ') ?? '';

    instructions.push({
      address,
      instructionBytes,
      instruction: `${definition.mnemonic.toLowerCase()}${operandText(
        definition.mode,
        bytes,
        offset,
        address,
        labels
      )}`,
      length,
      ...(definition.undocumented ? { undocumented: true } : {}),
      ...(labels.has(address) ? { symbol: labels.get(address) } : {})
    });
    offset += length;
  }
  return instructions;
}

function operandText(
  mode: AddressingMode,
  bytes: Buffer,
  offset: number,
  address: number,
  labels: ReadonlyMap<number, string>
): string {
  const byte = bytes[offset + 1] ?? 0x00;
  const word = ((bytes[offset + 2] ?? 0x00) << 8) | byte;
  switch (mode) {
    case 'imm':
      return ` #$${hexByte(byte)}`;
    case 'zp':
      return ` $${hexByte(byte)}`;
    case 'zpx':
      return ` $${hexByte(byte)},X`;
    case 'zpy':
      return ` $${hexByte(byte)},Y`;
    case 'indx':
      return ` ($${hexByte(byte)},X)`;
    case 'indy':
      return ` ($${hexByte(byte)}),Y`;
    case 'rel': {
      const signed = byte >= 0x80 ? byte - 0x100 : byte;
      const target = (address + 2 + signed) & 0xffff;
      return labels.has(target)
        ? ` ${labels.get(target)}`
        : ` $${hexWord(target)}`;
    }
    case 'abs':
      return labels.has(word) ? ` ${labels.get(word)}` : ` $${hexWord(word)}`;
    case 'absx':
      return labels.has(word) ? ` ${labels.get(word)},X` : ` $${hexWord(word)},X`;
    case 'absy':
      return labels.has(word) ? ` ${labels.get(word)},Y` : ` $${hexWord(word)},Y`;
    case 'ind':
      return ` ($${hexWord(word)})`;
    case 'acc':
      return ' A';
    case 'imp':
      return '';
  }
}

function modeLength(mode: AddressingMode): number {
  switch (mode) {
    case 'imp':
    case 'acc':
      return 1;
    case 'imm':
    case 'zp':
    case 'zpx':
    case 'zpy':
    case 'indx':
    case 'indy':
    case 'rel':
      return 2;
    case 'abs':
    case 'absx':
    case 'absy':
    case 'ind':
      return 3;
  }
}

function hexByte(value: number): string {
  return (value & 0xff).toString(16).toUpperCase().padStart(2, '0');
}

function hexWord(value: number): string {
  return (value & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

const OPCODES = new Map<number, Opcode>([
  [0x00, op('BRK', 'imp')], [0x01, op('ORA', 'indx')], [0x02, uop('KIL', 'imp')], [0x03, uop('SLO', 'indx')],
  [0x04, uop('NOP', 'zp')], [0x05, op('ORA', 'zp')], [0x06, op('ASL', 'zp')], [0x07, uop('SLO', 'zp')],
  [0x08, op('PHP', 'imp')], [0x09, op('ORA', 'imm')], [0x0a, op('ASL', 'acc')], [0x0b, uop('ANC', 'imm')],
  [0x0c, uop('NOP', 'abs')], [0x0d, op('ORA', 'abs')], [0x0e, op('ASL', 'abs')], [0x0f, uop('SLO', 'abs')],

  [0x10, op('BPL', 'rel')], [0x11, op('ORA', 'indy')], [0x12, uop('KIL', 'imp')], [0x13, uop('SLO', 'indy')],
  [0x14, uop('NOP', 'zpx')], [0x15, op('ORA', 'zpx')], [0x16, op('ASL', 'zpx')], [0x17, uop('SLO', 'zpx')],
  [0x18, op('CLC', 'imp')], [0x19, op('ORA', 'absy')], [0x1a, uop('NOP', 'imp')], [0x1b, uop('SLO', 'absy')],
  [0x1c, uop('NOP', 'absx')], [0x1d, op('ORA', 'absx')], [0x1e, op('ASL', 'absx')], [0x1f, uop('SLO', 'absx')],

  [0x20, op('JSR', 'abs')], [0x21, op('AND', 'indx')], [0x22, uop('KIL', 'imp')], [0x23, uop('RLA', 'indx')],
  [0x24, op('BIT', 'zp')], [0x25, op('AND', 'zp')], [0x26, op('ROL', 'zp')], [0x27, uop('RLA', 'zp')],
  [0x28, op('PLP', 'imp')], [0x29, op('AND', 'imm')], [0x2a, op('ROL', 'acc')], [0x2b, uop('ANC', 'imm')],
  [0x2c, op('BIT', 'abs')], [0x2d, op('AND', 'abs')], [0x2e, op('ROL', 'abs')], [0x2f, uop('RLA', 'abs')],

  [0x30, op('BMI', 'rel')], [0x31, op('AND', 'indy')], [0x32, uop('KIL', 'imp')], [0x33, uop('RLA', 'indy')],
  [0x34, uop('NOP', 'zpx')], [0x35, op('AND', 'zpx')], [0x36, op('ROL', 'zpx')], [0x37, uop('RLA', 'zpx')],
  [0x38, op('SEC', 'imp')], [0x39, op('AND', 'absy')], [0x3a, uop('NOP', 'imp')], [0x3b, uop('RLA', 'absy')],
  [0x3c, uop('NOP', 'absx')], [0x3d, op('AND', 'absx')], [0x3e, op('ROL', 'absx')], [0x3f, uop('RLA', 'absx')],

  [0x40, op('RTI', 'imp')], [0x41, op('EOR', 'indx')], [0x42, uop('KIL', 'imp')], [0x43, uop('SRE', 'indx')],
  [0x44, uop('NOP', 'zp')], [0x45, op('EOR', 'zp')], [0x46, op('LSR', 'zp')], [0x47, uop('SRE', 'zp')],
  [0x48, op('PHA', 'imp')], [0x49, op('EOR', 'imm')], [0x4a, op('LSR', 'acc')], [0x4b, uop('ALR', 'imm')],
  [0x4c, op('JMP', 'abs')], [0x4d, op('EOR', 'abs')], [0x4e, op('LSR', 'abs')], [0x4f, uop('SRE', 'abs')],

  [0x50, op('BVC', 'rel')], [0x51, op('EOR', 'indy')], [0x52, uop('KIL', 'imp')], [0x53, uop('SRE', 'indy')],
  [0x54, uop('NOP', 'zpx')], [0x55, op('EOR', 'zpx')], [0x56, op('LSR', 'zpx')], [0x57, uop('SRE', 'zpx')],
  [0x58, op('CLI', 'imp')], [0x59, op('EOR', 'absy')], [0x5a, uop('NOP', 'imp')], [0x5b, uop('SRE', 'absy')],
  [0x5c, uop('NOP', 'absx')], [0x5d, op('EOR', 'absx')], [0x5e, op('LSR', 'absx')], [0x5f, uop('SRE', 'absx')],

  [0x60, op('RTS', 'imp')], [0x61, op('ADC', 'indx')], [0x62, uop('KIL', 'imp')], [0x63, uop('RRA', 'indx')],
  [0x64, uop('NOP', 'zp')], [0x65, op('ADC', 'zp')], [0x66, op('ROR', 'zp')], [0x67, uop('RRA', 'zp')],
  [0x68, op('PLA', 'imp')], [0x69, op('ADC', 'imm')], [0x6a, op('ROR', 'acc')], [0x6b, uop('ARR', 'imm')],
  [0x6c, op('JMP', 'ind')], [0x6d, op('ADC', 'abs')], [0x6e, op('ROR', 'abs')], [0x6f, uop('RRA', 'abs')],

  [0x70, op('BVS', 'rel')], [0x71, op('ADC', 'indy')], [0x72, uop('KIL', 'imp')], [0x73, uop('RRA', 'indy')],
  [0x74, uop('NOP', 'zpx')], [0x75, op('ADC', 'zpx')], [0x76, op('ROR', 'zpx')], [0x77, uop('RRA', 'zpx')],
  [0x78, op('SEI', 'imp')], [0x79, op('ADC', 'absy')], [0x7a, uop('NOP', 'imp')], [0x7b, uop('RRA', 'absy')],
  [0x7c, uop('NOP', 'absx')], [0x7d, op('ADC', 'absx')], [0x7e, op('ROR', 'absx')], [0x7f, uop('RRA', 'absx')],

  [0x80, uop('NOP', 'imm')], [0x81, op('STA', 'indx')], [0x82, uop('NOP', 'imm')], [0x83, uop('SAX', 'indx')],
  [0x84, op('STY', 'zp')], [0x85, op('STA', 'zp')], [0x86, op('STX', 'zp')], [0x87, uop('SAX', 'zp')],
  [0x88, op('DEY', 'imp')], [0x89, uop('NOP', 'imm')], [0x8a, op('TXA', 'imp')], [0x8b, uop('XAA', 'imm')],
  [0x8c, op('STY', 'abs')], [0x8d, op('STA', 'abs')], [0x8e, op('STX', 'abs')], [0x8f, uop('SAX', 'abs')],

  [0x90, op('BCC', 'rel')], [0x91, op('STA', 'indy')], [0x92, uop('KIL', 'imp')], [0x93, uop('AHX', 'indy')],
  [0x94, op('STY', 'zpx')], [0x95, op('STA', 'zpx')], [0x96, op('STX', 'zpy')], [0x97, uop('SAX', 'zpy')],
  [0x98, op('TYA', 'imp')], [0x99, op('STA', 'absy')], [0x9a, op('TXS', 'imp')], [0x9b, uop('TAS', 'absy')],
  [0x9c, uop('SHY', 'absx')], [0x9d, op('STA', 'absx')], [0x9e, uop('SHX', 'absy')], [0x9f, uop('AHX', 'absy')],

  [0xa0, op('LDY', 'imm')], [0xa1, op('LDA', 'indx')], [0xa2, op('LDX', 'imm')], [0xa3, uop('LAX', 'indx')],
  [0xa4, op('LDY', 'zp')], [0xa5, op('LDA', 'zp')], [0xa6, op('LDX', 'zp')], [0xa7, uop('LAX', 'zp')],
  [0xa8, op('TAY', 'imp')], [0xa9, op('LDA', 'imm')], [0xaa, op('TAX', 'imp')], [0xab, uop('LAX', 'imm')],
  [0xac, op('LDY', 'abs')], [0xad, op('LDA', 'abs')], [0xae, op('LDX', 'abs')], [0xaf, uop('LAX', 'abs')],

  [0xb0, op('BCS', 'rel')], [0xb1, op('LDA', 'indy')], [0xb2, uop('KIL', 'imp')], [0xb3, uop('LAX', 'indy')],
  [0xb4, op('LDY', 'zpx')], [0xb5, op('LDA', 'zpx')], [0xb6, op('LDX', 'zpy')], [0xb7, uop('LAX', 'zpy')],
  [0xb8, op('CLV', 'imp')], [0xb9, op('LDA', 'absy')], [0xba, op('TSX', 'imp')], [0xbb, uop('LAS', 'absy')],
  [0xbc, op('LDY', 'absx')], [0xbd, op('LDA', 'absx')], [0xbe, op('LDX', 'absy')], [0xbf, uop('LAX', 'absy')],

  [0xc0, op('CPY', 'imm')], [0xc1, op('CMP', 'indx')], [0xc2, uop('NOP', 'imm')], [0xc3, uop('DCP', 'indx')],
  [0xc4, op('CPY', 'zp')], [0xc5, op('CMP', 'zp')], [0xc6, op('DEC', 'zp')], [0xc7, uop('DCP', 'zp')],
  [0xc8, op('INY', 'imp')], [0xc9, op('CMP', 'imm')], [0xca, op('DEX', 'imp')], [0xcb, uop('AXS', 'imm')],
  [0xcc, op('CPY', 'abs')], [0xcd, op('CMP', 'abs')], [0xce, op('DEC', 'abs')], [0xcf, uop('DCP', 'abs')],

  [0xd0, op('BNE', 'rel')], [0xd1, op('CMP', 'indy')], [0xd2, uop('KIL', 'imp')], [0xd3, uop('DCP', 'indy')],
  [0xd4, uop('NOP', 'zpx')], [0xd5, op('CMP', 'zpx')], [0xd6, op('DEC', 'zpx')], [0xd7, uop('DCP', 'zpx')],
  [0xd8, op('CLD', 'imp')], [0xd9, op('CMP', 'absy')], [0xda, uop('NOP', 'imp')], [0xdb, uop('DCP', 'absy')],
  [0xdc, uop('NOP', 'absx')], [0xdd, op('CMP', 'absx')], [0xde, op('DEC', 'absx')], [0xdf, uop('DCP', 'absx')],

  [0xe0, op('CPX', 'imm')], [0xe1, op('SBC', 'indx')], [0xe2, uop('NOP', 'imm')], [0xe3, uop('ISC', 'indx')],
  [0xe4, op('CPX', 'zp')], [0xe5, op('SBC', 'zp')], [0xe6, op('INC', 'zp')], [0xe7, uop('ISC', 'zp')],
  [0xe8, op('INX', 'imp')], [0xe9, op('SBC', 'imm')], [0xea, op('NOP', 'imp')], [0xeb, uop('SBC', 'imm')],
  [0xec, op('CPX', 'abs')], [0xed, op('SBC', 'abs')], [0xee, op('INC', 'abs')], [0xef, uop('ISC', 'abs')],

  [0xf0, op('BEQ', 'rel')], [0xf1, op('SBC', 'indy')], [0xf2, uop('KIL', 'imp')], [0xf3, uop('ISC', 'indy')],
  [0xf4, uop('NOP', 'zpx')], [0xf5, op('SBC', 'zpx')], [0xf6, op('INC', 'zpx')], [0xf7, uop('ISC', 'zpx')],
  [0xf8, op('SED', 'imp')], [0xf9, op('SBC', 'absy')], [0xfa, uop('NOP', 'imp')], [0xfb, uop('ISC', 'absy')],
  [0xfc, uop('NOP', 'absx')], [0xfd, op('SBC', 'absx')], [0xfe, op('INC', 'absx')], [0xff, uop('ISC', 'absx')]
]);

function op(mnemonic: string, mode: AddressingMode): Opcode {
  return { mnemonic, mode };
}

function uop(mnemonic: string, mode: AddressingMode): Opcode {
  return { mnemonic, mode, undocumented: true };
}
