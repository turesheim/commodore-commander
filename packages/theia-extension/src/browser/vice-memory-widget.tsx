import * as React from 'react';

import { codicon, ReactWidget } from '@theia/core/lib/browser';
import { StorageService } from '@theia/core/lib/browser/storage-service';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { DisposableCollection } from '@theia/core/lib/common';
import { DebugSession, DebugState } from '@theia/debug/lib/browser/debug-session';
import type { DebugRequestTypes } from '@theia/debug/lib/browser/debug-session-connection';
import { DebugSessionManager } from '@theia/debug/lib/browser/debug-session-manager';
import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';

import { COMMODORE_VICE_DEBUG_TYPE } from '../common/commodore-vice-debug';

export const VICE_MEMORY_WIDGET_ID = 'commodore-commander.vice-memory';

type MemoryTextMode = 'ascii' | 'petscii' | 'screen' | 'custom';
export type MemoryCharacterSet = 'upper' | 'lower';

interface MemoryPreset {
  label: string;
  expression: string;
  length: string;
  bytesPerRow?: number;
  textMode?: MemoryTextMode;
}

interface MemorySpaceOption {
  label: string;
  title: string;
  value: string;
}

interface MemoryBankOption {
  label: string;
  value: string;
}

interface CharacterSetOption {
  label: string;
  value: MemoryCharacterSet;
}

interface MemoryRequestOptions {
  sideEffects?: boolean;
  memspace?: number;
  bankId?: number;
}

interface MemoryMonitorRequest {
  expression: string;
  startAddress: number;
  length: number;
}

interface MemoryBlockSnapshot extends MemoryMonitorRequest {
  bytes: Uint8Array;
  changedOffsets: ReadonlySet<number>;
}

interface MemorySnapshot {
  blocks: MemoryBlockSnapshot[];
  loadedAt: number;
}

interface MemoryCell {
  address: number;
  changed: boolean;
  hex: string;
  title: string;
}

interface MemoryRow {
  address: number;
  cells: MemoryCell[];
  text: MemoryTextCell[];
}

interface MemoryTextCell {
  kind: 'control' | 'glyph' | 'text';
  glyphIndex?: number;
  label?: string;
  text?: string;
  title: string;
}

interface MemoryTextRenderState {
  petsciiReverse: boolean;
}

interface PersistedMemoryViewState {
  advancedOpen?: boolean;
  autoRefresh?: boolean;
  bankInput?: string;
  bytesPerRow?: number;
  characterSet?: MemoryCharacterSet;
  customCharset?: string;
  expressionInput?: string;
  lengthInput?: string;
  memspaceInput?: string;
  sideEffects?: boolean;
  textMode?: MemoryTextMode;
}

