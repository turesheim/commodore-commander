export const COMMODORE_MACHINE_PROFILE_IDS = [
  'c64',
  'c128',
  'vic20',
  'plus4',
  'c16',
  'pet',
  'cbm2',
  'cbm5x0',
  'c64dtv'
] as const;

export type CommodoreMachineProfileId =
  (typeof COMMODORE_MACHINE_PROFILE_IDS)[number];

export type CommodoreMemoryRegionKind =
  | 'ram'
  | 'rom'
  | 'io'
  | 'color-ram'
  | 'screen-ram'
  | 'character-rom'
  | 'cartridge'
  | 'expansion'
  | 'reserved'
  | 'banked'
  | 'banking'
  | 'cpu-port'
  | 'vectors';

export type CommodoreRomSymbolModule =
  | 'basic'
  | 'kernal'
  | 'editor'
  | 'monitor'
  | 'io'
  | 'banking'
  | 'rom';

export interface CommodoreAddressRange {
  start: number;
  end: number;
  name: string;
  kind: CommodoreMemoryRegionKind;
  description?: string;
  bank?: string;
}

export interface CommodoreMemoryMap {
  id: string;
  name: string;
  regions: readonly CommodoreAddressRange[];
  notes?: readonly string[];
}

export interface CommodoreIoRegister {
  start: number;
  end: number;
  id?: string;
  name: string;
  chip: string;
  access?: 'read' | 'write' | 'read-write' | 'mixed';
  description?: string;
  bits?: readonly string[];
}

export interface CommodoreRomImage {
  id: string;
  name: string;
  start: number;
  end: number;
  module: CommodoreRomSymbolModule;
  viceResource?: string;
  description?: string;
}

export interface CommodoreRomSymbol {
  name: string;
  address: number;
  module: CommodoreRomSymbolModule;
  description: string;
  aliases?: readonly string[];
}

export interface CommodoreZeroPageConvention {
  start: number;
  end: number;
  name: string;
  description: string;
}

export interface CommodoreScreenLayout {
  id: string;
  name: string;
  columns: number;
  rows: number;
  screenAddress?: number;
  colorAddress?: number;
  bitmapAddress?: number;
  characterCell: {
    width: number;
    height: number;
  };
  description?: string;
}

export interface CommodoreCharacterSet {
  id: string;
  name: string;
  glyphCount: number;
  bytesPerGlyph: number;
  romAddress?: number;
  ramAddress?: number;
  viceResource?: string;
  description?: string;
}

export interface CommodoreBankSwitchingRule {
  id: string;
  name: string;
  controller: string;
  description: string;
  affectedRanges: readonly CommodoreAddressRange[];
  registers?: readonly number[];
}

export interface CommodoreCpuDetails {
  primary: string;
  instructionSet: string;
  clock: string;
  ioPort?: {
    dataDirection: number;
    data: number;
    description: string;
  };
  secondary?: readonly {
    name: string;
    instructionSet: string;
    clock: string;
    description: string;
  }[];
  notes?: readonly string[];
}

export interface CommodoreViceRuntime {
  executable: string;
  resourceDirectory: string;
  defaultArgs?: readonly string[];
  defaultModel?: string;
  models?: readonly CommodoreViceModel[];
  description?: string;
}

export interface CommodoreViceModel {
  id: string;
  displayName: string;
  description?: string;
}

export interface CommodoreMachineLaunchConfiguration {
  profile: CommodoreMachineProfileId;
  model?: string;
  viceArgs?: readonly string[];
}

export interface CommodoreMachineProfile {
  id: CommodoreMachineProfileId;
  displayName: string;
  family: string;
  aliases: readonly string[];
  description: string;
  cpu: CommodoreCpuDetails;
  memoryMaps: readonly CommodoreMemoryMap[];
  ioRegisters: readonly CommodoreIoRegister[];
  roms: readonly CommodoreRomImage[];
  romSymbols: readonly CommodoreRomSymbol[];
  zeroPage: readonly CommodoreZeroPageConvention[];
  screenLayouts: readonly CommodoreScreenLayout[];
  characterSets: readonly CommodoreCharacterSet[];
  bankSwitching: readonly CommodoreBankSwitchingRule[];
  vice: CommodoreViceRuntime;
  sourceNotes: readonly string[];
}

export const DEFAULT_COMMODORE_MACHINE_PROFILE_ID: CommodoreMachineProfileId =
  'c64';

type ViceVideoChipName = 'VICII' | 'TED' | 'VIC' | 'VDC' | 'Crtc';

function unfilteredViceVideoArgs(
  ...chips: readonly ViceVideoChipName[]
): string[] {
  const args: string[] = [];
  for (const chip of chips) {
    args.push(`-${chip}filter`, '0', `-${chip}glfilter`, '0');
  }
  return args;
}

const COMMON_KERNAL_SYMBOLS: readonly CommodoreRomSymbol[] = [
  kernal('CINT', 0xff81, 'Initialize screen editor and video hardware.'),
  kernal('IOINIT', 0xff84, 'Initialize I/O devices, ports, and timers.'),
  kernal('RAMTAS', 0xff87, 'Test RAM and initialize system memory pointers.'),
  kernal('RESTOR', 0xff8a, 'Restore default indirect I/O vectors.'),
  kernal('VECTOR', 0xff8d, 'Read or replace indirect I/O vectors.'),
  kernal('SETMSG', 0xff90, 'Control operating system messages.'),
  kernal('SECOND', 0xff93, 'Send secondary address after LISTEN.'),
  kernal('TKSA', 0xff96, 'Send secondary address after TALK.'),
  kernal('MEMTOP', 0xff99, 'Read or set top of available memory.'),
  kernal('MEMBOT', 0xff9c, 'Read or set bottom of available memory.'),
  kernal('SCNKEY', 0xff9f, 'Scan the keyboard.'),
  kernal('SETTMO', 0xffa2, 'Set serial/IEEE timeout behavior.'),
  kernal('ACPTR', 0xffa5, 'Receive a byte from the serial or IEEE bus.'),
  kernal('CIOUT', 0xffa8, 'Transmit a byte on the serial or IEEE bus.'),
  kernal('UNTLK', 0xffab, 'Send UNTALK.'),
  kernal('UNLSN', 0xffae, 'Send UNLISTEN.'),
  kernal('LISTEN', 0xffb1, 'Command a device to listen.'),
  kernal('TALK', 0xffb4, 'Command a device to talk.'),
  kernal('READST', 0xffb7, 'Read the I/O status byte.'),
  kernal('SETLFS', 0xffba, 'Set logical file, device, and secondary address.'),
  kernal('SETNAM', 0xffbd, 'Set the current filename pointer and length.'),
  kernal('OPEN', 0xffc0, 'Open a logical file.'),
  kernal('CLOSE', 0xffc3, 'Close a logical file.'),
  kernal('CHKIN', 0xffc6, 'Open channel for input.'),
  kernal('CHKOUT', 0xffc9, 'Open channel for output.'),
  kernal('CLRCHN', 0xffcc, 'Restore default I/O channels.'),
  kernal('CHRIN', 0xffcf, 'Input one character from the active channel.'),
  kernal('CHROUT', 0xffd2, 'Output one character to the active channel.'),
  kernal('LOAD', 0xffd5, 'Load memory from a device.'),
  kernal('SAVE', 0xffd8, 'Save memory to a device.'),
  kernal('SETTIM', 0xffdb, 'Set the software clock.'),
  kernal('RDTIM', 0xffde, 'Read the software clock.'),
  kernal('STOP', 0xffe1, 'Test whether STOP is pressed.'),
  kernal('GETIN', 0xffe4, 'Get a character from the keyboard queue.'),
  kernal('CLALL', 0xffe7, 'Close all files and channels.'),
  kernal('UDTIM', 0xffea, 'Update the software clock.'),
  kernal('SCREEN', 0xffed, 'Return screen rows and columns.'),
  kernal('PLOT', 0xfff0, 'Read or set cursor row and column.'),
  kernal('IOBASE', 0xfff3, 'Return the base address of I/O devices.')
];

const C64_BASIC_SYMBOLS: readonly CommodoreRomSymbol[] = [
  basic('BASIC_RESTART', 0xa000, 'BASIC cold restart entry.'),
  basic('BASIC_COMMAND_VECTORS', 0xa00c, 'BASIC command dispatch table.'),
  basic('BASIC_FUNCTION_VECTORS', 0xa052, 'BASIC function dispatch table.'),
  basic('BASIC_ERROR_TABLE', 0xa19e, 'BASIC error message table.'),
  basic('BASIC_READY', 0xa474, 'BASIC ready prompt restart.'),
  basic('BASIC_MAIN', 0xa480, 'Input and execute BASIC line.'),
  basic('BASIC_LIST', 0xa69c, 'LIST command implementation.'),
  basic('BASIC_RUN', 0xa871, 'RUN command implementation.'),
  basic('BASIC_GOTO', 0xa8a0, 'GOTO command implementation.'),
  basic('BASIC_PRINT', 0xaaa0, 'PRINT command implementation.')
];

const C64_VICE_MODELS: readonly CommodoreViceModel[] = [
  model('c64', 'C64 PAL'),
  model('c64c', 'C64C PAL'),
  model('c64old', 'C64 old PAL'),
  model('ntsc', 'C64 NTSC'),
  model('newntsc', 'C64 new NTSC'),
  model('oldntsc', 'C64 old NTSC'),
  model('drean', 'Drean C64'),
  model('jap', 'Japanese C64'),
  model('c64gs', 'C64 Games System'),
  model('pet64', 'PET 64'),
  model('ultimax', 'Ultimax')
];

