import * as React from 'react';

import { codicon, ReactWidget } from '@theia/core/lib/browser';
import { StorageService } from '@theia/core/lib/browser/storage-service';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { DisposableCollection } from '@theia/core/lib/common';
import { DebugSession, DebugState } from '@theia/debug/lib/browser/debug-session';
import type { DebugRequestTypes } from '@theia/debug/lib/browser/debug-session-connection';
import { DebugSessionManager } from '@theia/debug/lib/browser/debug-session-manager';
import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';

import {
  C64_COLOR_PALETTE
} from '../common/commodore-character-set-format';
import { COMMODORE_VICE_DEBUG_TYPE } from '../common/commodore-vice-debug';
import {
  c64CharacterSetBytes,
  type MemoryCharacterSet
} from './vice-memory-widget';

export const C64_VISUAL_DEBUGGER_WIDGET_ID =
  'commodore-commander.c64-visual-debugger';

export type C64VisualDebuggerView = 'overview' | 'sprites' | 'screen' | 'cia';

interface PersistedC64VisualDebuggerState {
  autoRefresh?: boolean;
  selectedView?: C64VisualDebuggerView;
}

interface MemoryRequestOptions {
  sideEffects?: boolean;
  memspace?: number;
  bankId?: number;
}

interface ViceMemoryBank {
  id: number;
  name: string;
}

interface ViceMemoryBanks {
  ramBankId?: number;
  ioBankId?: number;
}

interface C64VisualSnapshot {
  loadedAt: number;
  vic: Uint8Array;
  video: VideoSnapshot;
  sprites: SpriteSnapshot[];
  screenBytes: Uint8Array;
  colorBytes: Uint8Array;
  characterBytes: Uint8Array;
  cia1: CiaSnapshot;
  cia2: CiaSnapshot;
}

interface VideoSnapshot {
  bankSelect: number;
  bankBase: number;
  screenBase: number;
  characterBase: number;
  bitmapBase: number;
  rasterLine: number;
  rasterCycle?: number;
  control1: number;
  control2: number;
  memoryControl: number;
  displayEnabled: boolean;
  displayMode: string;
  rows: 24 | 25;
  columns: 38 | 40;
  xScroll: number;
  yScroll: number;
  borderColor: number;
  backgroundColors: number[];
  spriteMulticolor0: number;
  spriteMulticolor1: number;
  irqStatus: IrqSnapshot;
  irqMask: IrqSnapshot;
}

interface IrqSnapshot {
  raster: boolean;
  spriteBackground: boolean;
  spriteSprite: boolean;
  lightPen: boolean;
  any: boolean;
}

interface SpriteSnapshot {
  index: number;
  x: number;
  y: number;
  enabled: boolean;
  pointer: number;
  dataAddress: number;
  color: number;
  multicolor: boolean;
  expandX: boolean;
  expandY: boolean;
  behindBackground: boolean;
  spriteCollision: boolean;
  backgroundCollision: boolean;
  bytes: Uint8Array;
}

interface CiaSnapshot {
  label: string;
  baseAddress: number;
  registers: Uint8Array;
  pra: number;
  prb: number;
  ddra: number;
  ddrb: number;
  timerA: number;
  timerB: number;
  todTenths: number;
  todSeconds: number;
  todMinutes: number;
  todHours: number;
  serialData: number;
  interruptControl: number;
  controlA: number;
  controlB: number;
}

interface RegisterDefinition {
  offset: number;
  name: string;
}

interface ScaledPixelGridProps {
  children: React.ReactNode;
  minScale?: number;
  naturalHeight: number;
  naturalWidth: number;
}

const STORAGE_KEY = 'commodore-commander.c64-visual-debugger.state';
const MEMORY_READ_TIMEOUT_MS = 5000;
const MAIN_MEMORY_SPACE = 0;
const ACTIVE_BANK = 0;
const C64_RAM_BANK = 1;
const C64_IO_BANK = 3;
const VIC_BASE = 0xd000;
const VIC_REGISTER_COUNT = 0x2f;
const CIA1_BASE = 0xdc00;
const CIA2_BASE = 0xdd00;
const CIA_REGISTER_COUNT = 0x10;
const SCREEN_COLUMNS = 40;
const SCREEN_ROWS = 25;
const SCREEN_CELL_COUNT = SCREEN_COLUMNS * SCREEN_ROWS;
const SCREEN_MATRIX_BYTES = 0x0400;
const COLOR_RAM_BYTES = 0x0400;
const SPRITE_POINTER_OFFSET = 0x03f8;
const CHARACTER_BYTES = 2048;
const SPRITE_BYTES = 64;
const SPRITE_COUNT = 8;
const SCREEN_GLYPH_PIXEL_SIZE = 2;
const SPRITE_PIXEL_SIZE = 4;
const CHARACTER_RAM_PIXEL_SIZE = 2;
const COLOR_RAM_CELL_SIZE = 6;
const COLOR_RAM_GRID_GAP = 1;
const CHARACTER_GRID_COLUMNS = 16;
const CHARACTER_GRID_ROWS = 16;
const CHARACTER_GRID_GAP = 2;
const SCREEN_GRID_BORDER_SIZE = 10;
const SCREEN_GRID_WIDTH =
  SCREEN_COLUMNS * SCREEN_GLYPH_PIXEL_SIZE * 8 + SCREEN_GRID_BORDER_SIZE * 2;
const SCREEN_GRID_HEIGHT =
  SCREEN_ROWS * SCREEN_GLYPH_PIXEL_SIZE * 8 + SCREEN_GRID_BORDER_SIZE * 2;
const CHARACTER_CELL_SIZE = CHARACTER_RAM_PIXEL_SIZE * 8;
const CHARACTER_GRID_WIDTH =
  CHARACTER_GRID_COLUMNS * CHARACTER_CELL_SIZE +
  (CHARACTER_GRID_COLUMNS - 1) * CHARACTER_GRID_GAP;
const CHARACTER_GRID_HEIGHT =
  CHARACTER_GRID_ROWS * CHARACTER_CELL_SIZE +
  (CHARACTER_GRID_ROWS - 1) * CHARACTER_GRID_GAP;
const COLOR_RAM_GRID_WIDTH =
  SCREEN_COLUMNS * COLOR_RAM_CELL_SIZE +
  (SCREEN_COLUMNS - 1) * COLOR_RAM_GRID_GAP;
const COLOR_RAM_GRID_HEIGHT =
  SCREEN_ROWS * COLOR_RAM_CELL_SIZE +
  (SCREEN_ROWS - 1) * COLOR_RAM_GRID_GAP;
const MIN_GRID_SCALE = 0.55;

const VIEW_OPTIONS: readonly {
  view: C64VisualDebuggerView;
  label: string;
  icon: string;
}[] = [
  { view: 'overview', label: 'VIC-II', icon: 'symbol-color' },
  { view: 'sprites', label: 'Sprites', icon: 'symbol-operator' },
  { view: 'screen', label: 'Screen RAM', icon: 'layout' },
  { view: 'cia', label: 'CIA / Keyboard', icon: 'circuit-board' }
];