const STORAGE_KEY = 'commodore-commander.vice-memory.state';
const DEFAULT_EXPRESSION = '$0400';
const DEFAULT_LENGTH = '256';
const DEFAULT_MEMSPACE = '0';
const DEFAULT_BANK = '0';
const DEFAULT_BYTES_PER_ROW = 16;
const DEFAULT_CHARACTER_SET: MemoryCharacterSet = 'upper';
const MAX_MEMORY_READ_LENGTH = 4096;
const MEMORY_READ_TIMEOUT_MS = 5000;
const MEMORY_BANK_DATALIST_ID = 'commodore-commander-memory-bank-options';
const C64_GLYPH_PIXEL_SIZE = 2;
const MEMORY_SPACE_OPTIONS: readonly MemorySpaceOption[] = [
  {
    label: 'Computer (0)',
    title: 'Main computer memory space',
    value: '0'
  },
  {
    label: 'Drive 8',
    title: 'Disk drive 8 memory space',
    value: '8'
  },
  {
    label: 'Drive 9',
    title: 'Disk drive 9 memory space',
    value: '9'
  },
  {
    label: 'Drive 10',
    title: 'Disk drive 10 memory space',
    value: '10'
  },
  {
    label: 'Drive 11',
    title: 'Disk drive 11 memory space',
    value: '11'
  }
];
const MEMORY_BANK_OPTIONS: readonly MemoryBankOption[] = [
  {
    label: 'Default active bank',
    value: '0'
  }
];
const CHARACTER_SET_OPTIONS: readonly CharacterSetOption[] = [
  {
    label: 'Upper/Graphics',
    value: 'upper'
  },
  {
    label: 'Lower/Upper',
    value: 'lower'
  }
];
const MEMORY_PRESETS: readonly MemoryPreset[] = [
  { label: 'Zero Page', expression: '$0000', length: '256' },
  { label: 'Stack', expression: '$0100', length: '256' },
  {
    label: 'Screen',
    expression: '$0400-$07E7',
    length: '1000',
    bytesPerRow: 40,
    textMode: 'screen'
  },
  {
    label: 'Color',
    expression: '$D800-$DBE7',
    length: '1000',
    bytesPerRow: 40
  },
  { label: 'Program', expression: '$1000', length: '256' }
];
// Bitmap data mirrors net.resheim.eclipse.cc.ui.characterset.C64CharacterGrid.
const C64_UPPERCASE_BITMAP_BASE64 = [
  'PGZubmBiPAAYPGZ+ZmZmAHxmZnxmZnwAPGZgYGBmPAB4bGZmZmx4AH5gYHhgYH4AfmBgeGBgYAA8ZmBuZmY8AGZmZn5mZmYA',
  'PBgYGBgYPAAeDAwMDGw4AGZseHB4bGYAYGBgYGBgfgBjd39rY2NjAGZ2fn5uZmYAPGZmZmZmPAB8ZmZ8YGBgADxmZmZmPA4A',
  'fGZmfHhsZgA8ZmA8BmY8AH4YGBgYGBgAZmZmZmZmPABmZmZmZjwYAGNjY2t/d2MAZmY8GDxmZgBmZmY8GBgYAH4GDBgwYH4A',
  'PDAwMDAwPAAMEjB8MGL8ADwMDAwMDDwAABg8fhgYGBgAEDB/fzAQAAAAAAAAAAAAGBgYGAAAGABmZmYAAAAAAGZm/2b/ZmYA',
  'GD5gPAZ8GABiZgwYMGZGADxmPDhnZj8ABgwYAAAAAAAMGDAwMBgMADAYDAwMGDAAAGY8/zxmAAAAGBh+GBgAAAAAAAAAGBgw',
  'AAAAfgAAAAAAAAAAABgYAAADBgwYMGAAPGZudmZmPAAYGDgYGBh+ADxmBgwwYH4APGYGHAZmPAAGDh5mfwYGAH5gfAYGZjwA',
  'PGZgfGZmPAB+ZgwYGBgYADxmZjxmZjwAPGZmPgZmPAAAABgAABgAAAAAGAAAGBgwDhgwYDAYDgAAAH4AfgAAAHAYDAYMGHAA',
  'PGYGDBgAGAAAAAD//wAAAAgcPn9/HD4AGBgYGBgYGBgAAAD//wAAAAAA//8AAAAAAP//AAAAAAAAAAAA//8AADAwMDAwMDAw',
  'DAwMDAwMDAwAAADg8DgYGBgYHA8HAAAAGBg48OAAAADAwMDAwMD//8DgcDgcDgcDAwcOHDhw4MD//8DAwMDAwP//AwMDAwMD',
  'ADx+fn5+PAAAAAAAAP//ADZ/f38+HAgAYGBgYGBgYGAAAAAHDxwYGMPnfjw8fufDADx+ZmZ+PAAYGGZmGBg8AAYGBgYGBgYG',
  'CBw+fz4cCAAYGBj//xgYGMDAMDDAwDAwGBgYGBgYGBgAAAM+djY2AP9/Px8PBwMBAAAAAAAAAADw8PDw8PDw8AAAAAD/////',
  '/wAAAAAAAAAAAAAAAAAA/8DAwMDAwMDAzMwzM8zMMzMDAwMDAwMDAwAAAADMzDMz//78+PDgwIADAwMDAwMDAxgYGB8fGBgY',
  'AAAAAA8PDw8YGBgfHwAAAAAAAPj4GBgYAAAAAAAA//8AAAAfHxgYGBgYGP//AAAAAAAA//8YGBgYGBj4+BgYGMDAwMDAwMDA',
  '4ODg4ODg4OAHBwcHBwcHB///AAAAAAAA////AAAAAAAAAAAAAP///wMDAwMDA///AAAAAPDw8PAPDw8PAAAAABgYGPj4AAAA',
  '8PDw8AAAAADw8PDwDw8PD8OZkZGfmcP/58OZgZmZmf+DmZmDmZmD/8OZn5+fmcP/h5OZmZmTh/+Bn5+Hn5+B/4Gfn4efn5//',
  'w5mfkZmZw/+ZmZmBmZmZ/8Pn5+fn58P/4fPz8/OTx/+Zk4ePh5OZ/5+fn5+fn4H/nIiAlJycnP+ZiYGBkZmZ/8OZmZmZmcP/',
  'g5mZg5+fn//DmZmZmcPx/4OZmYOHk5n/w5mfw/mZw/+B5+fn5+fn/5mZmZmZmcP/mZmZmZnD5/+cnJyUgIic/5mZw+fDmZn/',
  'mZmZw+fn5/+B+fPnz5+B/8PPz8/Pz8P/8+3Pg8+dA//D8/Pz8/PD///nw4Hn5+fn/+/PgIDP7////////////+fn5+f//+f/',
  'mZmZ//////+ZmQCZAJmZ/+fBn8P5g+f/nZnz58+Zuf/DmcPHmJnA//nz5///////8+fPz8/n8//P5/Pz8+fP//+ZwwDDmf//',
  '/+fngefn/////////+fnz////4H////////////n5////Pnz58+f/8OZkYmZmcP/5+fH5+fngf/Dmfnzz5+B/8OZ+eP5mcP/',
  '+fHhmYD5+f+Bn4P5+ZnD/8OZn4OZmcP/gZnz5+fn5//DmZnDmZnD/8OZmcH5mcP////n///n/////+f//+fnz/Hnz5/P5/H/',
  '//+B/4H///+P5/P58+eP/8OZ+fPn/+f/////AAD////348GAgOPB/+fn5+fn5+fn////AAD//////wAA//////8AAP//////',
  '/////wAA///Pz8/Pz8/Pz/Pz8/Pz8/Pz////Hw/H5+fn5+Pw+P///+fnxw8f////Pz8/Pz8/AAA/H4/H4/H4/Pz48ePHjx8/',
  'AAA/Pz8/Pz8AAPz8/Pz8/P/DgYGBgcP///////8AAP/JgICAweP3/5+fn5+fn5+f////+PDj5+c8GIHDw4EYPP/DgZmZgcP/',
  '5+eZmefnw//5+fn5+fn5+ffjwYDB4/f/5+fnAADn5+c/P8/PPz/Pz+fn5+fn5+fn///8wYnJyf8AgMDg8Pj8/v//////////',
  'Dw8PDw8PDw//////AAAAAAD//////////////////wA/Pz8/Pz8/PzMzzMwzM8zM/Pz8/Pz8/Pz/////MzPMzAABAwcPHz9/',
  '/Pz8/Pz8/Pzn5+fg4Ofn5//////w8PDw5+fn4OD///////8HB+fn5////////wAA////4ODn5+fn5+cAAP///////wAA5+fn',
  '5+fnBwfn5+c/Pz8/Pz8/Px8fHx8fHx8f+Pj4+Pj4+PgAAP///////wAAAP////////////8AAAD8/Pz8/PwAAP////8PDw8P',
  '8PDw8P/////n5+cHB////w8PDw//////Dw8PD/Dw8PA='
].join('');
const C64_LOWERCASE_BITMAP_BASE64 = [
  'PGZubmBiPAAAADwGPmY+AABgYHxmZnwAAAA8YGBgPAAABgY+ZmY+AAAAPGZ+YDwAAA4YPhgYGAAAAD5mZj4GfABgYHxmZmYA',
  'ABgAOBgYPAAABgAGBgYGPABgYGx4bGYAADgYGBgYPAAAAGZ/f2tjAAAAfGZmZmYAAAA8ZmZmPAAAAHxmZnxgYAAAPmZmPgYG',
  'AAB8ZmBgYAAAAD5gPAZ8AAAYfhgYGA4AAABmZmZmPgAAAGZmZjwYAAAAY2t/PjYAAABmPBg8ZgAAAGZmZj4MeAAAfgwYMH4A',
  'PDAwMDAwPAAMEjB8MGL8ADwMDAwMDDwAABg8fhgYGBgAEDB/fzAQAAAAAAAAAAAAGBgYGAAAGABmZmYAAAAAAGZm/2b/ZmYA',
  'GD5gPAZ8GABiZgwYMGZGADxmPDhnZj8ABgwYAAAAAAAMGDAwMBgMADAYDAwMGDAAAGY8/zxmAAAAGBh+GBgAAAAAAAAAGBgw',
  'AAAAfgAAAAAAAAAAABgYAAADBgwYMGAAPGZudmZmPAAYGDgYGBh+ADxmBgwwYH4APGYGHAZmPAAGDh5mfwYGAH5gfAYGZjwA',
  'PGZgfGZmPAB+ZgwYGBgYADxmZjxmZjwAPGZmPgZmPAAAABgAABgAAAAAGAAAGBgwDhgwYDAYDgAAAH4AfgAAAHAYDAYMGHAA',
  'PGYGDBgAGAAAAAD//wAAABg8Zn5mZmYAfGZmfGZmfAA8ZmBgYGY8AHhsZmZmbHgAfmBgeGBgfgB+YGB4YGBgADxmYG5mZjwA',
  'ZmZmfmZmZgA8GBgYGBg8AB4MDAwMbDgAZmx4cHhsZgBgYGBgYGB+AGN3f2tjY2MAZnZ+fm5mZgA8ZmZmZmY8AHxmZnxgYGAA',
  'PGZmZmY8DgB8ZmZ8eGxmADxmYDwGZjwAfhgYGBgYGABmZmZmZmY8AGZmZmZmPBgAY2Nja393YwBmZjwYPGZmAGZmZjwYGBgA',
  'fgYMGDBgfgAYGBj//xgYGMDAMDDAwDAwGBgYGBgYGBgzM8zMMzPMzDOZzGYzmcxmAAAAAAAAAADw8PDw8PDw8AAAAAD/////',
  '/wAAAAAAAAAAAAAAAAAA/8DAwMDAwMDAzMwzM8zMMzMDAwMDAwMDAwAAAADMzDMzzJkzZsyZM2YDAwMDAwMDAxgYGB8fGBgY',
  'AAAAAA8PDw8YGBgfHwAAAAAAAPj4GBgYAAAAAAAA//8AAAAfHxgYGBgYGP//AAAAAAAA//8YGBgYGBj4+BgYGMDAwMDAwMDA',
  '4ODg4ODg4OAHBwcHBwcHB///AAAAAAAA////AAAAAAAAAAAAAP///wEDBmx4cGAAAAAAAPDw8PAPDw8PAAAAABgYGPj4AAAA',
  '8PDw8AAAAADw8PDwDw8PD8OZkZGfmcP////D+cGZwf//n5+DmZmD////w5+fn8P///n5wZmZwf///8OZgZ/D///x58Hn5+f/',
  '///BmZnB+YP/n5+DmZmZ///n/8fn58P///n/+fn5+cP/n5+Th5OZ///H5+fn58P///+ZgICUnP///4OZmZmZ////w5mZmcP/',
  '//+DmZmDn5///8GZmcH5+f//g5mfn5/////Bn8P5g///54Hn5+fx////mZmZmcH///+ZmZnD5////5yUgMHJ////mcPnw5n/',
  '//+ZmZnB84f//4Hz58+B/8PPz8/Pz8P/8+3Pg8+dA//D8/Pz8/PD///nw4Hn5+fn/+/PgIDP7////////////+fn5+f//+f/',
  'mZmZ//////+ZmQCZAJmZ/+fBn8P5g+f/nZnz58+Zuf/DmcPHmJnA//nz5///////8+fPz8/n8//P5/Pz8+fP//+ZwwDDmf//',
  '/+fngefn/////////+fnz////4H////////////n5////Pnz58+f/8OZkYmZmcP/5+fH5+fngf/Dmfnzz5+B/8OZ+eP5mcP/',
  '+fHhmYD5+f+Bn4P5+ZnD/8OZn4OZmcP/gZnz5+fn5//DmZnDmZnD/8OZmcH5mcP////n///n/////+f//+fnz/Hnz5/P5/H/',
  '//+B/4H///+P5/P58+eP/8OZ+fPn/+f/////AAD////nw5mBmZmZ/4OZmYOZmYP/w5mfn5+Zw/+Hk5mZmZOH/4Gfn4efn4H/',
  'gZ+fh5+fn//DmZ+RmZnD/5mZmYGZmZn/w+fn5+fnw//h8/Pz85PH/5mTh4+Hk5n/n5+fn5+fgf+ciICUnJyc/5mJgYGRmZn/',
  'w5mZmZmZw/+DmZmDn5+f/8OZmZmZw/H/g5mZg4eTmf/DmZ/D+ZnD/4Hn5+fn5+f/mZmZmZmZw/+ZmZmZmcPn/5ycnJSAiJz/',
  'mZnD58OZmf+ZmZnD5+fn/4H58+fPn4H/5+fnAADn5+c/P8/PPz/Pz+fn5+fn5+fnzMwzM8zMMzPMZjOZzGYzmf//////////',
  'Dw8PDw8PDw//////AAAAAAD//////////////////wA/Pz8/Pz8/PzMzzMwzM8zM/Pz8/Pz8/Pz/////MzPMzDNmzJkzZsyZ',
  '/Pz8/Pz8/Pzn5+fg4Ofn5//////w8PDw5+fn4OD///////8HB+fn5////////wAA////4ODn5+fn5+cAAP///////wAA5+fn',
  '5+fnBwfn5+c/Pz8/Pz8/Px8fHx8fHx8f+Pj4+Pj4+PgAAP///////wAAAP////////////8AAAD+/PmTh4+f//////8PDw8P',
  '8PDw8P/////n5+cHB////w8PDw//////Dw8PD/Dw8PA='
].join('');
const C64_CHARACTER_BITMAPS: Record<MemoryCharacterSet, Uint8Array> = {
  lower: decodeBase64(C64_LOWERCASE_BITMAP_BASE64),
  upper: decodeBase64(C64_UPPERCASE_BITMAP_BASE64)
};
const characterGlyphShadowCache = new Map<string, string>();
const PETSCII_CONTROL_LABELS: Record<number, { label: string; title: string }> = {
  0x00: { label: 'NUL', title: 'Null' },
  0x03: { label: 'STP', title: 'Stop' },
  0x05: { label: 'WHT', title: 'White' },
  0x08: { label: 'LCK', title: 'Disable C= Shift' },
  0x09: { label: 'ULK', title: 'Enable C= Shift' },
  0x0d: { label: 'CR', title: 'Carriage return' },
  0x0e: { label: 'L/U', title: 'Switch to lower/uppercase character set' },
  0x11: { label: 'DN', title: 'Cursor down' },
  0x12: { label: 'R+', title: 'Reverse video on' },
  0x13: { label: 'HM', title: 'Home' },
  0x14: { label: 'DEL', title: 'Delete' },
  0x1c: { label: 'RED', title: 'Red' },
  0x1d: { label: 'RT', title: 'Cursor right' },
  0x1e: { label: 'GRN', title: 'Green' },
  0x1f: { label: 'BLU', title: 'Blue' },
  0x81: { label: 'ORN', title: 'Orange' },
  0x85: { label: 'F1', title: 'Function key F1' },
  0x86: { label: 'F3', title: 'Function key F3' },
  0x87: { label: 'F5', title: 'Function key F5' },
  0x88: { label: 'F7', title: 'Function key F7' },
  0x89: { label: 'F2', title: 'Function key F2' },
  0x8a: { label: 'F4', title: 'Function key F4' },
  0x8b: { label: 'F6', title: 'Function key F6' },
  0x8c: { label: 'F8', title: 'Function key F8' },
  0x8d: { label: 'SRT', title: 'Shift return' },
  0x8e: { label: 'U/G', title: 'Switch to upper/graphics character set' },
  0x90: { label: 'BLK', title: 'Black' },
  0x91: { label: 'UP', title: 'Cursor up' },
  0x92: { label: 'R-', title: 'Reverse video off' },
  0x93: { label: 'CLR', title: 'Clear screen' },
  0x94: { label: 'INS', title: 'Insert' },
  0x95: { label: 'BRN', title: 'Brown' },
  0x96: { label: 'LRD', title: 'Light red' },
  0x97: { label: 'DGY', title: 'Dark grey' },
  0x98: { label: 'GY', title: 'Grey' },
  0x99: { label: 'LGN', title: 'Light green' },
  0x9a: { label: 'LBL', title: 'Light blue' },
  0x9b: { label: 'LGY', title: 'Light grey' },
  0x9c: { label: 'PUR', title: 'Purple' },
  0x9d: { label: 'LT', title: 'Cursor left' },
  0x9e: { label: 'YEL', title: 'Yellow' },
  0x9f: { label: 'CYN', title: 'Cyan' }
};

