export type KickAssemblerDirectivePrefix = '.' | '#';

export interface KickAssemblerDirectiveInfo {
  name: string;
  insertText: string;
  prefix: KickAssemblerDirectivePrefix;
  detail: string;
  description: string;
}

export interface KickAssemblerAddressingModeInfo {
  mode: string;
  syntax: string;
  operand: string;
  opcode?: string;
}

export const KICK_ASSEMBLER_DIRECTIVES: readonly KickAssemblerDirectiveInfo[] =
  Object.freeze([
    dotDirective('addr', 'emit an address-sized value'),
    dotDirective('align', 'align the program counter'),
    dotDirective('assert', 'assert an assembly-time condition'),
    dotDirective('binary', 'embed a binary file'),
    dotDirective('break', 'emit a debugger break marker'),
    dotDirective('byte', 'emit byte data'),
    dotDirective('const', 'declare an immutable symbol'),
    dotDirective('cpu', 'select a target CPU'),
    dotDirective('disk', 'define disk image output'),
    dotDirective('dword', 'emit double-word data'),
    dotDirective('encoding', 'select text encoding'),
    dotDirective('enum', 'declare an enum block'),
    dotDirective('error', 'emit an assembly error'),
    dotDirective('eval', 'evaluate an assembly-time expression'),
    dotDirective('file', 'define output file settings'),
    dotDirective('fill', 'emit repeated byte data'),
    dotDirective('fillword', 'emit repeated word data'),
    dotDirective('filenamespace', 'declare a file namespace'),
    dotDirective('for', 'declare an assembly-time loop'),
    dotDirective('function', 'declare a function'),
    dotDirective('if', 'start a conditional block'),
    dotDirective('ifdef', 'start a symbol-defined conditional block'),
    dotDirective('ifndef', 'start a symbol-not-defined conditional block'),
    dotDirective('label', 'declare a label-valued symbol'),
    dotDirective('lohifill', 'emit low/high-byte table data'),
    dotDirective('macro', 'declare a macro'),
    dotDirective('memblock', 'define a memory block'),
    dotDirective('modify', 'modify output data'),
    dotDirective('namespace', 'declare a namespace block'),
    dotDirective('pc', 'set the program counter'),
    dotDirective('plugin', 'load a Kick Assembler plugin'),
    dotDirective('print', 'print assembly-time output'),
    dotDirective('pseudocommand', 'declare a pseudocommand'),
    dotDirective('pseudopc', 'set a pseudo program counter'),
    dotDirective('return', 'return from a function'),
    dotDirective('segment', 'select a segment'),
    dotDirective('segmentdef', 'define a segment'),
    dotDirective('segmentout', 'write segment output'),
    dotDirective('struct', 'declare a struct block'),
    dotDirective('text', 'emit encoded text'),
    dotDirective('var', 'declare a mutable symbol'),
    dotDirective('watch', 'emit a debugger watch marker'),
    dotDirective('while', 'declare an assembly-time while loop'),
    dotDirective('word', 'emit word data'),
    hashDirective('define', 'define a preprocessor symbol'),
    hashDirective('elif', 'continue a preprocessor conditional'),
    hashDirective('else', 'continue a preprocessor conditional'),
    hashDirective('endif', 'end a preprocessor conditional'),
    hashDirective('if', 'start a preprocessor conditional'),
    hashDirective('import', 'import another Kick Assembler source file'),
    hashDirective('importif', 'conditionally import another source file'),
    hashDirective('importonce', 'prevent duplicate imports'),
    hashDirective('undef', 'undefine a preprocessor symbol')
  ]);

export const MOS_6502_MNEMONICS: readonly string[] = Object.freeze([
  'ADC',
  'AND',
  'ASL',
  'BCC',
  'BCS',
  'BEQ',
  'BIT',
  'BMI',
  'BNE',
  'BPL',
  'BRK',
  'BVC',
  'BVS',
  'CLC',
  'CLD',
  'CLI',
  'CLV',
  'CMP',
  'CPX',
  'CPY',
  'DEC',
  'DEX',
  'DEY',
  'EOR',
  'INC',
  'INX',
  'INY',
  'JMP',
  'JSR',
  'LDA',
  'LDX',
  'LDY',
  'LSR',
  'NOP',
  'ORA',
  'PHA',
  'PHP',
  'PLA',
  'PLP',
  'ROL',
  'ROR',
  'RTI',
  'RTS',
  'SBC',
  'SEC',
  'SED',
  'SEI',
  'STA',
  'STX',
  'STY',
  'TAX',
  'TAY',
  'TSX',
  'TXA',
  'TXS',
  'TYA'
]);

const FALLBACK_ADDRESSING_MODES: readonly KickAssemblerAddressingModeInfo[] =
  Object.freeze([
    mode('Immediate', '#$00'),
    mode('Zero Page', '$00'),
    mode('Zero Page,X', '$00,x'),
    mode('Zero Page,Y', '$00,y'),
    mode('Absolute', '$0000'),
    mode('Absolute,X', '$0000,x'),
    mode('Absolute,Y', '$0000,y'),
    mode('Indirect', '($0000)'),
    mode('Indirect,X', '($00,x)'),
    mode('Indirect,Y', '($00),y'),
    mode('Accumulator', 'a')
  ]);

export function isMos6502Mnemonic(text: string): boolean {
  return MOS_6502_MNEMONICS.includes(text.toUpperCase());
}