const C128_VICE_MODELS: readonly CommodoreViceModel[] = [
  model('c128', 'C128 PAL'),
  model('c128dcr', 'C128DCR PAL'),
  model('pal', 'C128 PAL'),
  model('ntsc', 'C128 NTSC')
];

const VIC20_VICE_MODELS: readonly CommodoreViceModel[] = [
  model('vic20', 'VIC-20 PAL'),
  model('vic20pal', 'VIC-20 PAL'),
  model('vic20ntsc', 'VIC-20 NTSC'),
  model('vic21', 'VIC-21')
];

const TED_VICE_MODELS: readonly CommodoreViceModel[] = [
  model('c16', 'C16 PAL'),
  model('c16pal', 'C16 PAL'),
  model('c16ntsc', 'C16 NTSC'),
  model('plus4', 'Plus/4 PAL'),
  model('plus4pal', 'Plus/4 PAL'),
  model('plus4ntsc', 'Plus/4 NTSC'),
  model('v364', 'V364'),
  model('cv364', 'V364'),
  model('c232', 'C232')
];

const PET_VICE_MODELS: readonly CommodoreViceModel[] = [
  model('2001', 'PET 2001'),
  model('3008', 'PET 3008'),
  model('3016', 'PET 3016'),
  model('3032', 'PET 3032'),
  model('3032B', 'PET 3032B'),
  model('4016', 'PET 4016'),
  model('4032', 'PET 4032'),
  model('4032B', 'PET 4032B'),
  model('8032', 'PET 8032'),
  model('8096', 'PET 8096'),
  model('8296', 'PET 8296'),
  model('SuperPET', 'SuperPET')
];

const CBM2_VICE_MODELS: readonly CommodoreViceModel[] = [
  model('610', 'CBM-II 610'),
  model('620', 'CBM-II 620'),
  model('620+', 'CBM-II 620+'),
  model('710', 'CBM-II 710'),
  model('720', 'CBM-II 720'),
  model('720+', 'CBM-II 720+')
];

const CBM5X0_VICE_MODELS: readonly CommodoreViceModel[] = [
  model('510', 'CBM-II 510')
];

const C64DTV_VICE_MODELS: readonly CommodoreViceModel[] = [
  model('v2', 'C64DTV v2 PAL'),
  model('v2pal', 'C64DTV v2 PAL'),
  model('v2ntsc', 'C64DTV v2 NTSC'),
  model('v3', 'C64DTV v3 PAL'),
  model('v3pal', 'C64DTV v3 PAL'),
  model('v3ntsc', 'C64DTV v3 NTSC'),
  model('hummer', 'Hummer')
];

const C128_EXTENDED_SYMBOLS: readonly CommodoreRomSymbol[] = [
  kernal('JSPIN_SPOUT', 0xff47, 'Fast serial input/output setup.'),
  kernal('JCLOSE_ALL', 0xff4a, 'Close all files on a device.'),
  kernal('JC64_MODE', 0xff4d, 'Switch to C64 mode.'),
  kernal('JDMA_CALL', 0xff50, 'Invoke the C128 DMA service.'),
  kernal('JBOOT_CALL', 0xff53, 'Boot from disk.'),
  kernal('JLKUPLA', 0xff59, 'Look up logical address.'),
  kernal('JLKUPSA', 0xff5c, 'Look up secondary address.'),
  kernal('JSWAPPER', 0xff5f, 'Switch 40/80 column output.'),
  kernal('JDLCHR', 0xff62, 'Initialize 80-column character RAM.'),
  kernal('JPFKEY', 0xff65, 'Program a function key.'),
  kernal('JSETBNK', 0xff68, 'Set load/save banks.'),
  kernal('JSETCFG', 0xff6b, 'Set MMU configuration.'),
  kernal('JJSRFAR', 0xff6e, 'Call a routine in another bank.'),
  kernal('JJMPFAR', 0xff71, 'Jump to a routine in another bank.'),
  kernal('JINDFET', 0xff74, 'Fetch byte indirectly from another bank.'),
  kernal('JINDSTA', 0xff77, 'Store byte indirectly into another bank.'),
  kernal('JINDCMP', 0xff7a, 'Compare byte indirectly in another bank.'),
  kernal('JPRIMM', 0xff7d, 'Print inline string.')
];

const C128_BASIC_SYMBOLS: readonly CommodoreRomSymbol[] = [
  basic('BASIC7_COLD_ENTRY', 0x4000, 'BASIC 7.0 cold entry jump.'),
  basic('BASIC7_WARM_ENTRY', 0x4003, 'BASIC 7.0 warm entry jump.'),
  basic('BASIC7_RESTART', 0x4009, 'BASIC 7.0 restart.'),
  basic('BASIC7_COMMAND_TABLE', 0x4417, 'BASIC 7.0 keyword table.'),
  basic('BASIC7_ACTION_VECTORS', 0x46fc, 'BASIC 7.0 command action vectors.'),
  monitor('MONITOR_ENTRY', 0xb000, 'C128 machine language monitor entry.')
];

const VIC20_BASIC_SYMBOLS: readonly CommodoreRomSymbol[] = [
  basic('BASIC_RESTART', 0xc000, 'BASIC 2.0 restart vectors.'),
  basic('BASIC_COMMAND_VECTORS', 0xc00c, 'BASIC command dispatch table.'),
  basic('BASIC_READY', 0xc474, 'BASIC ready prompt restart.'),
  basic('BASIC_MAIN', 0xc480, 'Input and execute BASIC line.'),
  basic('BASIC_LIST', 0xc69c, 'LIST command implementation.'),
  basic('BASIC_RUN', 0xc871, 'RUN command implementation.')
];

const TED_BASIC_SYMBOLS: readonly CommodoreRomSymbol[] = [
  basic('BASIC35_COLD_START', 0x8000, 'BASIC 3.5 cold start.'),
  basic('BASIC35_WARM_START', 0x8003, 'BASIC 3.5 warm start.'),
  basic('BASIC35_INIT', 0x802e, 'Initialize BASIC 3.5.'),
  basic('BASIC35_COMMAND_TABLE', 0x814d, 'BASIC 3.5 keyword table.'),
  monitor('TED_MONITOR', 0xd4ba, 'TED machine language monitor command loop.'),
  banking('TED_PHOENIX', 0xfcf4, 'ROM banking PHOENIX routine.'),
  banking('TED_LONG_FETCH', 0xfcf7, 'Long fetch across ROM banks.'),
  banking('TED_LONG_JUMP', 0xfcfa, 'Long jump across ROM banks.')
];

const PET_8032_SYMBOLS: readonly CommodoreRomSymbol[] = [
  basic('BASIC4_COMMAND_VECTORS', 0xb000, 'BASIC 4.0 command vectors.'),
  basic('BASIC4_FUNCTION_VECTORS', 0xb066, 'BASIC 4.0 function vectors.'),
  basic('BASIC4_READY', 0xb3ff, 'BASIC ready prompt restart.'),
  basic('BASIC4_MAIN', 0xb406, 'Input and execute BASIC line.'),
  basic('BASIC4_LIST', 0xb630, 'LIST command implementation.'),
  basic('BASIC4_RUN', 0xb808, 'RUN command implementation.'),
  kernal('PET_OPEN', 0xffc0, 'PET OPEN vector.'),
  kernal('PET_CLOSE', 0xffc3, 'PET CLOSE vector.'),
  kernal('PET_CHKIN', 0xffc6, 'PET CHKIN vector.'),
  kernal('PET_CHKOUT', 0xffc9, 'PET CHKOUT vector.'),
  kernal('PET_CLRCH', 0xffcc, 'PET restore I/O vector.'),
  kernal('PET_CHROUT', 0xffd2, 'PET output vector.'),
  kernal('PET_LOAD', 0xffd5, 'PET LOAD vector.'),
  kernal('PET_SAVE', 0xffd8, 'PET SAVE vector.'),
  kernal('PET_GETIN', 0xffe4, 'PET keyboard input vector.')
];

const CBM2_SYMBOLS: readonly CommodoreRomSymbol[] = [
  basic('BASIC4_ROM_LOW', 0x8000, 'CBM-II BASIC 4.0 low ROM entry area.'),
  basic('BASIC4_ROM_HIGH', 0xa000, 'CBM-II BASIC 4.0 high ROM entry area.'),
  kernal('CBM2_KERNAL_ROM', 0xe000, 'CBM-II KERNAL ROM entry area.'),
  kernal('CBM2_KERNAL_JUMP_TABLE', 0xff81, 'Standard Commodore KERNAL jump table area.'),
  banking('CBM2_EXECUTION_BANK', 0x0000, 'MOS 6509 execution-bank register.'),
  banking('CBM2_INDIRECT_BANK', 0x0001, 'MOS 6509 indirect-bank register.')
];

const C64_ZERO_PAGE: readonly CommodoreZeroPageConvention[] = [
  zp(0x0000, 0x0000, 'D6510', '6510 data-direction register.'),
  zp(0x0001, 0x0001, 'R6510', '6510 processor port and memory banking lines.'),
  zp(0x002b, 0x002c, 'TXTTAB', 'Start of BASIC text, normally $0801.'),
  zp(0x0037, 0x0038, 'MEMSIZ', 'Highest address available to BASIC.'),
  zp(0x0073, 0x008a, 'CHRGET', 'BASIC CHRGET routine copied to zero page.'),
  zp(0x0090, 0x0090, 'STATUS', 'KERNAL I/O status word ST.'),
  zp(0x00a0, 0x00a2, 'TIME', 'Three-byte jiffy clock.'),
  zp(0x00b7, 0x00bd, 'FILENAME_IO', 'Filename length, logical file, device, and filename pointer.'),
  zp(0x00c5, 0x00c6, 'KEYBOARD_STATE', 'Last key and keyboard-buffer count.'),
  zp(0x00d1, 0x00d3, 'SCREEN_CURSOR', 'Current screen line pointer and cursor column.'),
  zp(0x00fb, 0x00fe, 'FREE_ZERO_PAGE', 'Zero-page bytes normally free for user code.')
];