@injectable()
export class ViceMemoryWidget extends ReactWidget {
  @inject(DebugSessionManager)
  protected readonly debugSessionManager!: DebugSessionManager;

  @inject(StorageService)
  protected readonly storageService!: StorageService;

  protected readonly toDispose = new DisposableCollection();
  protected expressionInput = DEFAULT_EXPRESSION;
  protected lengthInput = DEFAULT_LENGTH;
  protected memspaceInput = DEFAULT_MEMSPACE;
  protected bankInput = DEFAULT_BANK;
  protected bytesPerRow = DEFAULT_BYTES_PER_ROW;
  protected textMode: MemoryTextMode = 'ascii';
  protected characterSet: MemoryCharacterSet = DEFAULT_CHARACTER_SET;
  protected customCharset = '';
  protected sideEffects = false;
  protected autoRefresh = true;
  protected advancedOpen = false;
  protected loading = false;
  protected status = 'Start a VICE debug session and stop at a breakpoint to read memory.';
  protected error: string | undefined;
  protected snapshot: MemorySnapshot | undefined;

  @postConstruct()
  protected init(): void {
    this.id = VICE_MEMORY_WIDGET_ID;
    this.title.label = 'Memory';
    this.title.caption = 'VICE Memory';
    this.title.iconClass = codicon('database');
    this.title.closable = true;
    this.addClass('cc-vice-memory-widget');

    this.toDispose.pushAll([
      this.debugSessionManager.onDidChangeActiveDebugSession(() =>
        this.handleDebugSessionChanged()
      ),
      this.debugSessionManager.onDidChange(() =>
        this.handleDebugSessionChanged()
      ),
      this.debugSessionManager.onDidFocusStackFrame(() =>
        this.refreshIfReady()
      )
    ]);
    void this.restoreState();
  }