export function extractAddressingModes(
  mnemonic: string,
  description?: string
): readonly KickAssemblerAddressingModeInfo[] {
  if (!description) {
    return FALLBACK_ADDRESSING_MODES;
  }

  const modes = [
    ...extractModeTableAddressingModes(mnemonic, description),
    ...extractRelativeBranchMode(mnemonic, description),
    ...extractGroupedImpliedMode(mnemonic, description)
  ];

  return modes.length > 0 ? deduplicateModes(modes) : FALLBACK_ADDRESSING_MODES;
}

function extractModeTableAddressingModes(
  mnemonic: string,
  description: string
): KickAssemblerAddressingModeInfo[] {
  const escapedMnemonic = escapeRegExp(mnemonic.toUpperCase());
  const linePattern = new RegExp(
    `^\\s*(.+?)\\s+(${escapedMnemonic})(?:\\s+(.+?))?\\s+(\\$[0-9A-Fa-f]{2})\\b`,
    'iu'
  );
  const modes: KickAssemblerAddressingModeInfo[] = [];

  for (const rawLine of htmlToLines(description)) {
    const line = rawLine.trim();
    const match = linePattern.exec(line);
    if (!match) {
      continue;
    }

    const modeName = titleCaseMode((match[1] ?? '').trim());
    const originalOperand = (match[3] ?? '').trim();
    const opcode = match[4]?.toUpperCase();

    modes.push(
      mode(
        modeName,
        normalizeOperandForCompletion(modeName, originalOperand),
        opcode,
        fullSyntax(mnemonic, originalOperand)
      )
    );
  }

  return modes;
}

function extractRelativeBranchMode(
  mnemonic: string,
  description: string
): KickAssemblerAddressingModeInfo[] {
  if (!/\bbranches\s+are\s+relative\s+mode\b/iu.test(description)) {
    return [];
  }

  return [
    mode(
      'Relative',
      'Label',
      opcodeForMnemonic(mnemonic, description),
      `${mnemonic.toUpperCase()} Label`
    )
  ];
}

function extractGroupedImpliedMode(
  mnemonic: string,
  description: string
): KickAssemblerAddressingModeInfo[] {
  if (!/\bimplied\s+mode\b/iu.test(description)) {
    return [];
  }

  return [
    mode(
      'Implied',
      '',
      opcodeForMnemonic(mnemonic, description),
      mnemonic.toUpperCase()
    )
  ];
}

function dotDirective(
  name: string,
  description: string
): KickAssemblerDirectiveInfo {
  return {
    name,
    insertText: `.${name}`,
    prefix: '.',
    detail: 'Kick Assembler directive',
    description
  };
}

function hashDirective(
  name: string,
  description: string
): KickAssemblerDirectiveInfo {
  return {
    name,
    insertText: `#${name}`,
    prefix: '#',
    detail: 'Kick Assembler preprocessor directive',
    description
  };
}

function mode(
  modeName: string,
  operand: string,
  opcode?: string,
  syntax?: string
): KickAssemblerAddressingModeInfo {
  const entry: KickAssemblerAddressingModeInfo = {
    mode: modeName,
    operand,
    syntax: syntax ?? (operand.length > 0 ? operand : '')
  };
  if (opcode) {
    entry.opcode = opcode;
  }
  return entry;
}

function htmlToLines(description: string): string[] {
  return description
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(/<\/(?:p|pre|div|tr)>/giu, '\n')
    .replace(/<[^>]+>/gu, '')
    .split(/\r?\n/u);
}

function normalizeOperandForCompletion(modeName: string, operand: string): string {
  if (operand.length === 0) {
    return '';
  }

  const normalizedMode = modeName.toLowerCase();
  if (normalizedMode === 'accumulator') {
    return 'a';
  }
  if (normalizedMode === 'relative') {
    return 'Label';
  }
  if (normalizedMode.startsWith('immediate')) {
    return '#$00';
  }

  const replacement = normalizedMode.includes('absolute') ||
    normalizedMode === 'indirect'
    ? '$0000'
    : '$00';

  return operand
    .replace(/\$[0-9A-Fa-f]+/u, replacement)
    .replace(/\bX\b/gu, 'x')
    .replace(/\bY\b/gu, 'y')
    .replace(/\bA\b/gu, 'a');
}

function fullSyntax(mnemonic: string, operand: string): string {
  return operand.length > 0
    ? `${mnemonic.toUpperCase()} ${operand}`
    : mnemonic.toUpperCase();
}

function opcodeForMnemonic(
  mnemonic: string,
  description: string
): string | undefined {
  const linePattern = new RegExp(
    `^\\s*${escapeRegExp(mnemonic)}\\b.*?(\\$[0-9A-Fa-f]{2})\\b`,
    'iu'
  );

  for (const rawLine of htmlToLines(description)) {
    const match = linePattern.exec(rawLine.trim());
    if (match?.[1]) {
      return match[1].toUpperCase();
    }
  }

  return undefined;
}

function titleCaseMode(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/gu, (letter) => letter.toUpperCase());
}

function deduplicateModes(
  modes: readonly KickAssemblerAddressingModeInfo[]
): KickAssemblerAddressingModeInfo[] {
  const deduped = new Map<string, KickAssemblerAddressingModeInfo>();
  for (const entry of modes) {
    deduped.set(`${entry.mode}:${entry.operand}`, entry);
  }
  return [...deduped.values()];
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