const TED_ZERO_PAGE: readonly CommodoreZeroPageConvention[] = [
  zp(0x0000, 0x0000, 'PDIR', '7501/8501 data-direction register.'),
  zp(0x0001, 0x0001, 'PORT', '7501/8501 processor port for serial and tape control.'),
  zp(0x002b, 0x002c, 'TXTTAB', 'Start of BASIC text.'),
  zp(0x0037, 0x0038, 'MEMSIZ', 'Highest address used by BASIC.'),
  zp(0x0061, 0x0066, 'FAC1', 'Floating-point accumulator 1.'),
  zp(0x0083, 0x0086, 'GRAPHICS_STATE', 'Current graphics mode and selected colors.'),
  zp(0x0090, 0x0090, 'STATUS', 'KERNAL I/O status word ST.'),
  zp(0x00a3, 0x00a5, 'TIME', 'Three-byte jiffy clock.'),
  zp(0x00c8, 0x00ca, 'SCREEN_CURSOR', 'Current screen line pointer and cursor column.'),
  zp(0x00fb, 0x00fb, 'CURBNK', 'Current ROM/RAM bank configuration.')
];

const PET_ZERO_PAGE: readonly CommodoreZeroPageConvention[] = [
  zp(0x0000, 0x0002, 'USR', 'USR jump instruction and target address.'),
  zp(0x0028, 0x0029, 'TXTTAB', 'Start of BASIC text, normally $0401.'),
  zp(0x0034, 0x0035, 'MEMSIZ', 'Highest address used by BASIC.'),
  zp(0x0070, 0x0087, 'CHRGET', 'BASIC CHRGET routine.'),
  zp(0x008d, 0x008f, 'TIME', 'Three-byte jiffy clock.'),
  zp(0x0090, 0x0095, 'INTERRUPT_VECTORS', 'IRQ, BRK, and NMI vectors.'),
  zp(0x0096, 0x0096, 'STATUS', 'KERNAL I/O status word ST.'),
  zp(0x00c4, 0x00c6, 'SCREEN_CURSOR', 'Current screen line pointer and cursor column.'),
  zp(0x00d2, 0x00d4, 'FILE_STATE', 'Current logical file, secondary address, and device.')
];

const C64_MEMORY_MAP: readonly CommodoreAddressRange[] = [
  r(0x0000, 0x0001, '6510 CPU port', 'cpu-port', 'Processor I/O and ROM banking control.'),
  r(0x0002, 0x03ff, 'System, BASIC, and KERNAL RAM', 'ram'),
  r(0x0400, 0x07ff, 'Default screen matrix', 'screen-ram'),
  r(0x0800, 0x9fff, 'BASIC program RAM', 'ram'),
  r(0xa000, 0xbfff, 'BASIC ROM or RAM', 'banked'),
  r(0xc000, 0xcfff, 'RAM', 'ram'),
  r(0xd000, 0xdfff, 'I/O, color RAM, character ROM, or RAM', 'banked'),
  r(0xe000, 0xffff, 'KERNAL ROM or RAM', 'banked')
];

const C64_IO_REGISTERS: readonly CommodoreIoRegister[] = [
  io(0x0000, 0x0000, 'D6510', '6510 data-direction register', 'MOS 6510', 'read-write'),
  io(0x0001, 0x0001, 'R6510', '6510 processor port', 'MOS 6510', 'read-write', [
    'bit 0: /LORAM',
    'bit 1: /HIRAM',
    'bit 2: /CHAREN',
    'bits 3-5: cassette output, sense, motor'
  ]),
  io(0xd000, 0xd02e, 'VICII', 'VIC-II video registers', 'MOS 6567/6569 VIC-II', 'mixed'),
  io(0xd400, 0xd41c, 'SID', 'SID voice, filter, paddle, and oscillator registers', 'MOS 6581/8580 SID', 'mixed'),
  io(0xd800, 0xdbff, 'COLOR_RAM', '4-bit color RAM', 'Color RAM', 'read-write'),
  io(0xdc00, 0xdc0f, 'CIA1', 'Keyboard, joystick, timers, and IRQ control', 'MOS 6526 CIA #1', 'mixed'),
  io(0xdd00, 0xdd0f, 'CIA2', 'Serial bus, user port, VIC bank, timers, and NMI control', 'MOS 6526 CIA #2', 'mixed'),
  io(0xde00, 0xdeff, 'IO1', 'Cartridge I/O 1 expansion window', 'Expansion', 'mixed'),
  io(0xdf00, 0xdfff, 'IO2', 'Cartridge I/O 2 expansion window', 'Expansion', 'mixed')
];

const C64_ROMS: readonly CommodoreRomImage[] = [
  rom('basic', 'BASIC 2.0 ROM', 0xa000, 0xbfff, 'basic', 'C64/basic-901226-01.bin'),
  rom('character', 'Character ROM', 0xd000, 0xdfff, 'rom', 'C64/chargen-901225-01.bin'),
  rom('kernal', 'KERNAL ROM', 0xe000, 0xffff, 'kernal', 'C64/kernal-901227-03.bin')
];

const C64_SCREEN_LAYOUTS: readonly CommodoreScreenLayout[] = [
  screen('text-40x25', '40-column text screen', 40, 25, 0x0400, 0xd800, undefined, 'Default C64 text matrix and color RAM.'),
  screen('bitmap-320x200', '320x200 bitmap graphics', 40, 25, 0x0400, 0xd800, 0x2000, 'VIC-II bitmap data is selected inside the active VIC bank.')
];

const C64_CHARACTER_SETS: readonly CommodoreCharacterSet[] = [
  charset('upper-graphics', 'Uppercase/graphics character ROM', 256, 8, 0xd000, undefined, 'C64/chargen-901225-01.bin'),
  charset('lower-upper', 'Lowercase/uppercase character ROM', 256, 8, 0xd800, undefined, 'C64/chargen-901225-01.bin')
];