  override dispose(): void {
    this.toDispose.dispose();
    super.dispose();
  }

  protected override onActivateRequest(msg: Message): void {
    super.onActivateRequest(msg);
    this.node.focus();
  }

  protected async restoreState(): Promise<void> {
    const state = await this.storageService.getData<PersistedMemoryViewState>(
      STORAGE_KEY,
      {}
    );
    this.expressionInput = state.expressionInput ?? this.expressionInput;
    this.lengthInput = state.lengthInput ?? this.lengthInput;
    this.memspaceInput =
      normalizeMemorySpaceInput(state.memspaceInput) ?? this.memspaceInput;
    this.bankInput = state.bankInput ?? this.bankInput;
    this.customCharset = state.customCharset ?? this.customCharset;
    this.characterSet = isMemoryCharacterSet(state.characterSet)
      ? state.characterSet
      : this.characterSet;
    this.bytesPerRow = isSupportedColumnCount(state.bytesPerRow)
      ? state.bytesPerRow
      : this.bytesPerRow;
    this.textMode = isMemoryTextMode(state.textMode)
      ? state.textMode
      : this.textMode;
    this.sideEffects = state.sideEffects ?? this.sideEffects;
    this.autoRefresh = state.autoRefresh ?? this.autoRefresh;
    this.advancedOpen = state.advancedOpen ?? this.advancedOpen;
    this.update();
    this.refreshIfReady();
  }

  protected saveState(): void {
    void this.storageService.setData<PersistedMemoryViewState>(STORAGE_KEY, {
      advancedOpen: this.advancedOpen,
      autoRefresh: this.autoRefresh,
      bankInput: this.bankInput,
      bytesPerRow: this.bytesPerRow,
      characterSet: this.characterSet,
      customCharset: this.customCharset,
      expressionInput: this.expressionInput,
      lengthInput: this.lengthInput,
      memspaceInput: this.memspaceInput,
      sideEffects: this.sideEffects,
      textMode: this.textMode
    });
  }

  protected handleDebugSessionChanged(): void {
    this.updateSessionStatus();
    this.refreshIfReady();
  }

  protected refreshIfReady(): void {
    const session = this.currentViceSession();
    if (
      !this.autoRefresh ||
      this.loading ||
      !session ||
      session.state !== DebugState.Stopped
    ) {
      this.update();
      return;
    }
    void this.refreshMemory();
  }

  protected updateSessionStatus(): void {
    const session = this.currentViceSession();
    if (!session) {
      this.status = 'Start a VICE debug session to read memory.';
      return;
    }
    if (!session.capabilities.supportsReadMemoryRequest) {
      this.status = 'The active debug session does not support memory reads.';
      return;
    }
    if (session.state !== DebugState.Stopped) {
      this.status = 'Pause or stop at a breakpoint to refresh memory.';
      return;
    }
    this.status = 'Ready to read memory.';
  }

  protected currentViceSession(): DebugSession | undefined {
    const session = this.debugSessionManager.currentSession;
    return session?.configuration.type === COMMODORE_VICE_DEBUG_TYPE
      ? session
      : undefined;
  }

  protected canWriteCurrentSession(): boolean {
    const session = this.currentViceSession();
    return Boolean(
      session &&
      session.state === DebugState.Stopped &&
      session.capabilities.supportsWriteMemoryRequest
    );
  }

  protected async refreshMemory(): Promise<void> {
    const session = this.currentViceSession();
    if (!session) {
      this.error = undefined;
      this.status = 'Start a VICE debug session to read memory.';
      this.update();
      return;
    }
    if (!session.capabilities.supportsReadMemoryRequest) {
      this.error = undefined;
      this.status = 'The active debug session does not support memory reads.';
      this.update();
      return;
    }
    if (session.state !== DebugState.Stopped) {
      this.error = undefined;
      this.status = 'Pause or stop at a breakpoint to refresh memory.';
      this.update();
      return;
    }

    this.loading = true;
    this.error = undefined;
    this.status = 'Reading memory...';
    this.update();

    try {
      const monitorRequests = await this.resolveMonitorRequests(session);
      const options = this.memoryRequestOptions();
      const previous = this.snapshot;
      const blocks: MemoryBlockSnapshot[] = [];
      for (const monitorRequest of monitorRequests) {
        const requestArguments = {
          memoryReference: memoryReference(monitorRequest.startAddress),
          count: monitorRequest.length,
          ...options
        } as DebugRequestTypes['readMemory'][0] & MemoryRequestOptions;
        const response = await session.sendRequest(
          'readMemory',
          requestArguments,
          MEMORY_READ_TIMEOUT_MS
        );
        const body = response.body;
        const bytes = body?.data ? decodeBase64(body.data) : new Uint8Array(0);
        const responseAddress = body?.address
          ? parseOptionalAddress(body.address) ?? monitorRequest.startAddress
          : monitorRequest.startAddress;
        const previousBlock = previous?.blocks.find((block) =>
          block.startAddress === responseAddress &&
          block.length === monitorRequest.length
        );
        blocks.push({
          ...monitorRequest,
          startAddress: responseAddress,
          bytes,
          changedOffsets: findChangedOffsets(previousBlock, bytes)
        });
      }
      this.snapshot = {
        blocks,
        loadedAt: Date.now()
      };
      const byteCount = blocks.reduce((count, block) => count + block.bytes.length, 0);
      this.status = `Read ${byteCount} byte(s) from ${blocks.length} monitor(s).`;
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.status = 'Memory read failed.';
    } finally {
      this.loading = false;
      this.update();
    }
  }

  protected async resolveMonitorRequests(
    session: DebugSession
  ): Promise<MemoryMonitorRequest[]> {
    const defaultLength = parseMemoryLength(this.lengthInput);
    const expressions = this.expressionInput
      .split(',')
      .map((expression) => expression.trim())
      .filter((expression) => expression.length > 0);
    if (expressions.length === 0) {
      throw new Error('Enter at least one address or range.');
    }

    const requests: MemoryMonitorRequest[] = [];
    for (const expression of expressions) {
      const rangeSeparator = findRangeSeparator(expression);
      if (rangeSeparator >= 0) {
        const startExpression = expression.slice(0, rangeSeparator).trim();
        const endExpression = expression.slice(rangeSeparator + 1).trim();
        const startAddress = await this.resolveAddress(session, startExpression);
        const endAddress = await this.resolveAddress(session, endExpression);
        if (endAddress < startAddress) {
          throw new Error(`Range end is before start: ${expression}`);
        }
        const length = endAddress - startAddress + 1;
        validateMemoryRange(startAddress, length);
        requests.push({ expression, startAddress, length });
      } else {
        const startAddress = await this.resolveAddress(session, expression);
        validateMemoryRange(startAddress, defaultLength);
        requests.push({ expression, startAddress, length: defaultLength });
      }
    }
    return requests;
  }