const VIC_REGISTER_DEFINITIONS: readonly RegisterDefinition[] = [
  { offset: 0x00, name: 'Sprite 0 X' },
  { offset: 0x01, name: 'Sprite 0 Y' },
  { offset: 0x02, name: 'Sprite 1 X' },
  { offset: 0x03, name: 'Sprite 1 Y' },
  { offset: 0x04, name: 'Sprite 2 X' },
  { offset: 0x05, name: 'Sprite 2 Y' },
  { offset: 0x06, name: 'Sprite 3 X' },
  { offset: 0x07, name: 'Sprite 3 Y' },
  { offset: 0x08, name: 'Sprite 4 X' },
  { offset: 0x09, name: 'Sprite 4 Y' },
  { offset: 0x0a, name: 'Sprite 5 X' },
  { offset: 0x0b, name: 'Sprite 5 Y' },
  { offset: 0x0c, name: 'Sprite 6 X' },
  { offset: 0x0d, name: 'Sprite 6 Y' },
  { offset: 0x0e, name: 'Sprite 7 X' },
  { offset: 0x0f, name: 'Sprite 7 Y' },
  { offset: 0x10, name: 'Sprite X MSB' },
  { offset: 0x11, name: 'Control 1' },
  { offset: 0x12, name: 'Raster Counter' },
  { offset: 0x13, name: 'Light Pen X' },
  { offset: 0x14, name: 'Light Pen Y' },
  { offset: 0x15, name: 'Sprite Enable' },
  { offset: 0x16, name: 'Control 2' },
  { offset: 0x17, name: 'Sprite Y Expand' },
  { offset: 0x18, name: 'Memory Pointers' },
  { offset: 0x19, name: 'IRQ Status' },
  { offset: 0x1a, name: 'IRQ Mask' },
  { offset: 0x1b, name: 'Sprite Priority' },
  { offset: 0x1c, name: 'Sprite Multicolor' },
  { offset: 0x1d, name: 'Sprite X Expand' },
  { offset: 0x1e, name: 'Sprite-Sprite Collision' },
  { offset: 0x1f, name: 'Sprite-Background Collision' },
  { offset: 0x20, name: 'Border Color' },
  { offset: 0x21, name: 'Background Color 0' },
  { offset: 0x22, name: 'Background Color 1' },
  { offset: 0x23, name: 'Background Color 2' },
  { offset: 0x24, name: 'Background Color 3' },
  { offset: 0x25, name: 'Sprite Multicolor 0' },
  { offset: 0x26, name: 'Sprite Multicolor 1' },
  { offset: 0x27, name: 'Sprite 0 Color' },
  { offset: 0x28, name: 'Sprite 1 Color' },
  { offset: 0x29, name: 'Sprite 2 Color' },
  { offset: 0x2a, name: 'Sprite 3 Color' },
  { offset: 0x2b, name: 'Sprite 4 Color' },
  { offset: 0x2c, name: 'Sprite 5 Color' },
  { offset: 0x2d, name: 'Sprite 6 Color' },
  { offset: 0x2e, name: 'Sprite 7 Color' }
];