export const COMMODORE_MACHINE_PROFILES: readonly CommodoreMachineProfile[] =
  Object.freeze([
    {
      id: 'c64',
      displayName: 'Commodore 64',
      family: 'C64',
      aliases: ['commodore-64', 'c-64', 'x64sc', 'x64'],
      description: 'C64 profile with 6510 banking, VIC-II, SID, CIAs, BASIC 2.0, and KERNAL symbols.',
      cpu: {
        primary: 'MOS 6510',
        instructionSet: '6502 with 6510 I/O port',
        clock: 'Approximately 1 MHz, PAL or NTSC',
        ioPort: {
          dataDirection: 0x0000,
          data: 0x0001,
          description: 'Controls cassette lines and BASIC/KERNAL/character ROM visibility.'
        }
      },
      memoryMaps: [
        {
          id: 'default',
          name: 'Default 64K CPU address map',
          regions: C64_MEMORY_MAP
        }
      ],
      ioRegisters: C64_IO_REGISTERS,
      roms: C64_ROMS,
      romSymbols: [...C64_BASIC_SYMBOLS, ...COMMON_KERNAL_SYMBOLS],
      zeroPage: C64_ZERO_PAGE,
      screenLayouts: C64_SCREEN_LAYOUTS,
      characterSets: C64_CHARACTER_SETS,
      bankSwitching: [
        {
          id: '6510-port',
          name: '6510 $0001 ROM and I/O banking',
          controller: 'MOS 6510 processor port',
          description: 'LORAM, HIRAM, and CHAREN select BASIC ROM, KERNAL ROM, I/O, character ROM, or RAM in the $A000-$BFFF, $D000-$DFFF, and $E000-$FFFF windows.',
          registers: [0x0000, 0x0001],
          affectedRanges: [
            r(0xa000, 0xbfff, 'BASIC ROM/RAM window', 'banked'),
            r(0xd000, 0xdfff, 'I/O/character/RAM window', 'banked'),
            r(0xe000, 0xffff, 'KERNAL ROM/RAM window', 'banked')
          ]
        },
        {
          id: 'vic-bank',
          name: 'VIC-II 16K video bank',
          controller: 'CIA #2 port A bits 0-1 at $DD00',
          description: 'Selects the 16K RAM bank visible to VIC-II fetches; $D018 selects screen and character bases inside that bank.',
          registers: [0xdd00, 0xd018],
          affectedRanges: [r(0x0000, 0xffff, 'VIC-visible RAM bank selection', 'banked')]
        }
      ],
      vice: {
        executable: 'x64sc',
        resourceDirectory: 'C64',
        defaultArgs: unfilteredViceVideoArgs('VICII'),
        defaultModel: 'c64',
        models: C64_VICE_MODELS,
        description: 'Accurate C64 emulator.'
      },
      sourceNotes: [
        'Preserves the existing c64io.xml scope.',
        'VICE ships C64 ROM and c64mem.sym assets under share/vice/C64.'
      ]
    },
    {
      id: 'c128',
      displayName: 'Commodore 128',
      family: 'C128',
      aliases: ['commodore-128', 'c-128', 'x128'],
      description: 'C128 native-mode profile with 8502/Z80 CPUs, MMU banking, VIC-IIe, VDC, SID, BASIC 7.0, monitor, and extended KERNAL symbols.',
      cpu: {
        primary: 'MOS 8502',
        instructionSet: '6502-compatible with 2 MHz mode and processor port',
        clock: '1 MHz in C64-compatible/VIC-II display timing; 2 MHz available in native modes',
        ioPort: {
          dataDirection: 0x0000,
          data: 0x0001,
          description: 'C128/C64 mode processor port; C64 mode preserves 6510-style ROM controls.'
        },
        secondary: [
          {
            name: 'Zilog Z80',
            instructionSet: 'Z80',
            clock: 'Nominal 4 MHz, effectively constrained by shared bus timing',
            description: 'Used for CP/M startup and CP/M execution.'
          }
        ],
        notes: ['MMU registers can relocate zero page and stack.']
      },
      memoryMaps: [
        {
          id: 'native-bank0',
          name: 'Native mode bank 0 default configuration',
          regions: [
            r(0x0000, 0x3fff, 'RAM bank 0', 'ram', undefined, 'bank 0'),
            r(0x4000, 0x7fff, 'BASIC 7.0 ROM low or RAM', 'banked'),
            r(0x8000, 0xafff, 'BASIC 7.0 ROM high or RAM', 'banked'),
            r(0xb000, 0xbfff, 'Machine language monitor ROM or RAM', 'banked'),
            r(0xc000, 0xcfff, 'Screen editor ROM or RAM', 'banked'),
            r(0xd000, 0xdfff, 'I/O, character ROM, or RAM', 'banked'),
            r(0xe000, 0xffff, 'C128 KERNAL ROM or RAM', 'banked')
          ],
          notes: ['The 8722 MMU configuration register chooses RAM bank and ROM visibility.']
        },
        {
          id: 'ram-bank1',
          name: 'Second 64K RAM bank',
          regions: [r(0x0000, 0xffff, 'RAM bank 1', 'ram', 'Second 64K RAM bank selected through the MMU.', 'bank 1')]
        }
      ],
      ioRegisters: [
        ...C64_IO_REGISTERS,
        io(0xd030, 0xd030, 'VICIIE_SPEED', '2 MHz mode control', 'MOS 8564/8566 VIC-IIe', 'read-write'),
        io(0xd500, 0xd50b, 'MMU', '8722 memory management registers', 'MOS 8722 MMU', 'mixed'),
        io(0xd600, 0xd601, 'VDC', '8563/8568 VDC address/data registers', 'MOS 8563/8568 VDC', 'mixed'),
        io(0xdf00, 0xdf0a, 'REU_DMA', '8726 DMA/REU register window', 'MOS 8726 DMA', 'mixed'),
        io(0xff00, 0xff05, 'MMU_PRECONFIG', 'MMU preconfiguration registers', 'MOS 8722 MMU', 'mixed')
      ],
      roms: [
        rom('basic-lo', 'BASIC 7.0 low ROM', 0x4000, 0x7fff, 'basic', 'C128/basiclo-318018-04.bin'),
        rom('basic-hi', 'BASIC 7.0 high ROM', 0x8000, 0xafff, 'basic', 'C128/basichi-318019-04.bin'),
        rom('monitor', 'Machine language monitor ROM', 0xb000, 0xbfff, 'monitor'),
        rom('editor', 'C128 screen editor ROM', 0xc000, 0xcfff, 'editor'),
        rom('character', 'C128 character ROM', 0xd000, 0xdfff, 'rom', 'C128/chargen-325167-02.bin'),
        rom('kernal', 'C128 KERNAL ROM', 0xe000, 0xffff, 'kernal', 'C128/kernal-318020-05.bin'),
        rom('c64-basic', 'C64 mode BASIC ROM', 0xa000, 0xbfff, 'basic', 'C128/basic64-901226-01.bin'),
        rom('c64-kernal', 'C64 mode KERNAL ROM', 0xe000, 0xffff, 'kernal', 'C128/kernal64-901227-03.bin')
      ],
      romSymbols: [...C128_BASIC_SYMBOLS, ...C128_EXTENDED_SYMBOLS, ...COMMON_KERNAL_SYMBOLS],
      zeroPage: [
        ...C64_ZERO_PAGE,
        zp(0x0002, 0x0002, 'BANK_NUMBER', 'Bank number used by SYS and far-call helpers.'),
        zp(0x02a2, 0x02fb, 'BANKING_HELPERS', 'C128 RAM-resident bank peek, poke, compare, JSR, JMP, and DMA helper code.')
      ],
      screenLayouts: [
        screen('vic-40x25', 'VIC-IIe 40-column text screen', 40, 25, 0x0400, 0xd800, undefined, '40-column display compatible with the VIC-II family.'),
        screen('vdc-80x25', 'VDC 80-column text screen', 80, 25, 0x0000, undefined, undefined, '80-column screen lives in dedicated VDC RAM and is accessed through $D600/$D601.')
      ],
      characterSets: [
        charset('c128-character-rom', 'C128 character ROM', 512, 8, 0xd000, undefined, 'C128/chargen-325167-02.bin'),
        charset('vdc-character-ram', 'VDC character RAM', 512, 16, undefined, 0x2000, undefined, 'Downloaded to dedicated VDC RAM for 80-column display.')
      ],
      bankSwitching: [
        {
          id: 'mmu-configuration',
          name: '8722 MMU configuration register',
          controller: 'MMU $D500 and preconfiguration $FF00-$FF04',
          description: 'Selects RAM bank, internal/external ROM, I/O, character ROM, BASIC, editor, monitor, and KERNAL visibility across the 64K CPU map.',
          registers: [0xd500, 0xff00, 0xff01, 0xff02, 0xff03, 0xff04],
          affectedRanges: [
            r(0x4000, 0x7fff, 'Low ROM/RAM window', 'banked'),
            r(0x8000, 0xbfff, 'Middle ROM/RAM window', 'banked'),
            r(0xc000, 0xffff, 'High ROM/RAM/I/O window', 'banked')
          ]
        },
        {
          id: 'zero-stack-relocation',
          name: 'Zero page and stack relocation',
          controller: 'MMU $D507-$D50A',
          description: 'Relocates zero page and stack page within the selected RAM bank.',
          registers: [0xd507, 0xd508, 0xd509, 0xd50a],
          affectedRanges: [
            r(0x0000, 0x00ff, 'Zero page', 'banked'),
            r(0x0100, 0x01ff, 'Stack page', 'banked')
          ]
        }
      ],
      vice: {
        executable: 'x128',
        resourceDirectory: 'C128',
        defaultArgs: unfilteredViceVideoArgs('VICII', 'VDC'),
        defaultModel: 'c128',
        models: C128_VICE_MODELS
      },
      sourceNotes: [
        'C128 I/O differences include MMU $D500-$D50B, VDC $D600-$D601, and preconfiguration $FF00-$FF05.',
        'C128 native KERNAL adds extended entries before the standard $FF81 jump table.'
      ]
    },
    {
      id: 'vic20',
      displayName: 'Commodore VIC-20',
      family: 'VIC-20',
      aliases: ['vic-20', 'commodore-vic-20', 'xvic'],
      description: 'VIC-20 profile with 6502 CPU, VIC video/sound chip, dual VIAs, BASIC 2.0, variable RAM expansion layout, and VIC-specific screen/color memory.',
      cpu: {
        primary: 'MOS 6502',
        instructionSet: '6502',
        clock: 'Approximately 1 MHz, PAL or NTSC'
      },
      memoryMaps: [
        {
          id: 'unexpanded',
          name: 'Unexpanded VIC-20 memory map',
          regions: [
            r(0x0000, 0x03ff, 'Zero page, stack, system RAM, vectors, and cassette buffer', 'ram'),
            r(0x0400, 0x0fff, '3K expansion RAM area', 'expansion'),
            r(0x1000, 0x1dff, 'Default BASIC RAM', 'ram'),
            r(0x1e00, 0x1fff, 'Default screen memory', 'screen-ram'),
            r(0x2000, 0x7fff, '8K expansion RAM/ROM blocks 1-3', 'expansion'),
            r(0x8000, 0x8fff, 'Character generator ROM', 'character-rom'),
            r(0x9000, 0x93ff, 'I/O block 0', 'io'),
            r(0x9400, 0x95ff, 'Color RAM with block-1 expansion', 'color-ram'),
            r(0x9600, 0x97ff, 'Normal color RAM', 'color-ram'),
            r(0x9800, 0x9fff, 'I/O blocks 2-3', 'io'),
            r(0xa000, 0xbfff, 'Expansion ROM block 5', 'cartridge'),
            r(0xc000, 0xdfff, 'BASIC ROM', 'rom'),
            r(0xe000, 0xffff, 'KERNAL ROM', 'rom')
          ]
        }
      ],
      ioRegisters: [
        io(0x9000, 0x900f, 'VIC', 'VIC video, sound, light pen, and color registers', 'MOS 6560/6561 VIC', 'mixed'),
        io(0x9110, 0x911f, 'VIA1', 'User port, serial, cassette, joystick, and timers', 'MOS 6522 VIA #1', 'mixed'),
        io(0x9120, 0x912f, 'VIA2', 'Keyboard, cassette, serial, and system timers', 'MOS 6522 VIA #2', 'mixed')
      ],
      roms: [
        rom('character', 'VIC-20 character ROM', 0x8000, 0x8fff, 'rom', 'VIC20/chargen-901460-03.bin'),
        rom('basic', 'BASIC 2.0 ROM', 0xc000, 0xdfff, 'basic', 'VIC20/basic-901486-01.bin'),
        rom('kernal', 'VIC-20 KERNAL ROM', 0xe000, 0xffff, 'kernal', 'VIC20/kernal.901486-07.bin')
      ],
      romSymbols: [...VIC20_BASIC_SYMBOLS, ...COMMON_KERNAL_SYMBOLS],
      zeroPage: C64_ZERO_PAGE,
      screenLayouts: [
        screen('default-22x23', 'Default 22x23 text screen', 22, 23, 0x1e00, 0x9600, undefined, 'Unexpanded VIC-20 default screen and color RAM.'),
        screen('expanded-22x23', 'Expanded-memory relocated text screen', 22, 23, 0x1000, 0x9400, undefined, 'KERNAL relocation used when RAM is added in block 1.')
      ],
      characterSets: [
        charset('vic20-character-rom', 'VIC-20 character ROM', 512, 8, 0x8000, undefined, 'VIC20/chargen-901460-03.bin')
      ],
      bankSwitching: [
        {
          id: 'expansion-blocks',
          name: 'Expansion RAM/ROM blocks',
          controller: 'VIC-20 expansion port decode',
          description: 'External cartridges and RAM expansions populate the $0400-$0FFF, $2000-$7FFF, and $A000-$BFFF windows; the KERNAL may relocate BASIC and screen memory when low expansion RAM is present.',
          affectedRanges: [
            r(0x0400, 0x0fff, '3K low expansion', 'expansion'),
            r(0x2000, 0x7fff, '8K expansion blocks 1-3', 'expansion'),
            r(0xa000, 0xbfff, '8K expansion block 5', 'cartridge')
          ]
        },
        {
          id: 'vic-addressing',
          name: 'VIC screen and character base registers',
          controller: 'VIC registers $9002, $9003, and $9005',
          description: 'VIC registers select visible columns, rows, video matrix base, and character data base within the VIC address space.',
          registers: [0x9002, 0x9003, 0x9005],
          affectedRanges: [r(0x0000, 0x1fff, 'VIC-visible low memory', 'banked')]
        }
      ],
      vice: {
        executable: 'xvic',
        resourceDirectory: 'VIC20',
        defaultArgs: unfilteredViceVideoArgs('VIC'),
        defaultModel: 'vic20',
        models: VIC20_VICE_MODELS
      },
      sourceNotes: ['VIC-20 memory and I/O data follows the VIC-20 memory-map text preserved by zimmers.net.']
    },
    {
      id: 'plus4',
      displayName: 'Commodore Plus/4',
      family: 'TED',
      aliases: ['plus/4', 'plus-4', 'plus4', 'commodore-plus4', 'xplus4'],
      description: 'Plus/4 profile for the TED series with 7501/8501 CPU, TED video/sound, ACIA/user-port hardware, BASIC 3.5, and ROM bank controls.',
      cpu: {
        primary: 'MOS 7501 or 8501',
        instructionSet: '6502-compatible with integrated I/O port',
        clock: 'Approximately 1.76 MHz PAL or 1.79 MHz NTSC, TED bus dependent',
        ioPort: {
          dataDirection: 0x0000,
          data: 0x0001,
          description: 'Controls serial and cassette lines on TED-series machines.'
        }
      },
      memoryMaps: [
        {
          id: 'default',
          name: 'Plus/4 RAM and ROM map',
          regions: [
            r(0x0000, 0x07ff, 'System RAM and zero page conventions', 'ram'),
            r(0x0800, 0x0bff, 'Text attribute/color RAM', 'color-ram'),
            r(0x0c00, 0x0fff, 'Text video matrix', 'screen-ram'),
            r(0x1000, 0xfd00, 'BASIC RAM without graphics', 'ram'),
            r(0x1800, 0x1bff, 'Bitmap luminance table', 'color-ram'),
            r(0x1c00, 0x1fff, 'Bitmap color table', 'color-ram'),
            r(0x2000, 0x3fff, 'Bitmap graphics data', 'screen-ram'),
            r(0x8000, 0xbfff, 'BASIC 3.5 ROM bank low', 'banked'),
            r(0xc000, 0xcfff, 'BASIC extension ROM area', 'banked'),
            r(0xd000, 0xd7ff, 'Character ROM', 'character-rom'),
            r(0xd800, 0xfbff, 'KERNAL and operating system ROM', 'rom'),
            r(0xfc00, 0xfcff, 'ROM banking routines', 'banking'),
            r(0xfd00, 0xff3f, 'I/O and TED registers', 'io')
          ]
        }
      ],
      ioRegisters: [
        io(0x0000, 0x0001, 'CPU_PORT', '7501/8501 data direction and I/O port', 'MOS 7501/8501', 'read-write'),
        io(0xfd00, 0xfd03, 'ACIA', 'RS-232 ACIA registers', 'MOS 6551A ACIA', 'mixed'),
        io(0xfd10, 0xfd10, 'USER_PIO', 'User-port PIO', 'MOS 6529B PIO', 'read-write'),
        io(0xfd30, 0xfd30, 'KEYBOARD_PIO', 'Keyboard matrix PIO', 'MOS 6529B PIO', 'read-write'),
        io(0xfee0, 0xfeff, 'TCBM_TIA', '1551 TCBM drive interface window', 'MOS 6523A TIA', 'mixed'),
        io(0xff00, 0xff3f, 'TED', 'TED video, sound, timers, IRQ, colors, and bank select registers', 'MOS 7360 TED', 'mixed')
      ],
      roms: [
        rom('basic', 'BASIC 3.5 ROM', 0x8000, 0xbfff, 'basic', 'PLUS4/basic-318006-01.bin'),
        rom('character', 'TED character ROM', 0xd000, 0xd7ff, 'rom'),
        rom('kernal', 'Plus/4 KERNAL ROM', 0xd800, 0xffff, 'kernal', 'PLUS4/kernal-318004-05.bin'),
        rom('banking', 'TED ROM banking routines', 0xfc00, 0xfcff, 'banking')
      ],
      romSymbols: [...TED_BASIC_SYMBOLS, ...COMMON_KERNAL_SYMBOLS],
      zeroPage: TED_ZERO_PAGE,
      screenLayouts: [
        screen('text-40x25', '40x25 TED text screen', 40, 25, 0x0c00, 0x0800, undefined, 'Default text matrix and attribute/color bytes.'),
        screen('bitmap-320x200', '320x200 TED bitmap screen', 40, 25, 0x0c00, 0x1c00, 0x2000, 'BASIC graphics mode uses luminance, color, and bitmap areas.')
      ],
      characterSets: [
        charset('ted-character-rom', 'TED character ROM', 256, 8, 0xd000, undefined, undefined)
      ],
      bankSwitching: [
        {
          id: 'ted-rom-ram-select',
          name: 'TED ROM/RAM select',
          controller: 'TED $FF3E and $FF3F',
          description: 'Writes to $FF3E select ROM visibility; writes to $FF3F select RAM visibility for the banked ROM areas.',
          registers: [0xff3e, 0xff3f],
          affectedRanges: [
            r(0x8000, 0xbfff, 'BASIC ROM low or RAM', 'banked'),
            r(0xc000, 0xffff, 'Extension, character, KERNAL, I/O, or RAM', 'banked')
          ]
        },
        {
          id: 'function-roms',
          name: 'Function ROM banking',
          controller: 'TED-series ROM select latches',
          description: 'Internal 3-plus-1 and external function ROM banks can be selected through the TED banking routines and latch area.',
          registers: [0xfcf4, 0xfcf7, 0xfcfa],
          affectedRanges: [r(0x8000, 0xffff, 'Function ROM/RAM windows', 'banked')]
        }
      ],
      vice: {
        executable: 'xplus4',
        resourceDirectory: 'PLUS4',
        defaultArgs: [...unfilteredViceVideoArgs('TED'), '-model', 'plus4'],
        defaultModel: 'plus4',
        models: TED_VICE_MODELS
      },
      sourceNotes: ['Plus/4 and C16 memory/I/O maps are shared TED-series references with Plus/4-only ACIA and user-port hardware marked separately.']
    },
    {
      id: 'c16',
      displayName: 'Commodore 16',
      family: 'TED',
      aliases: ['commodore-16', 'c-16'],
      description: 'C16 profile for the TED series with 16K RAM, BASIC 3.5 ROM, TED video/sound, and C16-specific VICE model selection.',
      cpu: {
        primary: 'MOS 7501 or 8501',
        instructionSet: '6502-compatible with integrated I/O port',
        clock: 'Approximately 1.76 MHz PAL or 1.79 MHz NTSC, TED bus dependent',
        ioPort: {
          dataDirection: 0x0000,
          data: 0x0001,
          description: 'Controls serial and cassette lines on TED-series machines.'
        }
      },
      memoryMaps: [
        {
          id: 'default',
          name: 'C16 16K RAM and TED ROM map',
          regions: [
            r(0x0000, 0x3fff, '16K RAM, including zero page, screen, color, and BASIC RAM', 'ram'),
            r(0x0800, 0x0bff, 'Text attribute/color RAM', 'color-ram'),
            r(0x0c00, 0x0fff, 'Text video matrix', 'screen-ram'),
            r(0x1000, 0x3fff, 'Default BASIC RAM area', 'ram'),
            r(0x8000, 0xbfff, 'BASIC 3.5 ROM bank low', 'banked'),
            r(0xc000, 0xcfff, 'BASIC extension ROM area', 'banked'),
            r(0xd000, 0xd7ff, 'Character ROM', 'character-rom'),
            r(0xd800, 0xfbff, 'KERNAL and operating system ROM', 'rom'),
            r(0xfc00, 0xfcff, 'ROM banking routines', 'banking'),
            r(0xfd00, 0xff3f, 'I/O and TED registers', 'io')
          ],
          notes: ['Unlike the Plus/4, the base C16 lacks the built-in ACIA/user-port hardware.']
        }
      ],
      ioRegisters: [
        io(0x0000, 0x0001, 'CPU_PORT', '7501/8501 data direction and I/O port', 'MOS 7501/8501', 'read-write'),
        io(0xfd30, 0xfd30, 'KEYBOARD_PIO', 'Keyboard matrix PIO', 'MOS 6529B PIO', 'read-write'),
        io(0xff00, 0xff3f, 'TED', 'TED video, sound, timers, IRQ, colors, and bank select registers', 'MOS 7360 TED', 'mixed')
      ],
      roms: [
        rom('basic', 'BASIC 3.5 ROM', 0x8000, 0xbfff, 'basic', 'PLUS4/basic-318006-01.bin'),
        rom('character', 'TED character ROM', 0xd000, 0xd7ff, 'rom'),
        rom('kernal', 'C16 KERNAL ROM', 0xd800, 0xffff, 'kernal', 'PLUS4/kernal-318004-05.bin'),
        rom('banking', 'TED ROM banking routines', 0xfc00, 0xfcff, 'banking')
      ],
      romSymbols: [...TED_BASIC_SYMBOLS, ...COMMON_KERNAL_SYMBOLS],
      zeroPage: TED_ZERO_PAGE,
      screenLayouts: [
        screen('text-40x25', '40x25 TED text screen', 40, 25, 0x0c00, 0x0800, undefined, 'Default text matrix and attribute/color bytes.'),
        screen('bitmap-320x200', '320x200 TED bitmap screen', 40, 25, 0x0c00, 0x1c00, 0x2000, 'Graphics modes fit only with reduced BASIC RAM on an unexpanded C16.')
      ],
      characterSets: [
        charset('ted-character-rom', 'TED character ROM', 256, 8, 0xd000, undefined, undefined)
      ],
      bankSwitching: [
        {
          id: 'ted-rom-ram-select',
          name: 'TED ROM/RAM select',
          controller: 'TED $FF3E and $FF3F',
          description: 'Writes to $FF3E select ROM visibility; writes to $FF3F select RAM visibility for the banked ROM areas.',
          registers: [0xff3e, 0xff3f],
          affectedRanges: [
            r(0x8000, 0xbfff, 'BASIC ROM low or RAM', 'banked'),
            r(0xc000, 0xffff, 'Extension, character, KERNAL, I/O, or RAM', 'banked')
          ]
        }
      ],
      vice: {
        executable: 'xplus4',
        resourceDirectory: 'PLUS4',
        defaultArgs: [...unfilteredViceVideoArgs('TED'), '-model', 'c16'],
        defaultModel: 'c16',
        models: TED_VICE_MODELS
      },
      sourceNotes: ['VICE uses the xplus4 executable for C16/C116/Plus/4 models; the profile supplies -model c16.']
    },
    {
      id: 'pet',
      displayName: 'Commodore PET/CBM',
      family: 'PET',
      aliases: ['commodore-pet', 'cbm-pet', 'pet8032', 'xpet'],
      description: 'PET profile centered on BASIC 4.0 8032-class machines with 6502 CPU, 40/80-column screen memory, IEEE-oriented I/O, and PET ROM symbols.',
      cpu: {
        primary: 'MOS 6502',
        instructionSet: '6502',
        clock: 'Approximately 1 MHz'
      },
      memoryMaps: [
        {
          id: 'basic4-8032',
          name: 'PET BASIC 4.0 8032 memory map',
          regions: [
            r(0x0000, 0x03ff, 'System RAM, zero page, stack, vectors, buffers', 'ram'),
            r(0x0400, 0x7fff, 'BASIC program RAM', 'ram'),
            r(0x8000, 0x87ef, 'Screen memory, 40 or 80 column model dependent', 'screen-ram'),
            r(0x9000, 0xafff, 'Optional EPROM space', 'expansion'),
            r(0xb000, 0xdfff, 'BASIC 4.0 ROM', 'rom'),
            r(0xe000, 0xe7ff, 'Screen editor ROM', 'rom'),
            r(0xe800, 0xefff, 'I/O chips', 'io'),
            r(0xf000, 0xffff, 'KERNAL ROM, IEEE, tape, and jump table', 'rom')
          ]
        }
      ],
      ioRegisters: [
        io(0xe800, 0xe80f, 'PIA1', 'Keyboard and IEEE/user I/O PIA window', 'MOS 6520 PIA', 'mixed'),
        io(0xe810, 0xe81f, 'PIA2', 'IEEE, cassette, and diagnostics PIA window', 'MOS 6520 PIA', 'mixed'),
        io(0xe820, 0xe82f, 'VIA', 'Timers, cassette, and IEEE helper I/O', 'MOS 6522 VIA', 'mixed'),
        io(0xe880, 0xe88f, 'CRTC', '6545 CRTC address/data register window on CRTC models', 'MOS 6545 CRTC', 'mixed')
      ],
      roms: [
        rom('basic', 'PET BASIC 4.0 ROM', 0xb000, 0xdfff, 'basic', 'PET/basic-4.901465-23-20-21.bin'),
        rom('editor', 'PET 8032 editor ROM', 0xe000, 0xe7ff, 'editor', 'PET/edit-4-80-b-60Hz.901474-03.bin'),
        rom('kernal', 'PET BASIC 4.0 KERNAL ROM', 0xf000, 0xffff, 'kernal', 'PET/kernal-4.901465-22.bin'),
        rom('character', 'PET character ROM', 0x0000, 0x0fff, 'rom', 'PET/chargen.de')
      ],
      romSymbols: PET_8032_SYMBOLS,
      zeroPage: PET_ZERO_PAGE,
      screenLayouts: [
        screen('pet-40x25', 'PET 40-column text screen', 40, 25, 0x8000, undefined, undefined, '40-column PET screen RAM layout.'),
        screen('pet-80x25', 'PET 80-column text screen', 80, 25, 0x8000, undefined, undefined, '8032-class 80-column screen RAM layout.')
      ],
      characterSets: [
        charset('pet-character-rom', 'PET character generator ROM', 256, 8, undefined, undefined, 'PET/chargen.de')
      ],
      bankSwitching: [
        {
          id: 'base-pet-fixed-map',
          name: 'Base PET fixed memory map',
          controller: 'Board-level decode',
          description: 'Base PET/CBM models use fixed RAM, ROM, screen, and I/O decoding; model selection changes ROM/editor images rather than a runtime bank register.',
          affectedRanges: [
            r(0x8000, 0x87ef, 'Screen RAM', 'screen-ram'),
            r(0xb000, 0xffff, 'BASIC/editor/KERNAL ROM', 'rom')
          ]
        }
      ],
      vice: {
        executable: 'xpet',
        resourceDirectory: 'PET',
        defaultArgs: [...unfilteredViceVideoArgs('Crtc'), '-model', '8032'],
        defaultModel: '8032',
        models: PET_VICE_MODELS
      },
      sourceNotes: ['PET profile uses 8032/BASIC 4.0 as the first concrete PET model because VICE PET emulation is model-selectable.']
    },
    {
      id: 'cbm2',
      displayName: 'Commodore CBM-II B-Series',
      family: 'CBM-II',
      aliases: ['cbm-ii', 'b128', 'b256', 'cbm610', 'cbm710', 'xcbm2'],
      description: 'CBM-II CRTC-model profile for B128/610-style machines with 6509 banking, 80-column CRTC, SID, IEEE, RS-232, BASIC 4.0, and KERNAL-compatible symbols.',
      cpu: {
        primary: 'MOS 6509',
        instructionSet: '6502-compatible with 1 MB bank registers',
        clock: '2 MHz on B-series CRTC models',
        ioPort: {
          dataDirection: 0x0000,
          data: 0x0001,
          description: '6509 execution and indirect bank registers.'
        },
        notes: ['The 6509 uses separate execution and indirect bank registers to address up to 1 MB.']
      },
      memoryMaps: [
        {
          id: 'b-series',
          name: 'CBM-II B-series logical CPU map',
          regions: [
            r(0x0000, 0x03ff, 'System RAM, zero page, stack, and vectors', 'ram'),
            r(0x0400, 0x7fff, 'Application RAM in selected bank', 'banked'),
            r(0x8000, 0xbfff, 'BASIC 4.0 ROM or banked RAM', 'banked'),
            r(0xc000, 0xcfff, 'Character/editor ROM area', 'rom'),
            r(0xd000, 0xdfff, 'I/O register area', 'io'),
            r(0xe000, 0xffff, 'KERNAL ROM or banked RAM', 'banked')
          ],
          notes: ['Exact ROM placement varies by B-series model and ROM set; bank behavior is represented explicitly.']
        }
      ],
      ioRegisters: [
        io(0x0000, 0x0000, 'EXEC_BANK', '6509 execution bank register', 'MOS 6509', 'read-write'),
        io(0x0001, 0x0001, 'INDIRECT_BANK', '6509 indirect bank register', 'MOS 6509', 'read-write'),
        io(0xd000, 0xd01f, 'CRTC', '80-column CRTC register window', 'MOS/Motorola 6545/6845 CRTC', 'mixed'),
        io(0xd400, 0xd41c, 'SID', 'SID sound registers', 'MOS 6581 SID', 'mixed'),
        io(0xdc00, 0xdc0f, 'CIA', 'Timers and peripheral control', 'MOS 6526/8521 CIA', 'mixed'),
        io(0xdd00, 0xdd0f, 'TPI1', 'Triple-port I/O for keyboard, IEEE, and system control', 'MOS 6525 TPI', 'mixed'),
        io(0xde00, 0xde0f, 'TPI2', 'Triple-port I/O for keyboard, IEEE, and system control', 'MOS 6525 TPI', 'mixed'),
        io(0xdf00, 0xdf03, 'ACIA', 'RS-232 ACIA registers', 'MOS 6551 ACIA', 'mixed')
      ],
      roms: [
        rom('basic-low', 'CBM-II BASIC low ROM', 0x8000, 0x9fff, 'basic', 'CBM-II/basic-901240+1-03.bin'),
        rom('basic-high', 'CBM-II BASIC high ROM', 0xa000, 0xbfff, 'basic', 'CBM-II/basic-901242+3-04a.bin'),
        rom('character', 'CBM-II character ROM', 0xc000, 0xcfff, 'rom', 'CBM-II/chargen-901232-01.bin'),
        rom('kernal', 'CBM-II KERNAL ROM', 0xe000, 0xffff, 'kernal', 'CBM-II/kernal-901244-04a.bin')
      ],
      romSymbols: [...CBM2_SYMBOLS, ...COMMON_KERNAL_SYMBOLS],
      zeroPage: [
        zp(0x0000, 0x0000, 'EXECUTION_BANK', '6509 current execution bank register.'),
        zp(0x0001, 0x0001, 'INDIRECT_BANK', '6509 bank for indirect addressing.'),
        zp(0x0028, 0x0029, 'TXTTAB', 'BASIC text start pointer, PET/BASIC 4.0 lineage.'),
        zp(0x008d, 0x008f, 'TIME', 'Three-byte jiffy clock.'),
        zp(0x0096, 0x0096, 'STATUS', 'KERNAL I/O status word ST.')
      ],
      screenLayouts: [
        screen('crtc-80x25', '80x25 CRTC text screen', 80, 25, 0x0000, undefined, undefined, 'CRTC video RAM address is model/configuration dependent and controlled through CRTC registers.')
      ],
      characterSets: [
        charset('cbm2-character-rom', 'CBM-II character ROM', 256, 8, undefined, undefined, 'CBM-II/chargen-901232-01.bin')
      ],
      bankSwitching: [
        {
          id: '6509-bank-registers',
          name: '6509 execution and indirect banks',
          controller: 'MOS 6509 registers $0000 and $0001',
          description: 'The execution bank selects the active 64K bank for code fetches; the indirect bank selects the bank used by indirect memory accesses.',
          registers: [0x0000, 0x0001],
          affectedRanges: [r(0x0000, 0xffff, 'Selected 64K logical bank', 'banked')]
        }
      ],
      vice: {
        executable: 'xcbm2',
        resourceDirectory: 'CBM-II',
        defaultArgs: [...unfilteredViceVideoArgs('Crtc'), '-model', '610'],
        defaultModel: '610',
        models: CBM2_VICE_MODELS
      },
      sourceNotes: ['CBM-II B-series uses VICE xcbm2 for CRTC models.']
    },
    {
      id: 'cbm5x0',
      displayName: 'Commodore CBM-II 5x0/P500',
      family: 'CBM-II',
      aliases: ['cbm500', 'cbm-500', 'p500', 'cbm510', 'xcbm5x0'],
      description: 'CBM-II 5x0/P-series profile with 6509 banking, VIC-II color video, SID, BASIC 4.0+, and VICE xcbm5x0 launch metadata.',
      cpu: {
        primary: 'MOS 6509',
        instructionSet: '6502-compatible with 1 MB bank registers',
        clock: 'Approximately 1 MHz on VIC-II CBM-II models',
        ioPort: {
          dataDirection: 0x0000,
          data: 0x0001,
          description: '6509 execution and indirect bank registers.'
        }
      },
      memoryMaps: [
        {
          id: 'p-series',
          name: 'CBM-II 5x0/P-series logical CPU map',
          regions: [
            r(0x0000, 0x03ff, 'System RAM, zero page, stack, and vectors', 'ram'),
            r(0x0400, 0x7fff, 'Application RAM in selected bank', 'banked'),
            r(0x8000, 0xbfff, 'BASIC 4.0+ ROM or banked RAM', 'banked'),
            r(0xc000, 0xcfff, 'Character/editor ROM area', 'rom'),
            r(0xd000, 0xdfff, 'VIC-II/SID/I/O register area', 'io'),
            r(0xe000, 0xffff, 'KERNAL ROM or banked RAM', 'banked')
          ]
        }
      ],
      ioRegisters: [
        io(0x0000, 0x0000, 'EXEC_BANK', '6509 execution bank register', 'MOS 6509', 'read-write'),
        io(0x0001, 0x0001, 'INDIRECT_BANK', '6509 indirect bank register', 'MOS 6509', 'read-write'),
        io(0xd000, 0xd02e, 'VICII', 'VIC-II video registers', 'MOS 6567/6569 VIC-II', 'mixed'),
        io(0xd400, 0xd41c, 'SID', 'SID sound registers', 'MOS 6581 SID', 'mixed'),
        io(0xdc00, 0xdc0f, 'CIA', 'Timers and peripheral control', 'MOS 6526/8521 CIA', 'mixed'),
        io(0xdd00, 0xde0f, 'TPI', 'CBM-II triple-port I/O windows', 'MOS 6525 TPI', 'mixed'),
        io(0xdf00, 0xdf03, 'ACIA', 'RS-232 ACIA registers', 'MOS 6551 ACIA', 'mixed')
      ],
      roms: [
        rom('basic-low', 'CBM-II BASIC low ROM', 0x8000, 0x9fff, 'basic', 'CBM-II/basic-901235+6-02.bin'),
        rom('basic-high', 'CBM-II BASIC high ROM', 0xa000, 0xbfff, 'basic', 'CBM-II/basic-901242+3-04a.bin'),
        rom('character', 'CBM-II/C64-style character ROM', 0xc000, 0xcfff, 'rom', 'CBM-II/chargen-901225-01.bin'),
        rom('kernal', 'CBM-II 5x0 KERNAL ROM', 0xe000, 0xffff, 'kernal', 'CBM-II/kernal-901234-02.bin')
      ],
      romSymbols: [...CBM2_SYMBOLS, ...COMMON_KERNAL_SYMBOLS],
      zeroPage: [
        zp(0x0000, 0x0000, 'EXECUTION_BANK', '6509 current execution bank register.'),
        zp(0x0001, 0x0001, 'INDIRECT_BANK', '6509 bank for indirect addressing.'),
        zp(0x0028, 0x0029, 'TXTTAB', 'BASIC text start pointer.'),
        zp(0x0096, 0x0096, 'STATUS', 'KERNAL I/O status word ST.')
      ],
      screenLayouts: [
        screen('vicii-40x25', '40x25 VIC-II color text screen', 40, 25, 0x0400, undefined, undefined, 'VIC-II video layout follows the P-series model-specific VIC bank configuration.')
      ],
      characterSets: [
        charset('cbm5x0-character-rom', 'CBM-II 5x0 character ROM', 256, 8, undefined, undefined, 'CBM-II/chargen-901225-01.bin')
      ],
      bankSwitching: [
        {
          id: '6509-bank-registers',
          name: '6509 execution and indirect banks',
          controller: 'MOS 6509 registers $0000 and $0001',
          description: 'The execution bank selects the active 64K bank for code fetches; the indirect bank selects the bank used by indirect memory accesses.',
          registers: [0x0000, 0x0001],
          affectedRanges: [r(0x0000, 0xffff, 'Selected 64K logical bank', 'banked')]
        },
        {
          id: 'vicii-video-bank',
          name: 'VIC-II video bank on CBM-II 5x0',
          controller: 'Model-specific VIC-II banking logic',
          description: 'VIC-II fetches are constrained by the P-series video-memory decode rather than the C64 CIA #2 banking scheme.',
          affectedRanges: [r(0x0000, 0xffff, 'VIC-II visible video memory', 'banked')]
        }
      ],
      vice: {
        executable: 'xcbm5x0',
        resourceDirectory: 'CBM-II',
        defaultArgs: [...unfilteredViceVideoArgs('VICII'), '-model', '510'],
        defaultModel: '510',
        models: CBM5X0_VICE_MODELS
      },
      sourceNotes: ['VICE uses xcbm5x0 for CBM-II VIC-II/P-series models.']
    },
    {
      id: 'c64dtv',
      displayName: 'Commodore 64 DTV',
      family: 'C64DTV',
      aliases: ['c64-dtv', 'dtv', 'x64dtv'],
      description: 'C64DTV profile preserving C64 compatibility while exposing DTV flash, extended VIC/SID, DMA/blitter, MMU, and 65DTV02 banking details.',
      cpu: {
        primary: '65DTV02',
        instructionSet: 'C64-compatible 6502/6510 lineage with DTV register-file and banking extensions',
        clock: 'C64-compatible timing plus DTV burst modes',
        ioPort: {
          dataDirection: 0x0000,
          data: 0x0001,
          description: 'C64-compatible 6510 I/O port at reset.'
        },
        notes: [
          'DTV register file can remap accumulator, X/Y, base page, stack, and four 16K CPU banks.',
          'DTV CPU-visible addresses may map to larger physical RAM/flash addresses.'
        ]
      },
      memoryMaps: [
        {
          id: 'reset',
          name: 'C64DTV reset-visible 6502 map',
          regions: [
            r(0x0000, 0x0001, '6510-compatible CPU I/O', 'cpu-port'),
            r(0x0100, 0x01ff, 'Stack page', 'ram'),
            r(0xa000, 0xbfff, 'BASIC from flash', 'banked'),
            r(0xd000, 0xdfff, 'Color nybbles, I/O, character data, and DTV extensions', 'banked'),
            r(0xe000, 0xffff, 'KERNAL and editor from flash', 'banked')
          ],
          notes: ['The DTV MMU and register-file segment mapper can replace this reset layout.']
        },
        {
          id: 'physical-flash',
          name: 'DTV physical flash layout',
          regions: [
            r(0x001000, 0x001fff, 'VIC character set 1', 'character-rom'),
            r(0x009000, 0x009fff, 'VIC character set 2', 'character-rom'),
            r(0x00a000, 0x00bfff, 'BASIC image in flash', 'rom'),
            r(0x00d000, 0x00dfff, 'CPU character set in flash', 'character-rom'),
            r(0x00e000, 0x00ffff, 'KERNAL image in flash', 'rom'),
            r(0x010000, 0x013fff, 'Flash file directory', 'rom')
          ]
        }
      ],
      ioRegisters: [
        ...C64_IO_REGISTERS,
        io(0xd03f, 0xd03f, 'DTV_EXT_ENABLE', 'DTV extended feature enable', 'C64DTV VIC extension', 'read-write'),
        io(0xd036, 0xd04f, 'DTV_VIC_EXT', 'Extended VIC registers', 'C64DTV VIC extension', 'mixed'),
        io(0xd100, 0xd1ff, 'DTV_MMU', 'KERNAL/BASIC segment mapper registers', 'C64DTV MMU', 'write'),
        io(0xd200, 0xd2ff, 'DTV_PALETTE', 'DTV palette luma/chroma registers', 'C64DTV palette', 'write'),
        io(0xd300, 0xd3ff, 'DTV_DMA_BLITTER', 'DTV DMA and blitter registers', 'C64DTV DMA/blitter', 'mixed'),
        io(0xd41e, 0xd41f, 'DTV_SID_EXT', 'Extended SID accumulator/envelope registers', 'C64DTV SID extension', 'write')
      ],
      roms: [
        rom('basic', 'C64DTV BASIC flash image', 0xa000, 0xbfff, 'basic', 'C64DTV/basic-901226-01.bin'),
        rom('character', 'C64DTV character flash image', 0xd000, 0xdfff, 'rom', 'C64DTV/chargen-901225-01.bin'),
        rom('kernal', 'C64DTV KERNAL flash image', 0xe000, 0xffff, 'kernal', 'C64DTV/kernal-901227-03.bin')
      ],
      romSymbols: [...C64_BASIC_SYMBOLS, ...COMMON_KERNAL_SYMBOLS],
      zeroPage: [
        ...C64_ZERO_PAGE,
        zp(0x0000, 0x0001, 'DTV_CPU_IO', 'C64-compatible CPU I/O port at physical $000000/$000001.'),
        zp(0x000a, 0x000f, 'DTV_REGISTER_FILE_BANKS', 'DTV register-file slots 10-15 can act as base, stack, and 16K bank registers.')
      ],
      screenLayouts: [
        ...C64_SCREEN_LAYOUTS,
        screen('linear-8bpp', 'DTV linear/chunky bitmap modes', 40, 25, undefined, 0x01d800, undefined, 'DTV extended VIC modes can fetch from 22-bit linear physical addresses.')
      ],
      characterSets: [
        ...C64_CHARACTER_SETS,
        charset('dtv-vic-character-set-1', 'DTV VIC character set 1', 256, 8, 0x001000, undefined, undefined),
        charset('dtv-vic-character-set-2', 'DTV VIC character set 2', 256, 8, 0x009000, undefined, undefined)
      ],
      bankSwitching: [
        {
          id: 'dtv-register-file',
          name: 'DTV register-file bank mapper',
          controller: '65DTV02 register file registers 10-15',
          description: 'Registers 10 and 11 remap base page and stack page; registers 12-15 select four 16K CPU banks.',
          affectedRanges: [
            r(0x0000, 0x00ff, 'Base page', 'banked'),
            r(0x0100, 0x01ff, 'Stack page', 'banked'),
            r(0x0000, 0x3fff, 'CPU bank 0', 'banked'),
            r(0x4000, 0x7fff, 'CPU bank 1', 'banked'),
            r(0x8000, 0xbfff, 'CPU bank 2', 'banked'),
            r(0xc000, 0xffff, 'CPU bank 3', 'banked')
          ]
        },
        {
          id: 'dtv-rom-segments',
          name: 'DTV KERNAL and BASIC segment mapper',
          controller: 'DTV $D100 and $D101',
          description: 'Selects the 64K ROM/RAM segment used for KERNAL and BASIC fetches when extended feature registers are enabled.',
          registers: [0xd100, 0xd101],
          affectedRanges: [
            r(0xa000, 0xbfff, 'BASIC segment', 'banked'),
            r(0xe000, 0xffff, 'KERNAL segment', 'banked')
          ]
        }
      ],
      vice: {
        executable: 'x64dtv',
        resourceDirectory: 'C64DTV',
        defaultArgs: unfilteredViceVideoArgs('VICII'),
        defaultModel: 'v2',
        models: C64DTV_VICE_MODELS
      },
      sourceNotes: ['C64DTV programming guide describes reset map, extended I/O windows, MMU registers, register-file banking, DMA, and blitter extensions.']
    }
  ]);