  protected async resolveAddress(
    session: DebugSession,
    input: string
  ): Promise<number> {
    const parsed = parseOptionalAddress(input);
    if (parsed !== undefined) {
      return parsed;
    }

    const result = await session.evaluate(input.trim(), 'watch');
    const evaluatedAddress =
      parseOptionalAddress(result.memoryReference ?? '') ??
      parseOptionalAddress(result.result);
    if (evaluatedAddress === undefined) {
      throw new Error(`Could not resolve memory address: ${input}`);
    }
    return evaluatedAddress;
  }

  protected memoryRequestOptions(): MemoryRequestOptions {
    return {
      sideEffects: this.sideEffects,
      memspace: parseByteInput(this.memspaceInput),
      bankId: parseWordInput(this.bankInput)
    };
  }

  protected setPreset(preset: MemoryPreset): void {
    this.expressionInput = preset.expression;
    this.lengthInput = preset.length;
    if (preset.bytesPerRow) {
      this.bytesPerRow = preset.bytesPerRow;
    }
    if (preset.textMode) {
      this.textMode = preset.textMode;
    }
    this.saveState();
    this.update();
    this.refreshIfReady();
  }

  showScreenPresetForScreenCapture(): void {
    const screenPreset = MEMORY_PRESETS.find(
      (preset) => preset.label === 'Screen'
    );
    if (screenPreset) {
      this.setPreset(screenPreset);
    }
  }

  showRangeForScreenCapture(
    expression: string,
    length = '1',
    bytesPerRow?: number,
    textMode?: string
  ): void {
    this.expressionInput = expression;
    this.lengthInput = length;
    if (bytesPerRow !== undefined && isSupportedColumnCount(bytesPerRow)) {
      this.bytesPerRow = bytesPerRow;
    }
    if (isMemoryTextMode(textMode)) {
      this.textMode = textMode;
    }
    this.saveState();
    this.update();
    this.refreshIfReady();
  }

  revealTextColumnForScreenCapture(): void {
    const table = this.node.querySelector('table');
    const scrollContainer = table?.parentElement;
    if (scrollContainer instanceof HTMLElement) {
      scrollContainer.scrollLeft = scrollContainer.scrollWidth;
    }
  }

  protected async useProgramCounter(): Promise<void> {
    const session = this.currentViceSession();
    if (!session || session.state !== DebugState.Stopped) {
      this.error = 'Pause or stop at a breakpoint before using PC.';
      this.update();
      return;
    }
    try {
      const result = await session.evaluate('PC', 'watch');
      const address =
        parseOptionalAddress(result.memoryReference ?? '') ??
        parseOptionalAddress(result.result);
      if (address === undefined) {
        throw new Error('Could not resolve PC.');
      }
      this.expressionInput = memoryReference(address);
      this.saveState();
      this.update();
      this.refreshIfReady();
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.update();
    }
  }

  protected async writeByte(address: number, value: number): Promise<void> {
    const session = this.currentViceSession();
    if (!session) {
      throw new Error('Start a VICE debug session to edit memory.');
    }
    if (!session.capabilities.supportsWriteMemoryRequest) {
      throw new Error('The active debug session does not support memory writes.');
    }
    if (session.state !== DebugState.Stopped) {
      throw new Error('Pause or stop at a breakpoint before editing memory.');
    }
    const requestArguments = {
      memoryReference: memoryReference(address),
      data: encodeBase64(Uint8Array.of(value)),
      ...this.memoryRequestOptions()
    } as DebugRequestTypes['writeMemory'][0] & MemoryRequestOptions;
    await session.sendRequest('writeMemory', requestArguments, MEMORY_READ_TIMEOUT_MS);
    await this.refreshMemory();
  }

  protected commitByteEdit(
    event: React.FocusEvent<HTMLInputElement>,
    address: number,
    originalHex: string
  ): void {
    const input = event.currentTarget;
    const value = parseHexByte(input.value);
    if (value === undefined) {
      const attempted = input.value;
      input.value = originalHex;
      this.error = `Invalid byte value: ${attempted}`;
      this.update();
      return;
    }
    if (value === Number.parseInt(originalHex, 16)) {
      input.value = originalHex;
      return;
    }
    void this.writeByte(address, value)
      .catch((error) => {
        input.value = originalHex;
        this.error = error instanceof Error ? error.message : String(error);
        this.update();
      });
  }