function ScaledPixelGrid({
  children,
  minScale = MIN_GRID_SCALE,
  naturalHeight,
  naturalWidth
}: ScaledPixelGridProps): React.ReactElement {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const [availableWidth, setAvailableWidth] = React.useState(naturalWidth);

  React.useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return undefined;
    }

    const updateWidth = (): void => {
      const width = viewport.clientWidth;
      setAvailableWidth((current) => current === width ? current : width);
    };

    updateWidth();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateWidth);
      observer.observe(viewport);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [naturalWidth]);

  const rawScale = availableWidth > 0 ? availableWidth / naturalWidth : 1;
  const scale = Math.min(1, Math.max(minScale, rawScale));
  const scaledWidth = Math.ceil(naturalWidth * scale);
  const scaledHeight = Math.ceil(naturalHeight * scale);

  return (
    <div ref={viewportRef} style={scaledGridViewportStyle}>
      <div
        style={{
          ...scaledGridSpacerStyle,
          height: `${scaledHeight}px`,
          width: `${scaledWidth}px`
        }}
      >
        <div
          style={{
            ...scaledGridContentStyle,
            height: `${naturalHeight}px`,
            transform: `scale(${scale})`,
            width: `${naturalWidth}px`
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

@injectable()
export class C64VisualDebuggerWidget extends ReactWidget {
  @inject(DebugSessionManager)
  protected readonly debugSessionManager!: DebugSessionManager;

  @inject(StorageService)
  protected readonly storageService!: StorageService;

  protected readonly toDispose = new DisposableCollection();
  protected autoRefresh = true;
  protected selectedView: C64VisualDebuggerView = 'overview';
  protected loading = false;
  protected status = 'Start a debug session and stop at a breakpoint to inspect C64 state.';
  protected error: string | undefined;
  protected snapshot: C64VisualSnapshot | undefined;

  @postConstruct()
  protected init(): void {
    this.id = C64_VISUAL_DEBUGGER_WIDGET_ID;
    this.title.label = 'C64 Visual Debugger';
    this.title.caption = 'C64 Visual Debugger';
    this.title.iconClass = codicon('debug-alt');
    this.title.closable = true;
    this.addClass('cc-c64-visual-debugger-widget');

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
    const state = await this.storageService.getData<PersistedC64VisualDebuggerState>(
      STORAGE_KEY,
      {}
    );
    this.autoRefresh = state.autoRefresh ?? this.autoRefresh;
    this.selectedView = isC64VisualDebuggerView(state.selectedView)
      ? state.selectedView
      : this.selectedView;
    this.update();
    this.refreshIfReady();
  }

  protected saveState(): void {
    void this.storageService.setData<PersistedC64VisualDebuggerState>(
      STORAGE_KEY,
      {
        autoRefresh: this.autoRefresh,
        selectedView: this.selectedView
      }
    );
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
    void this.refreshSnapshot();
  }

  protected updateSessionStatus(): void {
    const session = this.currentViceSession();
    if (!session) {
      this.status = 'Start a debug session to inspect C64 state.';
      return;
    }
    if (!session.capabilities.supportsReadMemoryRequest) {
      this.status = 'The active debug session does not support memory reads.';
      return;
    }
    if (session.state !== DebugState.Stopped) {
      this.status = 'Pause or stop at a breakpoint to refresh C64 state.';
      return;
    }
    this.status = 'Ready to inspect C64 state.';
  }

  protected currentViceSession(): DebugSession | undefined {
    const session = this.debugSessionManager.currentSession;
    return session?.configuration.type === COMMODORE_VICE_DEBUG_TYPE
      ? session
      : undefined;
  }

  protected async refreshSnapshot(): Promise<void> {
    const session = this.currentViceSession();
    if (!session) {
      this.error = undefined;
      this.status = 'Start a debug session to inspect C64 state.';
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
      this.status = 'Pause or stop at a breakpoint to refresh C64 state.';
      this.update();
      return;
    }

    this.loading = true;
    this.error = undefined;
    this.status = 'Reading C64 machine state...';
    this.update();

    try {
      const memoryBanks = await this.resolveViceMemoryBanks(session);
      const [vic, cia1Registers, cia2Registers, rasterCycle] = await Promise.all([
        this.readIoMemory(session, VIC_BASE, VIC_REGISTER_COUNT, memoryBanks),
        this.readIoMemory(session, CIA1_BASE, CIA_REGISTER_COUNT, memoryBanks),
        this.readIoMemory(session, CIA2_BASE, CIA_REGISTER_COUNT, memoryBanks),
        this.readOptionalRegister(session, ['CYC', 'CYCLE', 'VCYCLE'])
      ]);
      const video = createVideoSnapshot(vic, cia2Registers, rasterCycle);
      const [screenBytes, colorBytes, characterBytes] = await Promise.all([
        this.readVicMemory(session, video, video.screenBase, SCREEN_MATRIX_BYTES, memoryBanks.ramBankId),
        this.readIoMemory(session, 0xd800, COLOR_RAM_BYTES, memoryBanks),
        this.readVicMemory(session, video, video.characterBase, CHARACTER_BYTES, memoryBanks.ramBankId)
      ]);
      const spriteData = await Promise.all(
        Array.from({ length: SPRITE_COUNT }, (_, index) => {
          const pointer = screenBytes[SPRITE_POINTER_OFFSET + index] ?? 0;
          return this.readVicMemory(
            session,
            video,
            video.bankBase + pointer * SPRITE_BYTES,
            SPRITE_BYTES,
            memoryBanks.ramBankId
          ).catch(() => new Uint8Array(SPRITE_BYTES));
        })
      );

      this.snapshot = {
        loadedAt: Date.now(),
        vic,
        video,
        sprites: createSpriteSnapshots(vic, screenBytes, spriteData, video.bankBase),
        screenBytes,
        colorBytes,
        characterBytes,
        cia1: createCiaSnapshot('CIA #1', CIA1_BASE, cia1Registers),
        cia2: createCiaSnapshot('CIA #2', CIA2_BASE, cia2Registers)
      };
      this.status = 'C64 machine state refreshed.';
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.status = 'C64 state refresh failed.';
    } finally {
      this.loading = false;
      this.update();
    }
  }

  protected async readMemory(
    session: DebugSession,
    startAddress: number,
    count: number,
    options: MemoryRequestOptions = {}
  ): Promise<Uint8Array> {
    const requestArguments = {
      memoryReference: memoryReference(startAddress),
      count,
      sideEffects: false,
      memspace: MAIN_MEMORY_SPACE,
      bankId: ACTIVE_BANK,
      ...options
    } as DebugRequestTypes['readMemory'][0] & MemoryRequestOptions;
    const response = await session.sendRequest(
      'readMemory',
      requestArguments,
      MEMORY_READ_TIMEOUT_MS
    );
    return response.body?.data
      ? decodeBase64(response.body.data)
      : new Uint8Array(0);
  }

  protected async readIoMemory(
    session: DebugSession,
    startAddress: number,
    count: number,
    memoryBanks: ViceMemoryBanks
  ): Promise<Uint8Array> {
    return this.readMemory(
      session,
      startAddress,
      count,
      memoryBanks.ioBankId === undefined ? {} : { bankId: memoryBanks.ioBankId }
    );
  }

  protected async readVicMemory(
    session: DebugSession,
    video: VideoSnapshot,
    startAddress: number,
    count: number,
    ramBankId: number | undefined
  ): Promise<Uint8Array> {
    const bytes = new Uint8Array(count);
    let offset = 0;
    while (offset < count) {
      const address = startAddress + offset;
      const romByte = vicCharacterRomByte(video, address);
      if (romByte !== undefined) {
        bytes[offset] = romByte;
        offset += 1;
        continue;
      }

      let length = 1;
      while (
        offset + length < count &&
        vicCharacterRomByte(video, startAddress + offset + length) === undefined
      ) {
        length += 1;
      }
      const ramBytes = await this.readMemory(
        session,
        address,
        length,
        ramBankId === undefined ? {} : { bankId: ramBankId }
      );
      bytes.set(ramBytes.subarray(0, length), offset);
      offset += length;
    }
    return bytes;
  }

  protected async resolveViceMemoryBanks(
    session: DebugSession
  ): Promise<ViceMemoryBanks> {
    const fallbackBanks: ViceMemoryBanks = {
      ramBankId: C64_RAM_BANK,
      ioBankId: C64_IO_BANK
    };
    try {
      const response = await session.sendCustomRequest(
        'commodore-vice/banksAvailable',
        {}
      );
      const body = response.body as { banks?: ViceMemoryBank[] } | undefined;
      const banks = body?.banks ?? [];
      return {
        ramBankId: findMemoryBankId(banks, 'ram') ?? fallbackBanks.ramBankId,
        ioBankId: findMemoryBankId(banks, 'io') ?? fallbackBanks.ioBankId
      };
    } catch {
      return fallbackBanks;
    }
  }

  protected async readOptionalRegister(
    session: DebugSession,
    names: readonly string[]
  ): Promise<number | undefined> {
    for (const name of names) {
      try {
        const result = await session.evaluate(name, 'watch');
        const value = parseOptionalNumber(result.result);
        if (value !== undefined) {
          return value;
        }
      } catch {
        // Older VICE monitor register sets do not expose raster cycle names.
      }
    }
    return undefined;
  }

  protected render(): React.ReactNode {
    return (
      <div style={rootStyle}>
        {this.renderToolbar()}
        <div style={contentStyle}>
          {this.renderStatus()}
          {this.snapshot ? this.renderSnapshot(this.snapshot) : this.renderEmpty()}
        </div>
      </div>
    );
  }

  protected renderToolbar(): React.ReactNode {
    return (
      <div style={toolbarStyle}>
        <div style={tabListStyle} role='tablist' aria-label='C64 debugger views'>
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.view}
              className={`theia-button ${this.selectedView === option.view ? '' : 'secondary'}`}
              onClick={() => {
                this.selectedView = option.view;
                this.saveState();
                this.update();
              }}
              role='tab'
              aria-selected={this.selectedView === option.view}
              style={tabButtonStyle}
              type='button'
            >
              <i className={codicon(option.icon)} />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
        <button
          className='theia-button'
          disabled={this.loading}
          onClick={() => {
            void this.refreshSnapshot();
          }}
          title='Refresh from the active stopped debug session'
          type='button'
        >
          <i className={codicon('refresh')} />
          <span>Refresh</span>
        </button>
        <label title='Refresh whenever the active VICE session stops' style={inlineCheckboxStyle}>
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
      </div>
    );
  }

  showViewForScreenCapture(view: string): boolean {
    if (!isC64VisualDebuggerView(view)) {
      return false;
    }
    this.selectedView = view;
    this.update();
    this.refreshIfReady();
    return true;
  }

  protected renderStatus(): React.ReactNode {
    return (
      <div
        style={{
          ...statusStyle,
          color: this.error
            ? 'var(--theia-errorForeground)'
            : 'var(--theia-descriptionForeground)'
        }}
      >
        {this.error ?? this.status}
        {this.snapshot ? ` Last read ${formatTime(this.snapshot.loadedAt)}.` : ''}
      </div>
    );
  }

  protected renderEmpty(): React.ReactNode {
    return (
      <div style={emptyStyle}>
        C64 state will appear here after a stopped debug session is refreshed.
      </div>
    );
  }

  protected renderSnapshot(snapshot: C64VisualSnapshot): React.ReactNode {
    switch (this.selectedView) {
      case 'sprites':
        return this.renderSprites(snapshot);
      case 'screen':
        return this.renderScreen(snapshot);
      case 'cia':
        return this.renderCia(snapshot);
      case 'overview':
      default:
        return this.renderOverview(snapshot);
    }
  }

  protected renderOverview(snapshot: C64VisualSnapshot): React.ReactNode {
    return (
      <>
        {this.renderVideoSummary(snapshot)}
        <section style={sectionStyle}>
          <h3 style={sectionHeadingStyle}>VIC-II Registers</h3>
          <div style={tableScrollStyle}>
            <table style={registerTableStyle}>
              <thead>
                <tr>
                  <th style={addressHeaderStyle}>Address</th>
                  <th style={nameHeaderStyle}>Register</th>
                  <th style={valueHeaderStyle}>Value</th>
                  <th style={decodedHeaderStyle}>Decoded</th>
                </tr>
              </thead>
              <tbody>
                {VIC_REGISTER_DEFINITIONS.map((definition) => (
                  <tr key={definition.offset}>
                    <td style={addressCellStyle}>
                      {formatAddress(VIC_BASE + definition.offset)}
                    </td>
                    <td style={tableCellStyle}>{definition.name}</td>
                    <td style={valueCellStyle}>
                      {formatByte(snapshot.vic[definition.offset] ?? 0)}
                    </td>
                    <td style={decodedCellStyle}>
                      {decodeVicRegister(
                        definition.offset,
                        snapshot.vic[definition.offset] ?? 0,
                        snapshot
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  protected renderVideoSummary(snapshot: C64VisualSnapshot): React.ReactNode {
    const video = snapshot.video;
    return (
      <section style={summaryGridStyle} aria-label='C64 video summary'>
        {this.renderMetric('Raster', [
          `Line ${video.rasterLine}`,
          video.rasterCycle === undefined
            ? 'Cycle unavailable'
            : `Cycle ${video.rasterCycle}`
        ])}
        {this.renderMetric('VIC Bank', [
          `${formatAddress(video.bankBase)}-${formatAddress(video.bankBase + 0x3fff)}`,
          `CIA2 PA bits ${video.bankSelect.toString(2).padStart(2, '0')}`
        ])}
        {this.renderMetric('Screen', [
          `${formatAddress(video.screenBase)}-${formatAddress(video.screenBase + SCREEN_MATRIX_BYTES - 1)}`,
          `${video.columns} columns, ${video.rows} rows`
        ])}
        {this.renderMetric('Characters', [
          `${formatAddress(video.characterBase)}-${formatAddress(video.characterBase + CHARACTER_BYTES - 1)}`,
          characterMemorySourceLabel(video)
        ])}
        {this.renderMetric('Display Mode', [
          video.displayMode,
          video.displayEnabled ? 'Display enabled' : 'Display disabled'
        ])}
        {this.renderMetric('VIC IRQ', [
          irqSummary(video.irqStatus) || 'No pending source',
          `Mask: ${irqSummary(video.irqMask) || 'none'}`
        ])}
      </section>
    );
  }

  protected renderMetric(label: string, lines: readonly string[]): React.ReactNode {
    return (
      <div style={metricStyle}>
        <div style={metricLabelStyle}>{label}</div>
        {lines.map((line) => (
          <div key={line} style={metricValueStyle}>
            {line}
          </div>
        ))}
      </div>
    );
  }

  protected renderSprites(snapshot: C64VisualSnapshot): React.ReactNode {
    return (
      <>
        {this.renderVideoSummary(snapshot)}
        <div style={spriteGridStyle}>
          {snapshot.sprites.map((sprite) => this.renderSprite(sprite, snapshot.video))}
        </div>
      </>
    );
  }

  protected renderSprite(sprite: SpriteSnapshot, video: VideoSnapshot): React.ReactNode {
    const color = paletteColor(sprite.color);
    return (
      <article key={sprite.index} style={spriteCardStyle}>
        <div style={spriteHeaderStyle}>
          <strong>Sprite {sprite.index}</strong>
          <span
            style={{
              ...spriteEnabledBadgeStyle,
              opacity: sprite.enabled ? 1 : 0.55
            }}
          >
            {sprite.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <div style={spriteBodyStyle}>
          {this.renderSpritePreview(sprite, video)}
          <div style={spriteDetailsStyle}>
            <div>X {sprite.x}, Y {sprite.y}</div>
            <div>
              Pointer {formatByte(sprite.pointer)} {'->'} {formatAddress(sprite.dataAddress)}
            </div>
            <div style={{ color: color.hex }}>
              Color {sprite.color}: {color.name}
            </div>
            <div>{sprite.multicolor ? 'Multicolor' : 'Single color'}</div>
            <div>
              {[
                sprite.expandX ? 'X expanded' : 'Normal X',
                sprite.expandY ? 'Y expanded' : 'Normal Y',
                sprite.behindBackground ? 'Behind background' : 'In front'
              ].join(', ')}
            </div>
            <div>
              {[
                sprite.spriteCollision ? 'sprite collision' : undefined,
                sprite.backgroundCollision ? 'background collision' : undefined
              ].filter(Boolean).join(', ') || 'No collision flags'}
            </div>
          </div>
        </div>
      </article>
    );
  }

  protected renderSpritePreview(
    sprite: SpriteSnapshot,
    video: VideoSnapshot
  ): React.ReactNode {
    const pixels = spritePixelColors(sprite, video);
    return (
      <div
        style={{
          ...spritePreviewStyle,
          opacity: sprite.enabled ? 1 : 0.45
        }}
        title={`Sprite ${sprite.index} pattern at ${formatAddress(sprite.dataAddress)}`}
      >
        {pixels.map((pixel, index) => (
          <span
            key={index}
            style={{
              background: pixel ?? 'transparent',
              height: `${SPRITE_PIXEL_SIZE}px`,
              width: `${SPRITE_PIXEL_SIZE}px`
            }}
          />
        ))}
      </div>
    );
  }

  protected renderScreen(snapshot: C64VisualSnapshot): React.ReactNode {
    return (
      <>
        {this.renderVideoSummary(snapshot)}
        <section style={sectionStyle}>
          <h3 style={sectionHeadingStyle}>Screen RAM</h3>
          <div style={screenLayoutStyle}>
            <div>
              <div style={subHeadingStyle}>
                Screen codes at {formatAddress(snapshot.video.screenBase)}
              </div>
              <ScaledPixelGrid
                naturalHeight={SCREEN_GRID_HEIGHT}
                naturalWidth={SCREEN_GRID_WIDTH}
              >
                {this.renderScreenGrid(snapshot)}
              </ScaledPixelGrid>
            </div>
          </div>
        </section>
        <section style={sectionStyle}>
          <div style={characterColorLayoutStyle}>
            <div>
              <div style={subHeadingStyle}>
                {characterMemoryHeading(snapshot.video)}
              </div>
              <ScaledPixelGrid
                naturalHeight={CHARACTER_GRID_HEIGHT}
                naturalWidth={CHARACTER_GRID_WIDTH}
              >
                {this.renderCharacterRam(snapshot)}
              </ScaledPixelGrid>
            </div>
            <div>
              <div style={subHeadingStyle}>Color RAM at $D800</div>
              <ScaledPixelGrid
                naturalHeight={COLOR_RAM_GRID_HEIGHT}
                naturalWidth={COLOR_RAM_GRID_WIDTH}
              >
                {this.renderColorRam(snapshot)}
              </ScaledPixelGrid>
            </div>
          </div>
        </section>
      </>
    );
  }

  protected renderScreenGrid(
    snapshot: C64VisualSnapshot
  ): React.ReactNode {
    const background = paletteColor(snapshot.video.backgroundColors[0]);
    return (
      <div
        style={{
          ...screenGridStyle,
          backgroundColor: background.hex,
          borderColor: paletteColor(snapshot.video.borderColor).hex
        }}
      >
        {Array.from({ length: SCREEN_CELL_COUNT }, (_, index) => {
          const screenCode = snapshot.screenBytes[index] ?? 0;
          const color = paletteColor(snapshot.colorBytes[index] ?? 0);
          return (
            <span
              key={index}
              style={{
                ...screenGlyphCellStyle,
                color: color.hex
              }}
              title={`${formatAddress(snapshot.video.screenBase + index)} = ${formatByte(screenCode)}, color ${color.name}`}
            >
              <span
                aria-hidden='true'
                style={{
                  ...glyphPixelStyle(SCREEN_GLYPH_PIXEL_SIZE),
                  backgroundColor: characterRamGlyphOrigin(
                    snapshot.characterBytes,
                    screenCode
                  ) ? 'currentColor' : 'transparent',
                  boxShadow: characterRamGlyphShadow(
                    snapshot.characterBytes,
                    screenCode,
                    SCREEN_GLYPH_PIXEL_SIZE
                  )
                }}
              />
            </span>
          );
        })}
      </div>
    );
  }

  protected renderColorRam(snapshot: C64VisualSnapshot): React.ReactNode {
    return (
      <div style={colorRamGridStyle}>
        {Array.from({ length: SCREEN_CELL_COUNT }, (_, index) => {
          const value = snapshot.colorBytes[index] ?? 0;
          const color = paletteColor(value);
          return (
            <span
              key={index}
              style={{
                ...colorCellStyle,
                backgroundColor: color.hex
              }}
              title={`$${(0xd800 + index).toString(16).toUpperCase()} = ${formatByte(value)} ${color.name}`}
            />
          );
        })}
      </div>
    );
  }

  protected renderCharacterRam(snapshot: C64VisualSnapshot): React.ReactNode {
    return (
      <div style={characterGridStyle}>
        {Array.from({ length: 256 }, (_, index) => (
          <span
            key={index}
            style={characterCellStyle}
            title={`${formatAddress(snapshot.video.characterBase + index * 8)} char ${formatByte(index)}`}
          >
            <span
              aria-hidden='true'
              style={{
                ...glyphPixelStyle(CHARACTER_RAM_PIXEL_SIZE),
                backgroundColor: characterRamGlyphOrigin(
                  snapshot.characterBytes,
                  index
                ) ? 'currentColor' : 'transparent',
                boxShadow: characterRamGlyphShadow(
                  snapshot.characterBytes,
                  index,
                  CHARACTER_RAM_PIXEL_SIZE
                )
              }}
            />
          </span>
        ))}
      </div>
    );
  }

  protected renderCia(snapshot: C64VisualSnapshot): React.ReactNode {
    return (
      <>
        <section style={summaryGridStyle} aria-label='CIA summary'>
          {this.renderMetric('Keyboard Matrix', [
            `PRA ${formatByte(snapshot.cia1.pra)}, PRB ${formatByte(snapshot.cia1.prb)}`,
            `DDRA ${formatByte(snapshot.cia1.ddra)}, DDRB ${formatByte(snapshot.cia1.ddrb)}`
          ])}
          {this.renderMetric('VIC Bank Select', [
            `${formatAddress(snapshot.video.bankBase)}-${formatAddress(snapshot.video.bankBase + 0x3fff)}`,
            `CIA2 PRA ${formatByte(snapshot.cia2.pra)}, DDRA ${formatByte(snapshot.cia2.ddra)}`
          ])}
          {this.renderMetric('CIA #1 IRQ', [
            ciaIrqSummary(snapshot.cia1) || 'No pending source',
            `ICR ${formatByte(snapshot.cia1.interruptControl)}`
          ])}
          {this.renderMetric('CIA #2 IRQ', [
            ciaIrqSummary(snapshot.cia2) || 'No pending source',
            `ICR ${formatByte(snapshot.cia2.interruptControl)}`
          ])}
        </section>
        <section style={ciaGridStyle}>
          {this.renderCiaPanel(snapshot.cia1)}
          {this.renderCiaPanel(snapshot.cia2)}
        </section>
      </>
    );
  }

  protected renderCiaPanel(cia: CiaSnapshot): React.ReactNode {
    return (
      <article style={sectionStyle}>
        <h3 style={sectionHeadingStyle}>
          {cia.label} {formatAddress(cia.baseAddress)}
        </h3>
        <div style={ciaRowsStyle}>
          {this.renderCiaRow('Ports', [
            `PRA ${formatByte(cia.pra)}`,
            `PRB ${formatByte(cia.prb)}`,
            `DDRA ${formatByte(cia.ddra)}`,
            `DDRB ${formatByte(cia.ddrb)}`
          ])}
          {this.renderCiaRow('Timers', [
            `A ${formatWord(cia.timerA)}`,
            `B ${formatWord(cia.timerB)}`
          ])}
          {this.renderCiaRow('TOD', [
            `${formatBcd(cia.todHours)}:${formatBcd(cia.todMinutes)}:${formatBcd(cia.todSeconds)}.${cia.todTenths & 0x0f}`
          ])}
          {this.renderCiaRow('IRQ Sources', [
            ciaIrqSummary(cia) || 'none',
            `ICR ${formatByte(cia.interruptControl)}`
          ])}
          {this.renderCiaRow('Control A', decodeCiaControlA(cia.controlA))}
          {this.renderCiaRow('Control B', decodeCiaControlB(cia.controlB))}
          {this.renderCiaRow('Serial', [`SDR ${formatByte(cia.serialData)}`])}
        </div>
        <div style={tableScrollStyle}>
          <table style={registerTableStyle}>
            <tbody>
              {Array.from({ length: CIA_REGISTER_COUNT }, (_, offset) => (
                <tr key={offset}>
                  <td style={addressCellStyle}>
                    {formatAddress(cia.baseAddress + offset)}
                  </td>
                  <td style={valueCellStyle}>
                    {formatByte(cia.registers[offset] ?? 0)}
                  </td>
                  <td style={decodedCellStyle}>
                    {ciaRegisterName(offset)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    );
  }

  protected renderCiaRow(label: string, values: readonly string[]): React.ReactNode {
    return (
      <div style={ciaRowStyle}>
        <span style={ciaRowLabelStyle}>{label}</span>
        <span style={ciaRowValueStyle}>{values.join(', ')}</span>
      </div>
    );
  }
}

const rootStyle: React.CSSProperties = {
  background: 'var(--theia-editor-background)',
  color: 'var(--theia-foreground)',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0
};

const toolbarStyle: React.CSSProperties = {
  alignItems: 'center',
  background: 'var(--theia-editorWidget-background)',
  borderBottom: '1px solid var(--theia-editorGroup-border)',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  padding: '6px 8px'
};

const tabListStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px'
};

const tabButtonStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'inline-flex',
  gap: '4px'
};

const inlineCheckboxStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  fontSize: '12px',
  gap: '4px',
  whiteSpace: 'nowrap'
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  padding: '8px'
};

const statusStyle: React.CSSProperties = {
  fontSize: '12px',
  marginBottom: '8px'
};

const emptyStyle: React.CSSProperties = {
  border: '1px solid var(--theia-editorGroup-border)',
  color: 'var(--theia-descriptionForeground)',
  fontSize: '12px',
  padding: '12px'
};

const summaryGridStyle: React.CSSProperties = {
  display: 'grid',
  gap: '8px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  marginBottom: '8px'
};

const metricStyle: React.CSSProperties = {
  background: 'var(--theia-editorWidget-background)',
  border: '1px solid var(--theia-editorGroup-border)',
  borderRadius: '6px',
  minHeight: '54px',
  padding: '8px'
};

const metricLabelStyle: React.CSSProperties = {
  color: 'var(--theia-descriptionForeground)',
  fontSize: '11px',
  marginBottom: '5px',
  textTransform: 'uppercase'
};

const metricValueStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '12px',
  lineHeight: 1.35,
  overflowWrap: 'anywhere'
};

const sectionStyle: React.CSSProperties = {
  border: '1px solid var(--theia-editorGroup-border)',
  borderRadius: '6px',
  marginBottom: '8px',
  overflow: 'hidden'
};

const sectionHeadingStyle: React.CSSProperties = {
  background: 'var(--theia-editorWidget-background)',
  borderBottom: '1px solid var(--theia-editorGroup-border)',
  fontSize: '12px',
  fontWeight: 600,
  lineHeight: 1.3,
  margin: 0,
  padding: '7px 8px'
};

const subHeadingStyle: React.CSSProperties = {
  color: 'var(--theia-descriptionForeground)',
  fontSize: '12px',
  margin: '0 0 6px'
};

const tableScrollStyle: React.CSSProperties = {
  overflow: 'auto'
};

const registerTableStyle: React.CSSProperties = {
  borderCollapse: 'collapse',
  fontFamily: 'monospace',
  fontSize: '12px',
  minWidth: '100%',
  tableLayout: 'fixed'
};

const addressHeaderStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--theia-editorGroup-border)',
  color: 'var(--theia-descriptionForeground)',
  padding: '4px 6px',
  textAlign: 'left',
  width: '76px'
};

const nameHeaderStyle: React.CSSProperties = {
  ...addressHeaderStyle,
  width: '150px'
};

const valueHeaderStyle: React.CSSProperties = {
  ...addressHeaderStyle,
  width: '56px'
};

const decodedHeaderStyle: React.CSSProperties = {
  ...addressHeaderStyle,
  width: '360px'
};

const tableCellStyle: React.CSSProperties = {
  borderBottom: '1px solid color-mix(in srgb, var(--theia-editorGroup-border) 45%, transparent)',
  padding: '4px 6px',
  verticalAlign: 'top'
};

const addressCellStyle: React.CSSProperties = {
  ...tableCellStyle,
  color: 'var(--theia-descriptionForeground)',
  whiteSpace: 'nowrap'
};

const valueCellStyle: React.CSSProperties = {
  ...tableCellStyle,
  whiteSpace: 'nowrap'
};

const decodedCellStyle: React.CSSProperties = {
  ...tableCellStyle,
  overflowWrap: 'anywhere'
};

const spriteGridStyle: React.CSSProperties = {
  display: 'grid',
  gap: '8px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  marginBottom: '8px'
};

const spriteCardStyle: React.CSSProperties = {
  border: '1px solid var(--theia-editorGroup-border)',
  borderRadius: '6px',
  overflow: 'hidden'
};

const spriteHeaderStyle: React.CSSProperties = {
  alignItems: 'center',
  background: 'var(--theia-editorWidget-background)',
  borderBottom: '1px solid var(--theia-editorGroup-border)',
  display: 'flex',
  fontSize: '12px',
  justifyContent: 'space-between',
  padding: '6px 8px'
};

const spriteEnabledBadgeStyle: React.CSSProperties = {
  color: 'var(--theia-descriptionForeground)',
  fontSize: '11px'
};

const spriteBodyStyle: React.CSSProperties = {
  display: 'grid',
  gap: '8px',
  gridTemplateColumns: '96px minmax(0, 1fr)',
  padding: '8px'
};

const spritePreviewStyle: React.CSSProperties = {
  backgroundColor: 'rgba(127, 127, 127, 0.12)',
  backgroundImage:
    'linear-gradient(45deg, rgba(127,127,127,0.12) 25%, transparent 25%), linear-gradient(-45deg, rgba(127,127,127,0.12) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(127,127,127,0.12) 75%), linear-gradient(-45deg, transparent 75%, rgba(127,127,127,0.12) 75%)',
  backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
  backgroundSize: '8px 8px',
  display: 'grid',
  gridTemplateColumns: `repeat(24, ${SPRITE_PIXEL_SIZE}px)`,
  gridTemplateRows: `repeat(21, ${SPRITE_PIXEL_SIZE}px)`,
  height: `${21 * SPRITE_PIXEL_SIZE}px`,
  width: `${24 * SPRITE_PIXEL_SIZE}px`
};

const spriteDetailsStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '12px',
  lineHeight: 1.45,
  minWidth: 0,
  overflowWrap: 'anywhere'
};

const screenLayoutStyle: React.CSSProperties = {
  overflow: 'hidden',
  padding: '8px'
};

const characterColorLayoutStyle: React.CSSProperties = {
  alignItems: 'start',
  display: 'grid',
  gap: '12px',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
  overflow: 'hidden',
  padding: '8px'
};

const scaledGridViewportStyle: React.CSSProperties = {
  maxWidth: '100%',
  overflow: 'auto',
  width: '100%'
};

const scaledGridSpacerStyle: React.CSSProperties = {
  position: 'relative'
};

const scaledGridContentStyle: React.CSSProperties = {
  left: 0,
  position: 'absolute',
  top: 0,
  transformOrigin: 'top left'
};

const screenGridStyle: React.CSSProperties = {
  border: `${SCREEN_GRID_BORDER_SIZE}px solid`,
  display: 'grid',
  gridTemplateColumns: `repeat(${SCREEN_COLUMNS}, ${SCREEN_GLYPH_PIXEL_SIZE * 8}px)`,
  gridTemplateRows: `repeat(${SCREEN_ROWS}, ${SCREEN_GLYPH_PIXEL_SIZE * 8}px)`,
  width: `${SCREEN_COLUMNS * SCREEN_GLYPH_PIXEL_SIZE * 8}px`
};

const screenGlyphCellStyle: React.CSSProperties = {
  height: `${SCREEN_GLYPH_PIXEL_SIZE * 8}px`,
  position: 'relative',
  width: `${SCREEN_GLYPH_PIXEL_SIZE * 8}px`
};

const colorRamGridStyle: React.CSSProperties = {
  display: 'grid',
  gap: `${COLOR_RAM_GRID_GAP}px`,
  gridTemplateColumns: `repeat(${SCREEN_COLUMNS}, ${COLOR_RAM_CELL_SIZE}px)`,
  width: `${COLOR_RAM_GRID_WIDTH}px`
};

const colorCellStyle: React.CSSProperties = {
  border: '1px solid rgba(127, 127, 127, 0.35)',
  boxSizing: 'border-box',
  height: `${COLOR_RAM_CELL_SIZE}px`,
  width: `${COLOR_RAM_CELL_SIZE}px`
};

const characterGridStyle: React.CSSProperties = {
  display: 'grid',
  gap: `${CHARACTER_GRID_GAP}px`,
  gridTemplateColumns: `repeat(${CHARACTER_GRID_COLUMNS}, ${CHARACTER_CELL_SIZE}px)`,
  width: `${CHARACTER_GRID_WIDTH}px`
};

const characterCellStyle: React.CSSProperties = {
  background: 'rgba(127, 127, 127, 0.08)',
  color: 'var(--theia-editor-foreground)',
  height: `${CHARACTER_RAM_PIXEL_SIZE * 8}px`,
  position: 'relative',
  width: `${CHARACTER_RAM_PIXEL_SIZE * 8}px`
};

const ciaGridStyle: React.CSSProperties = {
  display: 'grid',
  gap: '8px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))'
};

const ciaRowsStyle: React.CSSProperties = {
  display: 'grid',
  gap: '1px',
  padding: '8px'
};

const ciaRowStyle: React.CSSProperties = {
  display: 'grid',
  gap: '8px',
  gridTemplateColumns: '92px minmax(0, 1fr)',
  minHeight: '22px'
};

const ciaRowLabelStyle: React.CSSProperties = {
  color: 'var(--theia-descriptionForeground)',
  fontSize: '12px'
};

const ciaRowValueStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '12px',
  overflowWrap: 'anywhere'
};

function createVideoSnapshot(
  vic: Uint8Array,
  cia2: Uint8Array,
  rasterCycle: number | undefined
): VideoSnapshot {
  const control1 = vic[0x11] ?? 0;
  const control2 = vic[0x16] ?? 0;
  const memoryControl = vic[0x18] ?? 0;
  const bankSelect = (cia2[0] ?? 0) & 0x03;
  const bankBase = (3 - bankSelect) * 0x4000;
  const screenBase = bankBase + ((memoryControl >> 4) & 0x0f) * 0x0400;
  const characterBase = bankBase + ((memoryControl >> 1) & 0x07) * 0x0800;
  const bitmapBase = bankBase + ((memoryControl >> 3) & 0x01) * 0x2000;
  return {
    bankSelect,
    bankBase,
    screenBase,
    characterBase,
    bitmapBase,
    rasterLine: ((control1 & 0x80) << 1) | (vic[0x12] ?? 0),
    rasterCycle,
    control1,
    control2,
    memoryControl,
    displayEnabled: (control1 & 0x10) !== 0,
    displayMode: displayMode(control1, control2),
    rows: (control1 & 0x08) !== 0 ? 25 : 24,
    columns: (control2 & 0x08) !== 0 ? 40 : 38,
    xScroll: control2 & 0x07,
    yScroll: control1 & 0x07,
    borderColor: vic[0x20] ?? 0,
    backgroundColors: [
      vic[0x21] ?? 0,
      vic[0x22] ?? 0,
      vic[0x23] ?? 0,
      vic[0x24] ?? 0
    ],
    spriteMulticolor0: vic[0x25] ?? 0,
    spriteMulticolor1: vic[0x26] ?? 0,
    irqStatus: createVicIrqSnapshot(vic[0x19] ?? 0),
    irqMask: createVicIrqSnapshot(vic[0x1a] ?? 0)
  };
}

function createSpriteSnapshots(
  vic: Uint8Array,
  screenBytes: Uint8Array,
  spriteData: readonly Uint8Array[],
  bankBase: number
): SpriteSnapshot[] {
  return Array.from({ length: SPRITE_COUNT }, (_, index) => {
    const pointer = screenBytes[SPRITE_POINTER_OFFSET + index] ?? 0;
    return {
      index,
      x: (vic[index * 2] ?? 0) + (((vic[0x10] ?? 0) & (1 << index)) ? 0x100 : 0),
      y: vic[index * 2 + 1] ?? 0,
      enabled: ((vic[0x15] ?? 0) & (1 << index)) !== 0,
      pointer,
      dataAddress: bankBase + pointer * SPRITE_BYTES,
      color: vic[0x27 + index] ?? 0,
      multicolor: ((vic[0x1c] ?? 0) & (1 << index)) !== 0,
      expandX: ((vic[0x1d] ?? 0) & (1 << index)) !== 0,
      expandY: ((vic[0x17] ?? 0) & (1 << index)) !== 0,
      behindBackground: ((vic[0x1b] ?? 0) & (1 << index)) !== 0,
      spriteCollision: ((vic[0x1e] ?? 0) & (1 << index)) !== 0,
      backgroundCollision: ((vic[0x1f] ?? 0) & (1 << index)) !== 0,
      bytes: spriteData[index] ?? new Uint8Array(SPRITE_BYTES)
    };
  });
}

function createCiaSnapshot(
  label: string,
  baseAddress: number,
  registers: Uint8Array
): CiaSnapshot {
  return {
    label,
    baseAddress,
    registers,
    pra: registers[0] ?? 0,
    prb: registers[1] ?? 0,
    ddra: registers[2] ?? 0,
    ddrb: registers[3] ?? 0,
    timerA: word(registers[4] ?? 0, registers[5] ?? 0),
    timerB: word(registers[6] ?? 0, registers[7] ?? 0),
    todTenths: registers[8] ?? 0,
    todSeconds: registers[9] ?? 0,
    todMinutes: registers[10] ?? 0,
    todHours: registers[11] ?? 0,
    serialData: registers[12] ?? 0,
    interruptControl: registers[13] ?? 0,
    controlA: registers[14] ?? 0,
    controlB: registers[15] ?? 0
  };
}

function createVicIrqSnapshot(value: number): IrqSnapshot {
  return {
    raster: (value & 0x01) !== 0,
    spriteBackground: (value & 0x02) !== 0,
    spriteSprite: (value & 0x04) !== 0,
    lightPen: (value & 0x08) !== 0,
    any: (value & 0x80) !== 0
  };
}

function decodeVicRegister(
  offset: number,
  value: number,
  snapshot: C64VisualSnapshot
): string {
  const video = snapshot.video;
  if (offset <= 0x0f) {
    const spriteIndex = Math.floor(offset / 2);
    const axis = offset % 2 === 0 ? 'X low' : 'Y';
    const sprite = snapshot.sprites[spriteIndex];
    return `Sprite ${spriteIndex} ${axis}; effective ${sprite ? `X ${sprite.x}, Y ${sprite.y}` : formatByte(value)}`;
  }
  if (offset >= 0x27 && offset <= 0x2e) {
    return `Sprite ${offset - 0x27} color ${colorLabel(value)}`;
  }
  switch (offset) {
    case 0x10:
      return spriteFlags(value, 'X high bit set');
    case 0x11:
      return [
        `RST8 ${(value & 0x80) !== 0 ? 1 : 0}`,
        `ECM ${onOff(value & 0x40)}`,
        `BMM ${onOff(value & 0x20)}`,
        `DEN ${onOff(value & 0x10)}`,
        `RSEL ${video.rows} rows`,
        `YSCROLL ${value & 0x07}`
      ].join(', ');
    case 0x12:
      return `Raster low byte; current line ${video.rasterLine}`;
    case 0x13:
      return 'Light pen X latch';
    case 0x14:
      return 'Light pen Y latch';
    case 0x15:
      return spriteFlags(value, 'enabled');
    case 0x16:
      return [
        `MCM ${onOff(value & 0x10)}`,
        `CSEL ${video.columns} columns`,
        `XSCROLL ${value & 0x07}`
      ].join(', ');
    case 0x17:
      return spriteFlags(value, 'Y expanded');
    case 0x18:
      return [
        `screen ${formatAddress(video.screenBase)}`,
        `characters ${formatAddress(video.characterBase)}`,
        `bitmap ${formatAddress(video.bitmapBase)}`
      ].join(', ');
    case 0x19:
      return `IRQ pending: ${irqSummary(video.irqStatus) || 'none'}`;
    case 0x1a:
      return `IRQ enabled: ${irqSummary(video.irqMask) || 'none'}`;
    case 0x1b:
      return spriteFlags(value, 'behind background');
    case 0x1c:
      return spriteFlags(value, 'multicolor');
    case 0x1d:
      return spriteFlags(value, 'X expanded');
    case 0x1e:
      return spriteFlags(value, 'sprite collision');
    case 0x1f:
      return spriteFlags(value, 'background collision');
    case 0x20:
      return `Border ${colorLabel(value)}`;
    case 0x21:
      return `Background 0 ${colorLabel(value)}`;
    case 0x22:
      return `Background 1 ${colorLabel(value)}`;
    case 0x23:
      return `Background 2 ${colorLabel(value)}`;
    case 0x24:
      return `Background 3 ${colorLabel(value)}`;
    case 0x25:
      return `Sprite multicolor 0 ${colorLabel(value)}`;
    case 0x26:
      return `Sprite multicolor 1 ${colorLabel(value)}`;
    default:
      return '';
  }
}

function displayMode(control1: number, control2: number): string {
  const extendedColor = (control1 & 0x40) !== 0;
  const bitmap = (control1 & 0x20) !== 0;
  const multicolor = (control2 & 0x10) !== 0;
  if (bitmap && multicolor) {
    return 'Multicolor bitmap';
  }
  if (bitmap) {
    return 'Standard bitmap';
  }
  if (extendedColor) {
    return 'Extended color text';
  }
  if (multicolor) {
    return 'Multicolor text';
  }
  return 'Standard text';
}

function spritePixelColors(
  sprite: SpriteSnapshot,
  video: VideoSnapshot
): Array<string | undefined> {
  const colors: Array<string | undefined> = [];
  const spriteColor = paletteColor(sprite.color).hex;
  const multicolor0 = paletteColor(video.spriteMulticolor0).hex;
  const multicolor1 = paletteColor(video.spriteMulticolor1).hex;
  for (let row = 0; row < 21; row += 1) {
    const rowOffset = row * 3;
    if (sprite.multicolor) {
      for (let byteIndex = 0; byteIndex < 3; byteIndex += 1) {
        const value = sprite.bytes[rowOffset + byteIndex] ?? 0;
        for (const shift of [6, 4, 2, 0]) {
          const code = (value >> shift) & 0x03;
          const color = code === 0
            ? undefined
            : code === 1
              ? multicolor0
              : code === 2
                ? spriteColor
                : multicolor1;
          colors.push(color, color);
        }
      }
    } else {
      for (let byteIndex = 0; byteIndex < 3; byteIndex += 1) {
        const value = sprite.bytes[rowOffset + byteIndex] ?? 0;
        for (let bit = 7; bit >= 0; bit -= 1) {
          colors.push((value & (1 << bit)) !== 0 ? spriteColor : undefined);
        }
      }
    }
  }
  return colors;
}

function characterRamGlyphShadow(
  bytes: Uint8Array,
  characterIndex: number,
  pixelSize: number
): string {
  const offset = characterIndex * 8;
  const shadows: string[] = [];
  for (let y = 0; y < 8; y += 1) {
    const row = bytes[offset + y] ?? 0;
    for (let x = 0; x < 8; x += 1) {
      if ((row & (0x80 >> x)) !== 0) {
        if (x === 0 && y === 0) {
          continue;
        }
        shadows.push(`${x * pixelSize}px ${y * pixelSize}px 0 currentColor`);
      }
    }
  }
  return shadows.join(', ');
}

function characterRamGlyphOrigin(
  bytes: Uint8Array,
  characterIndex: number
): boolean {
  return ((bytes[characterIndex * 8] ?? 0) & 0x80) !== 0;
}

function glyphPixelStyle(pixelSize: number): React.CSSProperties {
  return {
    height: `${pixelSize}px`,
    left: 0,
    position: 'absolute',
    top: 0,
    width: `${pixelSize}px`
  };
}

function spriteFlags(value: number, label: string): string {
  const enabled = Array.from({ length: SPRITE_COUNT }, (_, index) =>
    (value & (1 << index)) !== 0 ? index : undefined
  ).filter((index): index is number => index !== undefined);
  return enabled.length === 0
    ? `No sprites ${label}`
    : `Sprites ${enabled.join(', ')} ${label}`;
}

function irqSummary(irq: IrqSnapshot): string {
  return [
    irq.raster ? 'raster' : undefined,
    irq.spriteBackground ? 'sprite/background' : undefined,
    irq.spriteSprite ? 'sprite/sprite' : undefined,
    irq.lightPen ? 'light pen' : undefined,
    irq.any ? 'IRQ line' : undefined
  ].filter(Boolean).join(', ');
}

function ciaIrqSummary(cia: CiaSnapshot): string {
  const value = cia.interruptControl;
  return [
    (value & 0x01) !== 0 ? 'timer A' : undefined,
    (value & 0x02) !== 0 ? 'timer B' : undefined,
    (value & 0x04) !== 0 ? 'TOD alarm' : undefined,
    (value & 0x08) !== 0 ? 'serial' : undefined,
    (value & 0x10) !== 0 ? 'FLAG' : undefined,
    (value & 0x80) !== 0 ? 'IRQ line' : undefined
  ].filter(Boolean).join(', ');
}

function decodeCiaControlA(value: number): string[] {
  return [
    (value & 0x01) !== 0 ? 'timer running' : 'timer stopped',
    (value & 0x02) !== 0 ? 'PB6 output enabled' : 'PB6 timer output off',
    (value & 0x04) !== 0 ? 'toggle PB6' : 'pulse PB6',
    (value & 0x08) !== 0 ? 'one-shot' : 'continuous',
    (value & 0x10) !== 0 ? 'force load' : 'no force load',
    (value & 0x20) !== 0 ? 'count CNT pulses' : 'count phi2',
    (value & 0x40) !== 0 ? 'serial output' : 'serial input',
    (value & 0x80) !== 0 ? 'TOD 50 Hz' : 'TOD 60 Hz'
  ];
}

function decodeCiaControlB(value: number): string[] {
  const source = (value >> 5) & 0x03;
  return [
    (value & 0x01) !== 0 ? 'timer running' : 'timer stopped',
    (value & 0x02) !== 0 ? 'PB7 output enabled' : 'PB7 timer output off',
    (value & 0x04) !== 0 ? 'toggle PB7' : 'pulse PB7',
    (value & 0x08) !== 0 ? 'one-shot' : 'continuous',
    (value & 0x10) !== 0 ? 'force load' : 'no force load',
    `source ${['phi2', 'CNT', 'timer A', 'timer A + CNT'][source]}`,
    (value & 0x80) !== 0 ? 'set alarm' : 'read TOD'
  ];
}

function ciaRegisterName(offset: number): string {
  switch (offset) {
    case 0x00:
      return 'Port A';
    case 0x01:
      return 'Port B';
    case 0x02:
      return 'Data Direction A';
    case 0x03:
      return 'Data Direction B';
    case 0x04:
      return 'Timer A Low';
    case 0x05:
      return 'Timer A High';
    case 0x06:
      return 'Timer B Low';
    case 0x07:
      return 'Timer B High';
    case 0x08:
      return 'TOD 1/10 Seconds';
    case 0x09:
      return 'TOD Seconds';
    case 0x0a:
      return 'TOD Minutes';
    case 0x0b:
      return 'TOD Hours';
    case 0x0c:
      return 'Serial Data';
    case 0x0d:
      return 'Interrupt Control';
    case 0x0e:
      return 'Control A';
    case 0x0f:
      return 'Control B';
    default:
      return '';
  }
}

function vicCharacterRomSet(video: VideoSnapshot): MemoryCharacterSet | undefined {
  const offset = vicCharacterRomOffset(video, video.characterBase);
  if (offset === undefined) {
    return undefined;
  }
  return offset < CHARACTER_BYTES ? 'upper' : 'lower';
}

function vicCharacterRomByte(
  video: VideoSnapshot,
  address: number
): number | undefined {
  const offset = vicCharacterRomOffset(video, address);
  if (offset === undefined) {
    return undefined;
  }
  const characterSet = offset < CHARACTER_BYTES ? 'upper' : 'lower';
  return c64CharacterSetBytes(characterSet)[offset % CHARACTER_BYTES];
}

function vicCharacterRomOffset(
  video: VideoSnapshot,
  address: number
): number | undefined {
  if (video.bankBase !== 0x0000 && video.bankBase !== 0x8000) {
    return undefined;
  }
  const offset = address - video.bankBase;
  return offset >= 0x1000 && offset < 0x2000 ? offset - 0x1000 : undefined;
}

function characterMemorySourceLabel(video: VideoSnapshot): string {
  const romSet = vicCharacterRomSet(video);
  if (!romSet) {
    return 'RAM/custom character data';
  }
  return romSet === 'upper'
    ? 'Upper/graphics character ROM'
    : 'Lower/upper character ROM';
}

function characterMemoryHeading(video: VideoSnapshot): string {
  const romSet = vicCharacterRomSet(video);
  const source = romSet ? 'Character ROM' : 'Character Memory';
  return `${source} at ${formatAddress(video.characterBase)}`;
}

function paletteColor(value: number): typeof C64_COLOR_PALETTE[number] {
  return C64_COLOR_PALETTE[value & 0x0f];
}

function colorLabel(value: number): string {
  const color = paletteColor(value);
  return `${value & 0x0f} ${color.name}`;
}

function onOff(value: number): string {
  return value !== 0 ? 'on' : 'off';
}

function memoryReference(address: number): string {
  return `0x${(address & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`;
}

function formatAddress(address: number): string {
  return `$${(address & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`;
}

function formatByte(value: number): string {
  return `$${(value & 0xff).toString(16).toUpperCase().padStart(2, '0')}`;
}

function formatWord(value: number): string {
  return `$${(value & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`;
}

function formatBcd(value: number): string {
  const high = (value >> 4) & 0x0f;
  const low = value & 0x0f;
  return `${high}${low}`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

function word(low: number, high: number): number {
  return ((high & 0xff) << 8) | (low & 0xff);
}

function normalizeBankName(name: string): string {
  return name.replace(/^\*+/u, '').trim().toLowerCase();
}

function findMemoryBankId(
  banks: readonly ViceMemoryBank[],
  name: string
): number | undefined {
  return banks.find((bank) => normalizeBankName(bank.name) === name)?.id;
}

function parseOptionalNumber(input: string): number | undefined {
  const trimmed = input.trim();
  if (/^\$[0-9a-f]+$/iu.test(trimmed)) {
    return Number.parseInt(trimmed.slice(1), 16);
  }
  if (/^0x[0-9a-f]+$/iu.test(trimmed)) {
    return Number.parseInt(trimmed.slice(2), 16);
  }
  if (/^[0-9]+$/u.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }
  return undefined;
}

function decodeBase64(data: string): Uint8Array {
  const decoded = atob(data);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}

function isC64VisualDebuggerView(
  value: string | undefined
): value is C64VisualDebuggerView {
  return value === 'overview' ||
    value === 'sprites' ||
    value === 'screen' ||
    value === 'cia';
}