const PROFILE_BY_ID = new Map<CommodoreMachineProfileId, CommodoreMachineProfile>(
  COMMODORE_MACHINE_PROFILES.map((profile) => [profile.id, profile])
);

const PROFILE_ALIAS_BY_KEY = new Map<string, CommodoreMachineProfileId>();

for (const profile of COMMODORE_MACHINE_PROFILES) {
  PROFILE_ALIAS_BY_KEY.set(normalizeProfileLookupKey(profile.id), profile.id);
  PROFILE_ALIAS_BY_KEY.set(normalizeProfileLookupKey(profile.displayName), profile.id);
  PROFILE_ALIAS_BY_KEY.set(normalizeProfileLookupKey(profile.vice.executable), profile.id);
  for (const alias of profile.aliases) {
    PROFILE_ALIAS_BY_KEY.set(normalizeProfileLookupKey(alias), profile.id);
  }
}

export function isCommodoreMachineProfileId(
  value: string
): value is CommodoreMachineProfileId {
  return PROFILE_BY_ID.has(value as CommodoreMachineProfileId);
}

export function resolveCommodoreMachineProfileId(
  value: string | undefined
): CommodoreMachineProfileId | undefined {
  if (!value) {
    return undefined;
  }
  return PROFILE_ALIAS_BY_KEY.get(normalizeProfileLookupKey(value));
}