  protected render(): React.ReactNode {
    return (
      <div
        style={{
          background: 'var(--theia-editor-background)',
          color: 'var(--theia-foreground)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0
        }}
      >
        {this.renderToolbar()}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            padding: '8px'
          }}
        >
          {this.renderStatus()}
          {this.snapshot && this.snapshot.blocks.length > 0
            ? this.renderTable(this.snapshot)
            : this.renderEmpty()}
        </div>
      </div>
    );
  }

  protected renderToolbar(): React.ReactNode {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void this.refreshMemory();
        }}
        style={{
          alignItems: 'center',
          background: 'var(--theia-editorWidget-background)',
          borderBottom: '1px solid var(--theia-editorGroup-border)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '6px 8px'
        }}
      >
        {this.renderTextInput(
          'Address',
          this.expressionInput,
          (value) => {
            this.expressionInput = value;
          },
          'Address, range, label, or comma-separated monitors, e.g. $0400-$07E7, message'
        )}
        {this.renderTextInput(
          'Length',
          this.lengthInput,
          (value) => {
            this.lengthInput = value;
          },
          `Bytes to read when no range is given, max ${MAX_MEMORY_READ_LENGTH}`
        )}
        <label style={labelStyle}>
          <span>Columns</span>
          <select
            value={this.bytesPerRow}
            onChange={(event) => {
              this.bytesPerRow = Number(event.currentTarget.value);
              this.saveState();
              this.update();
            }}
            style={selectStyle}
          >
            <option value={8}>8</option>
            <option value={16}>16</option>
            <option value={32}>32</option>
            <option value={40}>40</option>
          </select>
        </label>
        <label style={labelStyle}>
          <span>Text</span>
          <select
            value={this.textMode}
            onChange={(event) => {
              this.textMode = event.currentTarget.value as MemoryTextMode;
              this.saveState();
              this.update();
            }}
            style={selectStyle}
          >
            <option value='ascii'>ASCII</option>
            <option value='petscii'>PETSCII</option>
            <option value='screen'>C64 Screen</option>
            <option value='custom'>Custom</option>
          </select>
        </label>
        {this.usesCommodoreCharacterSet()
          ? this.renderCharacterSetSelect()
          : undefined}
        {this.textMode === 'custom'
          ? this.renderTextInput(
              'Map',
              this.customCharset,
              (value) => {
                this.customCharset = value;
              },
              'Optional 256-character byte-to-text map'
            )
          : undefined}
        <button
          className='theia-button'
          disabled={this.loading}
          title='Read memory from the active stopped VICE debug session'
          type='submit'
        >
          Refresh
        </button>
        <button
          className='theia-button secondary'
          disabled={this.loading}
          onClick={() => {
            void this.useProgramCounter();
          }}
          title='Use the current program counter as the memory address'
          type='button'
        >
          PC
        </button>
        {this.renderAdvancedControls()}
        <label
          title='Refresh whenever the active VICE session stops'
          style={inlineCheckboxStyle}
        >
          <input
            type='checkbox'
            checked={this.autoRefresh}
            onChange={(event) => {
              this.autoRefresh = event.currentTarget.checked;
              this.saveState();
              this.update();
              this.refreshIfReady();
            }}
          />
          <span>Auto</span>
        </label>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            marginLeft: 'auto'
          }}
        >
          {MEMORY_PRESETS.map((preset) => (
            <button
              key={preset.label}
              className='theia-button secondary'
              onClick={() => this.setPreset(preset)}
              title={`${preset.expression}, ${preset.length} bytes`}
              type='button'
            >
              {preset.label}
            </button>
          ))}
        </div>
      </form>
    );
  }

  protected usesCommodoreCharacterSet(): boolean {
    return this.textMode === 'petscii' || this.textMode === 'screen';
  }

  protected renderCharacterSetSelect(): React.ReactNode {
    return (
      <label
        style={labelStyle}
        title='C64 character ROM bank used for PETSCII and screen-code glyphs'
      >
        <span>Charset</span>
        <select
          value={this.characterSet}
          onChange={(event) => {
            this.characterSet = event.currentTarget.value as MemoryCharacterSet;
            this.saveState();
            this.update();
          }}
          style={{ ...selectStyle, width: '116px' }}
        >
          {CHARACTER_SET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  protected renderAdvancedControls(): React.ReactNode {
    return (
      <details
        open={this.advancedOpen}
        onToggle={(event) => {
          const open = event.currentTarget.open;
          if (this.advancedOpen !== open) {
            this.advancedOpen = open;
            this.saveState();
            this.update();
          }
        }}
        style={advancedDetailsStyle}
      >
        <summary style={advancedSummaryStyle}>Advanced</summary>
        <div style={advancedContentStyle}>
          {this.renderMemorySpaceSelect()}
          {this.renderBankInput()}
          <label
            title='Read/write through VICE with side effects enabled'
            style={inlineCheckboxStyle}
          >
            <input
              type='checkbox'
              checked={this.sideEffects}
              onChange={(event) => {
                this.sideEffects = event.currentTarget.checked;
                this.saveState();
                this.update();
              }}
            />
            <span>Effects</span>
          </label>
        </div>
      </details>
    );
  }

  protected renderMemorySpaceSelect(): React.ReactNode {
    return (
      <label style={labelStyle} title='VICE memory space'>
        <span>Space</span>
        <select
          value={this.memspaceInput}
          onChange={(event) => {
            this.memspaceInput = event.currentTarget.value;
            this.saveState();
            this.update();
          }}
          style={{ ...selectStyle, width: '118px' }}
        >
          {MEMORY_SPACE_OPTIONS.map((space) => (
            <option key={space.value} title={space.title} value={space.value}>
              {space.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  protected renderBankInput(): React.ReactNode {
    return (
      <label
        style={labelStyle}
        title='VICE bank id, usually 0 for the active C64 bank'
      >
        <span>Bank</span>
        <input
          list={MEMORY_BANK_DATALIST_ID}
          value={this.bankInput}
          onChange={(event) => {
            this.bankInput = event.currentTarget.value;
            this.saveState();
            this.update();
          }}
          style={{ ...inputStyle, width: '76px' }}
        />
        <datalist id={MEMORY_BANK_DATALIST_ID}>
          {MEMORY_BANK_OPTIONS.map((bank) => (
            <option key={bank.value} label={bank.label} value={bank.value} />
          ))}
        </datalist>
      </label>
    );
  }

  protected renderTextInput(
    label: string,
    value: string,
    update: (value: string) => void,
    title: string
  ): React.ReactNode {
    const width = label === 'Address'
      ? '176px'
      : label === 'Map'
        ? '220px'
        : '72px';
    return (
      <label style={labelStyle} title={title}>
        <span>{label}</span>
        <input
          value={value}
          onChange={(event) => {
            update(event.currentTarget.value);
            this.saveState();
            this.update();
          }}
          style={{ ...inputStyle, width }}
        />
      </label>
    );
  }

  protected renderStatus(): React.ReactNode {
    return (
      <div
        style={{
          color: this.error
            ? 'var(--theia-errorForeground)'
            : 'var(--theia-descriptionForeground)',
          fontSize: '12px',
          marginBottom: '8px'
        }}
      >
        {this.error ?? this.status}
        {this.snapshot
          ? ` Last read ${formatTime(this.snapshot.loadedAt)}.`
          : ''}
        {this.canWriteCurrentSession()
          ? ' Edit a hex byte and press Enter or leave the cell to write.'
          : ''}
      </div>
    );
  }

  protected renderEmpty(): React.ReactNode {
    return (
      <div
        style={{
          border: '1px solid var(--theia-editorGroup-border)',
          color: 'var(--theia-descriptionForeground)',
          fontSize: '12px',
          padding: '12px'
        }}
      >
        Memory bytes will appear here after a stopped VICE debug session is refreshed.
      </div>
    );
  }

  protected renderTable(snapshot: MemorySnapshot): React.ReactNode {
    const colSpan = this.bytesPerRow + 2;
    return (
      <table
        style={{
          borderCollapse: 'collapse',
          fontFamily: 'monospace',
          fontSize: '12px',
          minWidth: '100%',
          tableLayout: 'fixed'
        }}
      >
        <thead>
          <tr>
            <th style={addressHeaderCellStyle}>Address</th>
            {Array.from({ length: this.bytesPerRow }, (_, offset) => (
              <th key={offset} style={headerCellStyle}>
                {offset.toString(16).toUpperCase().padStart(2, '0')}
              </th>
            ))}
            <th style={textHeaderCellStyle}>Text</th>
          </tr>
        </thead>
        <tbody>
          {snapshot.blocks.flatMap((block) => {
            const blockKey = memoryBlockKey(block);
            return [
              this.renderBlockHeader(block, colSpan, blockKey),
              ...createMemoryRows(
                block,
                this.bytesPerRow,
                this.textMode,
                this.customCharset
              )
                .map((row) => this.renderMemoryRow(row, blockKey))
            ];
          })}
        </tbody>
      </table>
    );
  }

  protected renderBlockHeader(
    block: MemoryBlockSnapshot,
    colSpan: number,
    blockKey: string
  ): React.ReactNode {
    return (
      <tr key={`${blockKey}:header`}>
        <td colSpan={colSpan} style={blockHeaderCellStyle}>
          {block.expression} {formatAddress(block.startAddress)}-
          {formatAddress(block.startAddress + block.length - 1)}
        </td>
      </tr>
    );
  }

  protected renderMemoryRow(row: MemoryRow, blockKey: string): React.ReactNode {
    return (
      <tr key={`${blockKey}:row:${row.address}`}>
        <td style={addressCellStyle}>{formatAddress(row.address)}</td>
        {row.cells.map((cell) => (
          <td
            key={`${blockKey}:cell:${cell.address}`}
            style={cell.changed ? changedByteCellStyle : byteCellStyle}
            title={cell.title}
          >
            {cell.hex
              ? (
                <input
                  defaultValue={cell.hex}
                  key={`${blockKey}:input:${cell.address}:${cell.hex}`}
                  maxLength={2}
                  onBlur={(event) =>
                    this.commitByteEdit(event, cell.address, cell.hex)
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur();
                    } else if (event.key === 'Escape') {
                      event.currentTarget.value = cell.hex;
                      event.currentTarget.blur();
                    }
                  }}
                  readOnly={!this.canWriteCurrentSession()}
                  style={byteInputStyle}
                  title={cell.title}
                />
              )
              : ''}
          </td>
        ))}
        <td style={textCellStyle}>
          {row.text.map((cell, index) =>
            this.renderTextCell(cell, `${blockKey}:text:${row.address}:${index}`)
          )}
        </td>
      </tr>
    );
  }

  protected renderTextCell(cell: MemoryTextCell, key: string): React.ReactNode {
    switch (cell.kind) {
      case 'glyph':
        return this.renderCharacterGlyph(cell, key);
      case 'control':
        return (
          <span key={key} style={textControlCellStyle} title={cell.title}>
            {cell.label}
          </span>
        );
      case 'text':
      default:
        return (
          <span key={key} style={textPlainCellStyle} title={cell.title}>
            {cell.text}
          </span>
        );
    }
  }

  protected renderCharacterGlyph(
    cell: MemoryTextCell,
    key: string
  ): React.ReactNode {
    return (
      <span key={key} style={textGlyphCellStyle} title={cell.title}>
        <span
          aria-hidden='true'
          style={{
            ...textGlyphPixelStyle,
            boxShadow: characterGlyphShadow(
              this.characterSet,
              cell.glyphIndex ?? 0
            )
          }}
        />
      </span>
    );
  }
}

const labelStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  fontSize: '12px',
  gap: '4px',
  whiteSpace: 'nowrap'
};

const inlineCheckboxStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  fontSize: '12px',
  gap: '4px',
  whiteSpace: 'nowrap'
};

const advancedDetailsStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  gap: '8px',
  minHeight: '24px'
};

const advancedSummaryStyle: React.CSSProperties = {
  color: 'var(--theia-foreground)',
  cursor: 'pointer',
  fontSize: '12px',
  lineHeight: '24px',
  padding: '0 2px',
  userSelect: 'none'
};

const advancedContentStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'inline-flex',
  flexWrap: 'wrap',
  gap: '8px'
};

const inputStyle: React.CSSProperties = {
  background: 'var(--theia-input-background)',
  border: '1px solid var(--theia-input-border)',
  color: 'var(--theia-input-foreground)',
  fontFamily: 'monospace',
  fontSize: '12px',
  height: '22px',
  padding: '0 5px'
};

const selectStyle: React.CSSProperties = {
  background: 'var(--theia-dropdown-background)',
  border: '1px solid var(--theia-dropdown-border)',
  color: 'var(--theia-dropdown-foreground)',
  fontSize: '12px',
  height: '24px'
};

const headerCellStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--theia-editorGroup-border)',
  color: 'var(--theia-descriptionForeground)',
  fontWeight: 600,
  padding: '3px 4px',
  textAlign: 'center',
  width: '30px'
};