export function getCommodoreMachineProfile(
  id: CommodoreMachineProfileId
): CommodoreMachineProfile {
  const profile = PROFILE_BY_ID.get(id);
  if (!profile) {
    throw new Error(`Unsupported Commodore machine profile: ${id}`);
  }
  return profile;
}

export function getViceExecutableForMachineProfile(
  id: CommodoreMachineProfileId
): string {
  return getCommodoreMachineProfile(id).vice.executable;
}

export function getCommodoreViceModel(
  profileId: CommodoreMachineProfileId,
  modelId: string
): CommodoreViceModel | undefined {
  return getCommodoreMachineProfile(profileId).vice.models?.find(
    (modelOption) => modelOption.id === modelId
  );
}

export function isCommodoreViceModelForMachineProfile(
  profileId: CommodoreMachineProfileId,
  modelId: string
): boolean {
  return Boolean(getCommodoreViceModel(profileId, modelId));
}

function kernal(
  name: string,
  address: number,
  description: string
): CommodoreRomSymbol {
  return { name, address, module: 'kernal', description };
}

function basic(
  name: string,
  address: number,
  description: string
): CommodoreRomSymbol {
  return { name, address, module: 'basic', description };
}

function monitor(
  name: string,
  address: number,
  description: string
): CommodoreRomSymbol {
  return { name, address, module: 'monitor', description };
}