const addressHeaderCellStyle: React.CSSProperties = {
  ...headerCellStyle,
  textAlign: 'left',
  width: '72px'
};

const textHeaderCellStyle: React.CSSProperties = {
  ...headerCellStyle,
  textAlign: 'left',
  width: '220px'
};

const blockHeaderCellStyle: React.CSSProperties = {
  background: 'var(--theia-editorWidget-background)',
  borderBottom: '1px solid var(--theia-editorGroup-border)',
  color: 'var(--theia-descriptionForeground)',
  fontWeight: 600,
  padding: '5px 4px',
  textAlign: 'left'
};

const addressCellStyle: React.CSSProperties = {
  borderBottom: '1px solid color-mix(in srgb, var(--theia-editorGroup-border) 45%, transparent)',
  color: 'var(--theia-descriptionForeground)',
  padding: '2px 4px',
  whiteSpace: 'nowrap'
};

const byteCellStyle: React.CSSProperties = {
  borderBottom: '1px solid color-mix(in srgb, var(--theia-editorGroup-border) 45%, transparent)',
  padding: '0',
  textAlign: 'center'
};

const changedByteCellStyle: React.CSSProperties = {
  ...byteCellStyle,
  background: 'var(--theia-editor-findMatchHighlightBackground, rgba(234, 92, 0, 0.25))',
  color: 'var(--theia-editor-foreground)'
};

const byteInputStyle: React.CSSProperties = {
  background: 'transparent',
  border: '0',
  color: 'inherit',
  fontFamily: 'monospace',
  fontSize: '12px',
  height: '20px',
  outline: '0',
  padding: '0',
  textAlign: 'center',
  textTransform: 'uppercase',
  width: '100%'
};

const textCellStyle: React.CSSProperties = {
  borderBottom: '1px solid color-mix(in srgb, var(--theia-editorGroup-border) 45%, transparent)',
  padding: '2px 8px',
  whiteSpace: 'pre'
};

const textGlyphCellStyle: React.CSSProperties = {
  display: 'inline-block',
  height: `${C64_GLYPH_PIXEL_SIZE * 8}px`,
  marginRight: '1px',
  position: 'relative',
  verticalAlign: 'text-bottom',
  width: `${C64_GLYPH_PIXEL_SIZE * 8}px`
};

const textGlyphPixelStyle: React.CSSProperties = {
  height: `${C64_GLYPH_PIXEL_SIZE}px`,
  left: 0,
  position: 'absolute',
  top: 0,
  width: `${C64_GLYPH_PIXEL_SIZE}px`
};

const textControlCellStyle: React.CSSProperties = {
  alignItems: 'center',
  border: '1px solid color-mix(in srgb, var(--theia-descriptionForeground) 55%, transparent)',
  boxSizing: 'border-box',
  color: 'var(--theia-descriptionForeground)',
  display: 'inline-flex',
  fontFamily: 'monospace',
  fontSize: '6px',
  height: `${C64_GLYPH_PIXEL_SIZE * 8}px`,
  justifyContent: 'center',
  lineHeight: 1,
  marginRight: '1px',
  overflow: 'hidden',
  verticalAlign: 'text-bottom',
  width: `${C64_GLYPH_PIXEL_SIZE * 8}px`
};

const textPlainCellStyle: React.CSSProperties = {
  display: 'inline-block',
  minWidth: '1ch'
};

function createMemoryRows(
  block: MemoryBlockSnapshot,
  bytesPerRow: number,
  textMode: MemoryTextMode,
  customCharset: string
): MemoryRow[] {
  const rows: MemoryRow[] = [];
  const textState: MemoryTextRenderState = {
    petsciiReverse: false
  };
  for (let offset = 0; offset < block.bytes.length; offset += bytesPerRow) {
    const rowBytes = block.bytes.subarray(offset, offset + bytesPerRow);
    const cells = Array.from({ length: bytesPerRow }, (_, index) => {
      const value = rowBytes[index];
      const address = block.startAddress + offset + index;
      return value === undefined
        ? { address, hex: '', title: '', changed: false }
        : {
            address,
            hex: value.toString(16).toUpperCase().padStart(2, '0'),
            title: `${formatAddress(address)} = ${value}`,
            changed: block.changedOffsets.has(offset + index)
          };
    });
    rows.push({
      address: block.startAddress + offset,
      cells,
      text: [...rowBytes]
        .map((value) =>
          renderTextByte(value, textMode, customCharset, textState)
        )
    });
  }
  return rows;
}

function memoryBlockKey(block: MemoryBlockSnapshot): string {
  return `${block.expression}:${block.startAddress}:${block.length}`;
}

function normalizeMemorySpaceInput(input: string | undefined): string | undefined {
  if (input === undefined) {
    return undefined;
  }
  const value = parseOptionalAddress(input);
  if (value === undefined) {
    return undefined;
  }
  const normalized = value.toString(10);
  return MEMORY_SPACE_OPTIONS.some((option) => option.value === normalized)
    ? normalized
    : undefined;
}

function findChangedOffsets(
  previous: MemoryBlockSnapshot | undefined,
  bytes: Uint8Array
): ReadonlySet<number> {
  const changed = new Set<number>();
  if (!previous) {
    return changed;
  }
  const length = Math.min(previous.bytes.length, bytes.length);
  for (let index = 0; index < length; index += 1) {
    if (previous.bytes[index] !== bytes[index]) {
      changed.add(index);
    }
  }
  return changed;
}