function model(
  id: string,
  displayName: string,
  description?: string
): CommodoreViceModel {
  return {
    id,
    displayName,
    ...(description ? { description } : {})
  };
}

function banking(
  name: string,
  address: number,
  description: string
): CommodoreRomSymbol {
  return { name, address, module: 'banking', description };
}

function r(
  start: number,
  end: number,
  name: string,
  kind: CommodoreMemoryRegionKind,
  description?: string,
  bank?: string
): CommodoreAddressRange {
  return {
    start,
    end,
    name,
    kind,
    ...(description ? { description } : {}),
    ...(bank ? { bank } : {})
  };
}

function io(
  start: number,
  end: number,
  id: string,
  name: string,
  chip: string,
  access?: CommodoreIoRegister['access'],
  bits?: readonly string[]
): CommodoreIoRegister {
  return {
    start,
    end,
    id,
    name,
    chip,
    ...(access ? { access } : {}),
    ...(bits ? { bits } : {})
  };
}

function rom(
  id: string,
  name: string,
  start: number,
  end: number,
  module: CommodoreRomSymbolModule,
  viceResource?: string,
  description?: string
): CommodoreRomImage {
  return {
    id,
    name,
    start,
    end,
    module,
    ...(viceResource ? { viceResource } : {}),
    ...(description ? { description } : {})
  };
}

function zp(
  start: number,
  end: number,
  name: string,
  description: string
): CommodoreZeroPageConvention {
  return { start, end, name, description };
}

function screen(
  id: string,
  name: string,
  columns: number,
  rows: number,
  screenAddress: number | undefined,
  colorAddress: number | undefined,
  bitmapAddress: number | undefined,
  description: string
): CommodoreScreenLayout {
  return {
    id,
    name,
    columns,
    rows,
    ...(screenAddress !== undefined ? { screenAddress } : {}),
    ...(colorAddress !== undefined ? { colorAddress } : {}),
    ...(bitmapAddress !== undefined ? { bitmapAddress } : {}),
    characterCell: {
      width: 8,
      height: 8
    },
    description
  };
}

function charset(
  id: string,
  name: string,
  glyphCount: number,
  bytesPerGlyph: number,
  romAddress?: number,
  ramAddress?: number,
  viceResource?: string,
  description?: string
): CommodoreCharacterSet {
  return {
    id,
    name,
    glyphCount,
    bytesPerGlyph,
    ...(romAddress !== undefined ? { romAddress } : {}),
    ...(ramAddress !== undefined ? { ramAddress } : {}),
    ...(viceResource ? { viceResource } : {}),
    ...(description ? { description } : {})
  };
}

function normalizeProfileLookupKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_/]+/gu, '-');
}