function renderTextByte(
  value: number,
  textMode: MemoryTextMode,
  customCharset: string,
  textState: MemoryTextRenderState
): MemoryTextCell {
  switch (textMode) {
    case 'petscii':
      return renderPetsciiByte(value, textState);
    case 'screen':
      return renderScreenCode(value);
    case 'custom':
      return {
        kind: 'text',
        text: customCharset[value] ?? '.',
        title: `Byte ${formatByte(value)}`
      };
    case 'ascii':
    default:
      return renderAsciiByte(value);
  }
}

function renderAsciiByte(value: number): MemoryTextCell {
  const text = value >= 0x20 && value <= 0x7e
    ? String.fromCharCode(value)
    : '.';
  return {
    kind: 'text',
    text,
    title: `ASCII ${formatByte(value)}`
  };
}

function renderPetsciiByte(
  value: number,
  textState: MemoryTextRenderState
): MemoryTextCell {
  const control = PETSCII_CONTROL_LABELS[value];
  if (control) {
    if (value === 0x12) {
      textState.petsciiReverse = true;
    } else if (value === 0x92) {
      textState.petsciiReverse = false;
    }
    return {
      kind: 'control',
      label: control.label,
      title: `PETSCII ${formatByte(value)}: ${control.title}`
    };
  }
  const screenCode = petsciiToScreenCode(value);
  if (screenCode !== undefined) {
    const glyphIndex = textState.petsciiReverse
      ? screenCode | 0x80
      : screenCode;
    return {
      kind: 'glyph',
      glyphIndex,
      title: `PETSCII ${formatByte(value)} -> C64 screen ${formatByte(glyphIndex)}`
    };
  }
  return {
    kind: 'control',
    label: formatByte(value).slice(1),
    title: `Unmapped PETSCII byte ${formatByte(value)}`
  };
}

function renderScreenCode(value: number): MemoryTextCell {
  return {
    kind: 'glyph',
    glyphIndex: value & 0xff,
    title: `C64 screen code ${formatByte(value)}${value & 0x80 ? ' (reverse)' : ''}`
  };
}

function petsciiToScreenCode(value: number): number | undefined {
  if (value >= 0x20 && value <= 0x3f) {
    return value;
  }
  if (value >= 0x40 && value <= 0x5f) {
    return value - 0x40;
  }
  if (value >= 0x60 && value <= 0x7f) {
    return value - 0x20;
  }
  if (value >= 0xa0 && value <= 0xbf) {
    return value - 0x40;
  }
  if (value === 0xc0) {
    return 0x40;
  }
  if (value >= 0xc1 && value <= 0xda) {
    return value - 0xc0;
  }
  if (value >= 0xdb && value <= 0xdf) {
    return value - 0xc0;
  }
  if (value >= 0xe0 && value <= 0xff) {
    return value - 0x80;
  }
  return undefined;
}

function parseMemoryLength(input: string): number {
  const parsed = parseOptionalAddress(input);
  if (parsed === undefined || parsed <= 0) {
    throw new Error(`Invalid memory length: ${input}`);
  }
  if (parsed > MAX_MEMORY_READ_LENGTH) {
    throw new Error(`Memory length must be ${MAX_MEMORY_READ_LENGTH} bytes or less.`);
  }
  return parsed;
}

function parseOptionalAddress(input: string): number | undefined {
  const value = input.trim();
  if (/^\$[0-9a-f]+$/iu.test(value)) {
    return clampWord(Number.parseInt(value.slice(1), 16));
  }
  if (/^0x[0-9a-f]+$/iu.test(value)) {
    return clampWord(Number.parseInt(value.slice(2), 16));
  }
  if (/^[0-9]+$/u.test(value)) {
    return clampWord(Number.parseInt(value, 10));
  }
  return undefined;
}

function parseByteInput(input: string): number {
  const value = parseOptionalAddress(input);
  if (value === undefined || value > 0xff) {
    throw new Error(`Value must be between $00 and $FF: ${input}`);
  }
  return value;
}

function parseWordInput(input: string): number {
  const value = parseOptionalAddress(input);
  if (value === undefined) {
    throw new Error(`Value must be between $0000 and $FFFF: ${input}`);
  }
  return value;
}

function parseHexByte(input: string): number | undefined {
  const value = input.trim();
  if (!/^[0-9a-f]{1,2}$/iu.test(value)) {
    return undefined;
  }
  return Number.parseInt(value, 16);
}

function clampWord(value: number): number | undefined {
  if (!Number.isFinite(value) || value < 0 || value > 0xffff) {
    return undefined;
  }
  return value;
}

function validateMemoryRange(startAddress: number, length: number): void {
  if (length <= 0) {
    throw new Error('Memory range must contain at least one byte.');
  }
  if (length > MAX_MEMORY_READ_LENGTH) {
    throw new Error(`Memory ranges are limited to ${MAX_MEMORY_READ_LENGTH} bytes.`);
  }
  if (startAddress + length > 0x10000) {
    throw new Error('Memory range must stay within $0000-$FFFF.');
  }
}

function findRangeSeparator(expression: string): number {
  const index = expression.indexOf('-');
  return index > 0 && index < expression.length - 1 ? index : -1;
}

function memoryReference(address: number): string {
  return `0x${address.toString(16).toUpperCase().padStart(4, '0')}`;
}

function formatAddress(address: number): string {
  return `$${(address & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`;
}

function formatByte(value: number): string {
  return `$${(value & 0xff).toString(16).toUpperCase().padStart(2, '0')}`;
}

function characterGlyphShadow(
  characterSet: MemoryCharacterSet,
  glyphIndex: number
): string {
  const cacheKey = `${characterSet}:${glyphIndex & 0xff}`;
  const cached = characterGlyphShadowCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  const bitmap = C64_CHARACTER_BITMAPS[characterSet];
  const offset = (glyphIndex & 0xff) * 8;
  const shadows: string[] = [];
  for (let y = 0; y < 8; y += 1) {
    const row = bitmap[offset + y] ?? 0;
    for (let x = 0; x < 8; x += 1) {
      if ((row & (0x80 >> x)) !== 0) {
        shadows.push(
          `${x * C64_GLYPH_PIXEL_SIZE}px ${y * C64_GLYPH_PIXEL_SIZE}px 0 currentColor`
        );
      }
    }
  }
  const shadow = shadows.join(', ');
  characterGlyphShadowCache.set(cacheKey, shadow);
  return shadow;
}

export function c64CharacterSetBytes(characterSet: MemoryCharacterSet): Uint8Array {
  return C64_CHARACTER_BITMAPS[characterSet];
}

function decodeBase64(data: string): Uint8Array {
  const decoded = atob(data);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}

function encodeBase64(bytes: Uint8Array): string {
  let decoded = '';
  for (const byte of bytes) {
    decoded += String.fromCharCode(byte);
  }
  return btoa(decoded);
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

function isSupportedColumnCount(value: number | undefined): value is number {
  return value === 8 || value === 16 || value === 32 || value === 40;
}

function isMemoryTextMode(value: string | undefined): value is MemoryTextMode {
  return value === 'ascii' ||
    value === 'petscii' ||
    value === 'screen' ||
    value === 'custom';
}

function isMemoryCharacterSet(
  value: string | undefined
): value is MemoryCharacterSet {
  return value === 'upper' || value === 'lower';
}
