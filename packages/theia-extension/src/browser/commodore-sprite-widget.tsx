import * as React from 'react';

import {
  codicon,
  ReactWidget,
  Saveable,
  type SaveAsOptions
} from '@theia/core/lib/browser';
import { BinaryBuffer } from '@theia/core/lib/common/buffer';
import { Emitter, QuickInputService } from '@theia/core/lib/common';
import URI from '@theia/core/lib/common/uri';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { FileDialogService } from '@theia/filesystem/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { MessageService } from '@theia/core/lib/common/message-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { DebugSession, DebugState } from '@theia/debug/lib/browser/debug-session';
import type { DebugRequestTypes } from '@theia/debug/lib/browser/debug-session-connection';
import { DebugSessionManager } from '@theia/debug/lib/browser/debug-session-manager';
import { inject, injectable } from '@theia/core/shared/inversify';

import { C64_COLOR_PALETTE } from '../common/commodore-character-set-format';
import { COMMODORE_VICE_DEBUG_TYPE } from '../common/commodore-vice-debug';
import {
  COMMODORE_RAW_SPRITE_FILE_EXTENSION,
  COMMODORE_SPRITE_FILE_EXTENSION,
  COMMODORE_SPRITE_GEOMETRY,
  COMMODORE_SPRITE_MACHINE_OPTIONS,
  bytesToSpriteSheetDocument,
  createSpriteFrame,
  createDefaultSpriteDocument,
  defaultSpriteTargetForMachine,
  formatKickAssemblerSprite,
  getSpriteByte,
  normalizeSpriteDocument,
  parseKickAssemblerSpriteSheet,
  parseSpriteDocument,
  replaceSpriteFrameData,
  serializeSpriteDocument,
  setHiresSpritePixel,
  setMulticolorSpritePixel,
  spritePointerValue,
  spriteSheetToBytes,
  spriteToBytes,
  transformSprite,
  type CommodoreSpriteColorMode,
  type CommodoreSpriteColors,
  type CommodoreSpriteDocument
} from '../common/commodore-sprite-format';

export const COMMODORE_SPRITE_WIDGET_FACTORY_ID =
  'commodore-commander.sprite-editor';

export interface CommodoreSpriteWidgetOptions {
  readonly uri: string;
}

type ColorRole = keyof CommodoreSpriteColors;
type ViceTransferScope = 'frame' | 'sheet';

interface MemoryRequestOptions {
  sideEffects?: boolean;
  memspace?: number;
  bankId?: number;
}

const VICE_MEMORY_TIMEOUT_MS = 10000;

const SINGLE_COLOR_CHOICES: readonly {
  readonly value: number;
  readonly role: ColorRole;
  readonly label: string;
  readonly detail?: string;
}[] = [
  { value: 0, role: 'background', label: 'Backdrop' },
  { value: 1, role: 'foreground', label: 'Sprite', detail: '($D027-$D02E)' }
];

const MULTICOLOR_PAINT_CHOICES: readonly {
  readonly value: number;
  readonly role: ColorRole;
  readonly label: string;
  readonly detail?: string;
}[] = [
  { value: 0, role: 'background', label: 'Backdrop' },
  { value: 1, role: 'multicolor1', label: 'Multi 0', detail: '($D025)' },
  { value: 2, role: 'foreground', label: 'Sprite', detail: '($D027-$D02E)' },
  { value: 3, role: 'multicolor2', label: 'Multi 1', detail: '($D026)' }
];

@injectable()
export class CommodoreSpriteWidget extends ReactWidget {
  @inject(FileService)
  protected readonly fileService!: FileService;

  @inject(FileDialogService)
  protected readonly fileDialogService!: FileDialogService;

  @inject(MessageService)
  protected readonly messageService!: MessageService;

  @inject(QuickInputService)
  protected readonly quickInputService!: QuickInputService;

  @inject(WorkspaceService)
  protected readonly workspaceService!: WorkspaceService;

  @inject(DebugSessionManager)
  protected readonly debugSessionManager!: DebugSessionManager;

  protected readonly dirtyChangedEmitter = new Emitter<void>();
  protected readonly contentChangedEmitter = new Emitter<void>();
  protected resourceUri: URI | undefined;
  protected document = createDefaultSpriteDocument();
  protected selectedFrameIndex = 0;
  protected paintValue = 1;
  protected activePaintValue: number | undefined;
  protected openColorSelectorRole: ColorRole | undefined;
  protected editorPixelSize = 22;
  protected animationPlaying = false;
  protected animationDirection: 1 | -1 = 1;
  protected animationTimer: number | undefined;
  protected memoryAddressInput = '$2000';
  protected memoryTransferScope: ViceTransferScope = 'frame';
  protected viceStatus = 'VICE memory actions use the active stopped commodore-vice session.';
  protected dirty = false;
  protected loaded = false;

  readonly saveable: Saveable;

  constructor() {
    super();
    const widget = this;
    this.saveable = {
      autosaveable: false,
      get dirty() {
        return widget.dirty;
      },
      onDirtyChanged: this.dirtyChangedEmitter.event,
      onContentChanged: this.contentChangedEmitter.event,
      save: () => this.save(),
      saveAs: (options: SaveAsOptions) => this.saveAs(options),
      filters: () => ({
        'Commodore Commander Sprite': [
          COMMODORE_SPRITE_FILE_EXTENSION.slice(1)
        ]
      })
    };
  }

  async initialize(resourceUri: URI): Promise<void> {
    this.resourceUri = resourceUri;
    this.id = `${COMMODORE_SPRITE_WIDGET_FACTORY_ID}:${resourceUri.toString()}`;
    this.title.label = resourceUri.path.base;
    this.title.caption = resourceUri.toString();
    this.title.iconClass = codicon('symbol-misc');
    this.title.closable = true;
    this.addClass('cc-sprite-editor');
    await this.load();
  }

  getResourceUri(): URI | undefined {
    return this.resourceUri;
  }

  createMoveToUri(resourceUri: URI): URI | undefined {
    return resourceUri;
  }

  override dispose(): void {
    this.stopAnimation();
    this.dirtyChangedEmitter.dispose();
    this.contentChangedEmitter.dispose();
    super.dispose();
  }

  protected override onActivateRequest(msg: Message): void {
    super.onActivateRequest(msg);
    this.node.focus();
  }

  protected async load(): Promise<void> {
    if (!this.resourceUri) {
      return;
    }

    try {
      if (await this.fileService.exists(this.resourceUri)) {
        const content = await this.fileService.read(this.resourceUri, {
          acceptTextOnly: true
        });
        this.document = this.withFilenameDerivedName(
          parseSpriteDocument(content.value)
        );
      } else {
        this.document = this.withFilenameDerivedName(
          createDefaultSpriteDocument(this.resourceUri.path.name)
        );
        await this.writeDocument(this.resourceUri);
      }
      this.paintValue = this.document.colorMode === 'multicolor' ? 2 : 1;
      this.selectedFrameIndex = Math.min(
        this.selectedFrameIndex,
        Math.max(0, this.document.frames.length - 1)
      );
      this.memoryAddressInput = formatAddress(this.document.target.spriteDataAddress);
      this.loaded = true;
      this.setDirty(false);
      this.update();
    } catch (error) {
      this.messageService.error(
        `Could not open sprite: ${toErrorMessage(error)}`
      );
    }
  }

  async save(): Promise<void> {
    if (!this.resourceUri) {
      return;
    }

    await this.writeDocument(this.resourceUri);
    this.setDirty(false);
    this.messageService.info(`Saved ${this.resourceUri.path.base}.`);
  }

  async saveAs(options: SaveAsOptions): Promise<void> {
    this.resourceUri = options.target;
    this.title.label = options.target.path.base;
    this.title.caption = options.target.toString();
    await this.save();
  }

  protected async writeDocument(uri: URI): Promise<void> {
    this.document = this.withFilenameDerivedName(this.document, uri);
    await this.fileService.write(uri, serializeSpriteDocument(this.document));
  }

  protected markChanged(document: CommodoreSpriteDocument): void {
    this.document = this.withFilenameDerivedName(
      normalizeSpriteDocument(document)
    );
    this.selectedFrameIndex = Math.min(
      this.selectedFrameIndex,
      Math.max(0, this.document.frames.length - 1)
    );
    this.setDirty(true);
    this.contentChangedEmitter.fire();
    this.update();
  }

  protected withFilenameDerivedName(
    document: CommodoreSpriteDocument,
    uri = this.resourceUri
  ): CommodoreSpriteDocument {
    const name = uri?.path.name;
    if (!name || document.metadata.name === name) {
      return document;
    }
    return {
      ...document,
      metadata: {
        ...document.metadata,
        name
      }
    };
  }

  protected setDirty(dirty: boolean): void {
    if (this.dirty === dirty) {
      return;
    }
    this.dirty = dirty;
    this.dirtyChangedEmitter.fire();
  }

  protected async exportRaw(): Promise<void> {
    const target = await this.pickExportTarget(
      'Export Sprite Bytes',
      COMMODORE_RAW_SPRITE_FILE_EXTENSION
    );
    if (!target) {
      return;
    }

    await this.fileService.writeFile(
      target,
      BinaryBuffer.wrap(spriteSheetToBytes(this.document))
    );
    this.messageService.info(`Exported ${target.path.base}.`);
  }

  protected async importRaw(): Promise<void> {
    const root = this.resourceUri
      ? await this.fileService.resolve(this.resourceUri.parent)
      : (await this.workspaceService.roots)[0];
    const source = await this.fileDialogService.showOpenDialog(
      {
        title: 'Import Raw Sprite',
        openLabel: 'Import',
        canSelectFiles: true,
        canSelectFolders: false,
        filters: {
          'Raw Sprite Data': [
            COMMODORE_RAW_SPRITE_FILE_EXTENSION.slice(1),
            'bin'
          ]
        }
      },
      root
    );
    if (!source) {
      return;
    }

    const content = await this.fileService.readFile(source);
    const imported = bytesToSpriteSheetDocument(content.value.buffer, source.path.name, {
      colorMode: this.document.colorMode,
      machine: this.document.metadata.machine,
      colors: this.document.colors
    });
    this.markChanged({
      ...imported,
      metadata: this.document.metadata
    });
    this.selectedFrameIndex = 0;
    this.messageService.info(
      `Imported ${source.path.base} as ${imported.frames.length} frame(s).`
    );
  }

  protected async exportAssembler(): Promise<void> {
    const label = await this.promptAssemblerLabel(
      this.resourceUri?.path.name || 'SpriteData'
    );
    if (!label) {
      return;
    }
    const target = await this.pickExportTarget(
      'Export KickAssembler Sprite',
      '.asm'
    );
    if (!target) {
      return;
    }

    await this.fileService.write(
      target,
      formatKickAssemblerSprite(
        this.withFilenameDerivedName(this.document),
        label
      )
    );
    this.messageService.info(`Exported ${target.path.base}.`);
  }

  protected async importAssembler(): Promise<void> {
    const root = this.resourceUri
      ? await this.fileService.resolve(this.resourceUri.parent)
      : (await this.workspaceService.roots)[0];
    const source = await this.fileDialogService.showOpenDialog(
      {
        title: 'Import KickAssembler Sprite Symbol',
        openLabel: 'Import',
        canSelectFiles: true,
        canSelectFolders: false,
        filters: {
          'KickAssembler Source': ['asm', 's']
        }
      },
      root
    );
    if (!source) {
      return;
    }
    const label = await this.promptAssemblerLabel(
      this.resourceUri?.path.name || source.path.name || 'SpriteData'
    );
    if (!label) {
      return;
    }

    const content = await this.fileService.read(source, { acceptTextOnly: true });
    const imported = parseKickAssemblerSpriteSheet(
      content.value,
      label,
      source.path.name,
      {
        colorMode: this.document.colorMode,
        machine: this.document.metadata.machine,
        colors: this.document.colors,
        target: this.document.target
      }
    );
    this.markChanged({
      ...imported,
      metadata: this.document.metadata
    });
    this.selectedFrameIndex = 0;
    this.messageService.info(
      `Imported ${imported.frames.length} sprite frame(s) from ${label}.`
    );
  }

  protected async promptAssemblerLabel(defaultValue: string): Promise<string | undefined> {
    const fallback = toAssemblerLabel(defaultValue || 'SpriteData');
    return this.quickInputService.input({
      placeHolder: 'KickAssembler symbol label',
      value: fallback,
      validateInput: async (value) =>
        /^[A-Za-z_][A-Za-z0-9_]*$/u.test(value.trim())
          ? undefined
          : 'Enter a valid assembler label.'
    });
  }

  protected async pickExportTarget(
    title: string,
    extension: string
  ): Promise<URI | undefined> {
    const root = this.resourceUri
      ? await this.fileService.resolve(this.resourceUri.parent)
      : (await this.workspaceService.roots)[0];
    const baseName = this.resourceUri?.path.name || 'sprite';
    return this.fileDialogService.showSaveDialog(
      {
        title,
        saveLabel: 'Export',
        inputValue: `${baseName}${extension}`,
        filters: {
          [extension.toUpperCase().replace('.', '')]: [extension.slice(1)]
        }
      },
      root
    );
  }

  protected setColorMode(colorMode: CommodoreSpriteColorMode): void {
    this.paintValue = colorMode === 'multicolor' ? 2 : 1;
    this.openColorSelectorRole = undefined;
    this.markChanged({
      ...this.document,
      colorMode
    });
  }

  protected setMachine(machine: string): void {
    const target = defaultSpriteTargetForMachine(machine);
    this.memoryAddressInput = formatAddress(target.spriteDataAddress);
    this.markChanged({
      ...this.document,
      metadata: {
        ...this.document.metadata,
        machine
      },
      target
    });
  }

  protected selectFrame(index: number): void {
    this.selectedFrameIndex = Math.max(
      0,
      Math.min(this.document.frames.length - 1, Math.trunc(index))
    );
    this.update();
  }

  protected addFrame(): void {
    const frames = [...this.document.frames];
    frames.splice(
      this.selectedFrameIndex + 1,
      0,
      createSpriteFrame(
        `Frame ${frames.length + 1}`,
        undefined,
        this.document.animation.defaultFrameDurationMs
      )
    );
    this.selectedFrameIndex += 1;
    this.markChanged({
      ...this.document,
      frames
    });
  }

  protected duplicateFrame(): void {
    const source = this.document.frames[this.selectedFrameIndex];
    if (!source) {
      return;
    }
    const frames = [...this.document.frames];
    frames.splice(this.selectedFrameIndex + 1, 0, {
      ...source,
      name: `${source.name} copy`
    });
    this.selectedFrameIndex += 1;
    this.markChanged({
      ...this.document,
      frames
    });
  }

  protected deleteFrame(): void {
    if (this.document.frames.length <= 1) {
      this.clearSprite();
      return;
    }
    const frames = this.document.frames.filter(
      (_frame, index) => index !== this.selectedFrameIndex
    );
    this.selectedFrameIndex = Math.max(0, this.selectedFrameIndex - 1);
    this.markChanged({
      ...this.document,
      frames
    });
  }

  protected moveFrame(direction: -1 | 1): void {
    const nextIndex = this.selectedFrameIndex + direction;
    if (nextIndex < 0 || nextIndex >= this.document.frames.length) {
      return;
    }
    const frames = [...this.document.frames];
    const [frame] = frames.splice(this.selectedFrameIndex, 1);
    if (!frame) {
      return;
    }
    frames.splice(nextIndex, 0, frame);
    this.selectedFrameIndex = nextIndex;
    this.markChanged({
      ...this.document,
      frames
    });
  }

  protected setFrameDuration(value: number): void {
    const durationMs = Math.max(16, Math.min(5000, Math.trunc(value)));
    this.markChanged({
      ...this.document,
      frames: this.document.frames.map((frame, index) =>
        index === this.selectedFrameIndex ? { ...frame, durationMs } : frame
      )
    });
  }

  protected setTargetValue(
    field: 'spriteDataAddress' | 'screenAddress' | 'spritePointerIndex' | 'vicBank',
    value: number
  ): void {
    const target = {
      ...this.document.target,
      [field]: field === 'spritePointerIndex'
        ? Math.max(0, Math.min(7, Math.trunc(value)))
        : field === 'vicBank'
          ? Math.max(0, Math.min(3, Math.trunc(value)))
          : value & 0xffff
    };
    if (field === 'spriteDataAddress') {
      this.memoryAddressInput = formatAddress(target.spriteDataAddress);
    }
    this.markChanged({
      ...this.document,
      target
    });
  }

  protected toggleAnimation(): void {
    if (this.animationPlaying) {
      this.stopAnimation();
    } else {
      this.startAnimation();
    }
  }

  protected startAnimation(): void {
    if (this.document.frames.length <= 1) {
      return;
    }
    this.animationPlaying = true;
    this.animationDirection = 1;
    this.scheduleAnimationTick();
    this.update();
  }

  protected stopAnimation(): void {
    this.animationPlaying = false;
    if (this.animationTimer !== undefined) {
      window.clearTimeout(this.animationTimer);
      this.animationTimer = undefined;
    }
  }

  protected scheduleAnimationTick(): void {
    if (!this.animationPlaying) {
      return;
    }
    const frame = this.document.frames[this.selectedFrameIndex];
    const delay = frame?.durationMs ?? this.document.animation.defaultFrameDurationMs;
    this.animationTimer = window.setTimeout(() => {
      this.advanceAnimationFrame();
      this.scheduleAnimationTick();
    }, delay);
  }

  protected advanceAnimationFrame(): void {
    const lastIndex = this.document.frames.length - 1;
    if (lastIndex <= 0) {
      this.stopAnimation();
      return;
    }
    if (this.document.animation.playback === 'ping-pong') {
      if (this.selectedFrameIndex >= lastIndex) {
        this.animationDirection = -1;
      } else if (this.selectedFrameIndex <= 0) {
        this.animationDirection = 1;
      }
      this.selectedFrameIndex = Math.max(
        0,
        Math.min(lastIndex, this.selectedFrameIndex + this.animationDirection)
      );
    } else if (this.selectedFrameIndex >= lastIndex) {
      if (this.document.animation.playback === 'once') {
        this.stopAnimation();
      } else {
        this.selectedFrameIndex = 0;
      }
    } else {
      this.selectedFrameIndex += 1;
    }
    this.update();
  }

  protected setColor(role: ColorRole, index: number): void {
    this.openColorSelectorRole = undefined;
    this.markChanged({
      ...this.document,
      colors: {
        ...this.document.colors,
        [role]: index
      }
    });
  }

  protected setPaintValue(value: number): void {
    this.paintValue = value;
    this.openColorSelectorRole = undefined;
    this.update();
  }

  protected setEditorPixelSize(value: number): void {
    this.editorPixelSize = Math.max(14, Math.min(34, Math.trunc(value)));
    this.update();
  }

  protected toggleColorSelector(role: ColorRole): void {
    this.openColorSelectorRole = this.openColorSelectorRole === role
      ? undefined
      : role;
    this.update();
  }

  protected closeColorSelector(): void {
    if (!this.openColorSelectorRole) {
      return;
    }
    this.openColorSelectorRole = undefined;
    this.update();
  }

  protected beginPaint(
    x: number,
    y: number,
    event: React.MouseEvent<HTMLButtonElement>
  ): void {
    event.preventDefault();
    const erasing = event.button === 2;
    this.activePaintValue = erasing
      ? 0
      : this.document.colorMode === 'multicolor'
        ? this.paintValue
        : getHiresValue(this.document, x, y, this.selectedFrameIndex) === 0 ? 1 : 0;
    this.paintSpritePixel(x, y, this.activePaintValue);
  }

  protected continuePaint(x: number, y: number): void {
    if (this.activePaintValue === undefined) {
      return;
    }
    this.paintSpritePixel(x, y, this.activePaintValue);
  }

  protected endPaint(): void {
    this.activePaintValue = undefined;
  }

  protected paintSpritePixel(x: number, y: number, value: number): void {
    if (this.document.colorMode === 'multicolor') {
      if (getMulticolorValue(this.document, x, y, this.selectedFrameIndex) === value) {
        return;
      }
      this.markChanged(
        setMulticolorSpritePixel(
          this.document,
          x,
          y,
          value,
          this.selectedFrameIndex
        )
      );
      return;
    }

    const enabled = value !== 0;
    if (getHiresValue(this.document, x, y, this.selectedFrameIndex) === (enabled ? 1 : 0)) {
      return;
    }
    this.markChanged(
      setHiresSpritePixel(
        this.document,
        x,
        y,
        enabled,
        this.selectedFrameIndex
      )
    );
  }

  protected clearSprite(): void {
    this.markChanged(
      transformSprite(
        this.document,
        () => Array.from({ length: COMMODORE_SPRITE_GEOMETRY.slotBytes }, () => 0),
        this.selectedFrameIndex
      )
    );
  }

  protected invertSprite(): void {
    this.markChanged(
      transformSprite(
        this.document,
        (bytes) =>
          bytes.map((byte, index) =>
            index < COMMODORE_SPRITE_GEOMETRY.dataBytes ? byte ^ 0xff : byte
          ),
        this.selectedFrameIndex
      )
    );
  }

  protected flipSpriteHorizontally(): void {
    this.markChanged(
      transformSprite(
        this.document,
        (bytes) => transformRows(bytes, (rowValue) =>
          this.document.colorMode === 'multicolor'
            ? reverseMulticolorSpriteRow(rowValue)
            : reverse24Bits(rowValue)
        ),
        this.selectedFrameIndex
      )
    );
  }

  protected flipSpriteVertically(): void {
    this.markChanged(
      transformSprite(
        this.document,
        (bytes) => {
          const next = Array.from({ length: COMMODORE_SPRITE_GEOMETRY.slotBytes }, () => 0);
          next[63] = bytes[63] ?? 0;
          for (let y = 0; y < COMMODORE_SPRITE_GEOMETRY.height; y += 1) {
            const sourceY = COMMODORE_SPRITE_GEOMETRY.height - 1 - y;
            copyRow(bytes, sourceY, next, y);
          }
          return next;
        },
        this.selectedFrameIndex
      )
    );
  }

  protected shiftSprite(dx: number, dy: number): void {
    this.markChanged(
      transformSprite(
        this.document,
        (bytes) => {
          const next = Array.from({ length: COMMODORE_SPRITE_GEOMETRY.slotBytes }, () => 0);
          next[63] = bytes[63] ?? 0;
          const horizontalShift = this.document.colorMode === 'multicolor'
            ? Math.abs(dx) * 2
            : Math.abs(dx);
          for (let y = 0; y < COMMODORE_SPRITE_GEOMETRY.height; y += 1) {
            const sourceY = y - dy;
            if (sourceY < 0 || sourceY >= COMMODORE_SPRITE_GEOMETRY.height) {
              continue;
            }
            const sourceRow = rowValue(bytes, sourceY);
            const shifted = dx < 0
              ? (sourceRow << horizontalShift) & 0xffffff
              : dx > 0
                ? sourceRow >>> horizontalShift
                : sourceRow;
            writeRow(next, y, shifted);
          }
          return next;
        },
        this.selectedFrameIndex
      )
    );
  }

  protected currentViceSession(): DebugSession | undefined {
    const session = this.debugSessionManager.currentSession;
    return session?.configuration.type === COMMODORE_VICE_DEBUG_TYPE
      ? session
      : undefined;
  }

  protected async readViceMemory(): Promise<void> {
    const session = this.requireViceSession(false);
    const address = await this.resolveAddress(session, this.memoryAddressInput);
    const count = this.memoryTransferScope === 'sheet'
      ? this.document.frames.length * COMMODORE_SPRITE_GEOMETRY.slotBytes
      : COMMODORE_SPRITE_GEOMETRY.slotBytes;
    const response = await session.sendRequest(
      'readMemory',
      {
        memoryReference: memoryReference(address),
        count,
        sideEffects: false
      } as DebugRequestTypes['readMemory'][0] & MemoryRequestOptions,
      VICE_MEMORY_TIMEOUT_MS
    );
    const bytes = response.body?.data
      ? decodeBase64(response.body.data)
      : new Uint8Array(0);
    if (this.memoryTransferScope === 'sheet') {
      const imported = bytesToSpriteSheetDocument(bytes, this.document.metadata.name, {
        colorMode: this.document.colorMode,
        machine: this.document.metadata.machine,
        colors: this.document.colors,
        target: {
          ...this.document.target,
          spriteDataAddress: address
        }
      });
      this.selectedFrameIndex = 0;
      this.markChanged({
        ...imported,
        metadata: this.document.metadata
      });
      this.viceStatus = `Read ${imported.frames.length} frame(s) from ${formatAddress(address)}.`;
    } else {
      this.markChanged(
        replaceSpriteFrameData(this.document, this.selectedFrameIndex, bytes)
      );
      this.viceStatus = `Read frame ${this.selectedFrameIndex + 1} from ${formatAddress(address)}.`;
    }
    this.update();
  }

  protected async writeViceMemory(): Promise<void> {
    const session = this.requireViceSession(true);
    const address = await this.resolveAddress(session, this.memoryAddressInput);
    const bytes = this.memoryTransferScope === 'sheet'
      ? spriteSheetToBytes(this.document)
      : spriteToBytes(this.document, this.selectedFrameIndex);
    await session.sendRequest(
      'writeMemory',
      {
        memoryReference: memoryReference(address),
        data: encodeBase64(bytes),
        sideEffects: false
      } as DebugRequestTypes['writeMemory'][0] & MemoryRequestOptions,
      VICE_MEMORY_TIMEOUT_MS
    );
    this.setTargetValue('spriteDataAddress', address);
    this.viceStatus = `Wrote ${bytes.length} byte(s) to ${formatAddress(address)}.`;
    this.update();
  }

  protected async writeViceSpritePointer(): Promise<void> {
    const session = this.requireViceSession(true);
    const pointer = spritePointerValue(this.document.target);
    if (pointer === undefined) {
      throw new Error('Sprite data address must be inside the selected VIC bank and aligned to 64 bytes.');
    }
    const pointerAddress =
      this.document.target.screenAddress +
      0x03f8 +
      this.document.target.spritePointerIndex;
    await session.sendRequest(
      'writeMemory',
      {
        memoryReference: memoryReference(pointerAddress),
        data: encodeBase64(Uint8Array.of(pointer)),
        sideEffects: false
      } as DebugRequestTypes['writeMemory'][0] & MemoryRequestOptions,
      VICE_MEMORY_TIMEOUT_MS
    );
    this.viceStatus =
      `Wrote pointer $${hexByte(pointer)} to ${formatAddress(pointerAddress)}.`;
    this.update();
  }

  protected requireViceSession(write: boolean): DebugSession {
    const session = this.currentViceSession();
    if (!session) {
      throw new Error('Start a commodore-vice debug session first.');
    }
    if (session.state !== DebugState.Stopped) {
      throw new Error('Pause or stop at a breakpoint before using VICE memory.');
    }
    if (!session.capabilities.supportsReadMemoryRequest) {
      throw new Error('The active debug session does not support memory reads.');
    }
    if (write && !session.capabilities.supportsWriteMemoryRequest) {
      throw new Error('The active debug session does not support memory writes.');
    }
    return session;
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
    const address =
      parseOptionalAddress(result.memoryReference ?? '') ??
      parseOptionalAddress(result.result);
    if (address === undefined) {
      throw new Error(`Could not resolve memory address: ${input}`);
    }
    return address;
  }

  protected runViceAction(action: () => Promise<void>): void {
    void action().catch((error) => {
      this.viceStatus = error instanceof Error ? error.message : String(error);
      this.update();
    });
  }

  protected render(): React.ReactNode {
    if (!this.loaded) {
      return (
        <div style={rootStyle}>
          <div style={loadingStyle}>Loading sprite...</div>
        </div>
      );
    }

    return (
      <div
        style={rootStyle}
        tabIndex={0}
        onMouseUp={() => this.endPaint()}
        onMouseLeave={() => this.endPaint()}
      >
        {this.renderToolbar()}
        <div style={bodyStyle}>
          <section style={leftRailStyle}>
            {this.renderPreviewPanel()}
            {this.renderFramePanel()}
            {this.renderInspector()}
            {this.renderTargetPanel()}
          </section>
          <section style={editorSectionStyle}>
            {this.renderBitmapEditor()}
          </section>
          <section style={rightRailStyle}>
            {this.renderVicePanel()}
            {this.renderByteRows()}
          </section>
        </div>
      </div>
    );
  }

  protected renderToolbar(): React.ReactNode {
    return (
      <div style={toolbarStyle}>
        <button style={commandButtonStyle} onClick={() => void this.save()}>
          <span className={codicon('save')} /> Save
        </button>
        <button
          style={commandButtonStyle}
          onClick={() => void this.importRaw()}
        >
          <span className={codicon('folder-opened')} /> Import .SPR
        </button>
        <button style={commandButtonStyle} onClick={() => void this.exportRaw()}>
          <span className={codicon('file-binary')} /> .SPR Sheet
        </button>
        <button
          style={commandButtonStyle}
          onClick={() => void this.importAssembler()}
        >
          <span className={codicon('symbol-field')} /> Import Symbol
        </button>
        <button
          style={commandButtonStyle}
          onClick={() => void this.exportAssembler()}
        >
          <span className={codicon('file-code')} /> ASM Symbol
        </button>
        <label style={fieldLabelStyle}>
          Mode
          <select
            value={this.document.colorMode}
            onChange={(event) =>
              this.setColorMode(event.currentTarget.value as CommodoreSpriteColorMode)
            }
            style={selectStyle}
          >
            <option value='hires'>Single color</option>
            <option value='multicolor'>Multi-color</option>
          </select>
        </label>
        <label style={fieldLabelStyle}>
          Machine
          <select
            value={this.document.metadata.machine}
            onChange={(event) => this.setMachine(event.currentTarget.value)}
            style={selectStyle}
          >
            {COMMODORE_SPRITE_MACHINE_OPTIONS.map((machine) => (
              <option key={machine.id} value={machine.id}>
                {machine.label}
              </option>
            ))}
          </select>
        </label>
        <label style={fieldLabelStyle}>
          Zoom
          <input
            max={34}
            min={14}
            onChange={(event) =>
              this.setEditorPixelSize(Number.parseInt(event.currentTarget.value, 10))
            }
            style={rangeStyle}
            type='range'
            value={this.editorPixelSize}
          />
        </label>
        {this.document.colorMode === 'multicolor'
          ? this.renderMulticolorPaintTools()
          : this.renderSingleColorTools()}
      </div>
    );
  }

  protected renderPreviewPanel(): React.ReactNode {
    const frame = this.document.frames[this.selectedFrameIndex];
    return (
      <div style={panelStyle}>
        <div style={panelTitleStyle}>Preview</div>
        <div
          style={{
            ...previewStageStyle,
            background: this.pixelColor(0)
          }}
        >
          {this.renderSpritePreview(6)}
        </div>
        <div style={statsGridStyle}>
          <span>24 x 21</span>
          <span>{this.document.frames.length} frame(s)</span>
          <span>{this.document.colorMode === 'multicolor' ? '12 wide pixels' : '24 pixels'}</span>
          <span>{frame?.durationMs ?? this.document.animation.defaultFrameDurationMs} ms</span>
        </div>
      </div>
    );
  }

  protected renderFramePanel(): React.ReactNode {
    const selectedFrame = this.document.frames[this.selectedFrameIndex];
    return (
      <div style={panelStyle}>
        <div style={panelTitleRowStyle}>
          <span style={panelTitleStyle}>Frames</span>
          <span style={panelDetailStyle}>{this.selectedFrameIndex + 1}/{this.document.frames.length}</span>
        </div>
        <div style={frameStripStyle}>
          {this.document.frames.map((frame, index) => {
            const selected = index === this.selectedFrameIndex;
            return (
              <button
                key={`${index}:${frame.name}`}
                onClick={() => this.selectFrame(index)}
                style={{
                  ...frameButtonStyle,
                  borderColor: selected
                    ? 'var(--theia-focusBorder)'
                    : 'var(--theia-editorGroup-border)'
                }}
                title={`${frame.name} (${frame.durationMs} ms)`}
              >
                {this.renderSpritePreview(2, index)}
                <span style={frameButtonLabelStyle}>{index + 1}</span>
              </button>
            );
          })}
        </div>
        <div style={toolRowStyle}>
          <button title='Add frame' style={iconButtonStyle} onClick={() => this.addFrame()}>
            <span className={codicon('add')} />
          </button>
          <button title='Duplicate frame' style={iconButtonStyle} onClick={() => this.duplicateFrame()}>
            <span className={codicon('copy')} />
          </button>
          <button title='Delete frame' style={iconButtonStyle} onClick={() => this.deleteFrame()}>
            <span className={codicon('trash')} />
          </button>
          <button title='Move frame left' style={iconButtonStyle} onClick={() => this.moveFrame(-1)}>
            <span className={codicon('arrow-left')} />
          </button>
          <button title='Move frame right' style={iconButtonStyle} onClick={() => this.moveFrame(1)}>
            <span className={codicon('arrow-right')} />
          </button>
          <button title={this.animationPlaying ? 'Stop animation' : 'Play animation'} style={iconButtonStyle} onClick={() => this.toggleAnimation()}>
            <span className={codicon(this.animationPlaying ? 'debug-pause' : 'play')} />
          </button>
        </div>
        <label style={fieldLabelGridStyle}>
          Duration
          <input
            max={5000}
            min={16}
            onChange={(event) =>
              this.setFrameDuration(Number.parseInt(event.currentTarget.value, 10))
            }
            style={numberInputStyle}
            type='number'
            value={selectedFrame?.durationMs ?? this.document.animation.defaultFrameDurationMs}
          />
        </label>
      </div>
    );
  }

  protected renderInspector(): React.ReactNode {
    return (
      <div style={panelStyle}>
        <div style={panelTitleStyle}>Edit</div>
        <div style={toolRowStyle}>
          <button
            title='Flip horizontally'
            style={iconButtonStyle}
            onClick={() => this.flipSpriteHorizontally()}
          >
            <span className={codicon('split-horizontal')} />
          </button>
          <button
            title='Flip vertically'
            style={iconButtonStyle}
            onClick={() => this.flipSpriteVertically()}
          >
            <span className={codicon('split-vertical')} />
          </button>
          <button
            title='Invert'
            style={iconButtonStyle}
            onClick={() => this.invertSprite()}
          >
            <span className={codicon('color-mode')} />
          </button>
          <button
            title='Clear'
            style={iconButtonStyle}
            onClick={() => this.clearSprite()}
          >
            <span className={codicon('clear-all')} />
          </button>
        </div>
        <div style={toolRowStyle}>
          <button
            title='Shift left'
            style={iconButtonStyle}
            onClick={() => this.shiftSprite(-1, 0)}
          >
            <span className={codicon('arrow-left')} />
          </button>
          <button
            title='Shift right'
            style={iconButtonStyle}
            onClick={() => this.shiftSprite(1, 0)}
          >
            <span className={codicon('arrow-right')} />
          </button>
          <button
            title='Shift up'
            style={iconButtonStyle}
            onClick={() => this.shiftSprite(0, -1)}
          >
            <span className={codicon('arrow-up')} />
          </button>
          <button
            title='Shift down'
            style={iconButtonStyle}
            onClick={() => this.shiftSprite(0, 1)}
          >
            <span className={codicon('arrow-down')} />
          </button>
        </div>
      </div>
    );
  }

  protected renderTargetPanel(): React.ReactNode {
    const machine = COMMODORE_SPRITE_MACHINE_OPTIONS.find(
      (option) => option.id === this.document.metadata.machine
    );
    const pointer = spritePointerValue(this.document.target);
    return (
      <div style={panelStyle}>
        <div style={panelTitleStyle}>Target</div>
        <div style={targetGridStyle}>
          <label style={fieldLabelGridStyle}>
            Sprite data
            <input
              onBlur={(event) =>
                this.setTargetValue(
                  'spriteDataAddress',
                  parseOptionalAddress(event.currentTarget.value) ??
                    this.document.target.spriteDataAddress
                )
              }
              style={numberInputStyle}
              defaultValue={formatAddress(this.document.target.spriteDataAddress)}
            />
          </label>
          <label style={fieldLabelGridStyle}>
            Screen RAM
            <input
              onBlur={(event) =>
                this.setTargetValue(
                  'screenAddress',
                  parseOptionalAddress(event.currentTarget.value) ??
                    this.document.target.screenAddress
                )
              }
              style={numberInputStyle}
              defaultValue={formatAddress(this.document.target.screenAddress)}
            />
          </label>
          <label style={fieldLabelGridStyle}>
            Sprite #
            <input
              max={7}
              min={0}
              onChange={(event) =>
                this.setTargetValue(
                  'spritePointerIndex',
                  Number.parseInt(event.currentTarget.value, 10)
                )
              }
              style={numberInputStyle}
              type='number'
              value={this.document.target.spritePointerIndex}
            />
          </label>
          <label style={fieldLabelGridStyle}>
            VIC bank
            <input
              max={3}
              min={0}
              onChange={(event) =>
                this.setTargetValue(
                  'vicBank',
                  Number.parseInt(event.currentTarget.value, 10)
                )
              }
              style={numberInputStyle}
              type='number'
              value={this.document.target.vicBank}
            />
          </label>
        </div>
        <div style={panelDetailStyle}>
          Pointer {pointer === undefined ? 'not aligned' : `$${hexByte(pointer)}`} at {formatAddress(this.document.target.screenAddress + 0x03f8 + this.document.target.spritePointerIndex)}
        </div>
        {machine && (
          <div style={machineNotesStyle}>
            {machine.notes.map((note) => (
              <div key={note}>{note}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  protected renderVicePanel(): React.ReactNode {
    return (
      <div style={panelStyle}>
        <div style={panelTitleStyle}>VICE</div>
        <label style={fieldLabelGridStyle}>
          Address or label
          <input
            onChange={(event) => {
              this.memoryAddressInput = event.currentTarget.value;
              this.update();
            }}
            style={numberInputStyle}
            value={this.memoryAddressInput}
          />
        </label>
        <label style={fieldLabelGridStyle}>
          Scope
          <select
            onChange={(event) => {
              this.memoryTransferScope = event.currentTarget.value as ViceTransferScope;
              this.update();
            }}
            style={selectStyle}
            value={this.memoryTransferScope}
          >
            <option value='frame'>Selected frame</option>
            <option value='sheet'>All frames</option>
          </select>
        </label>
        <div style={toolRowStyle}>
          <button
            style={commandButtonStyle}
            onClick={() => this.runViceAction(() => this.readViceMemory())}
          >
            <span className={codicon('cloud-download')} /> Read
          </button>
          <button
            style={commandButtonStyle}
            onClick={() => this.runViceAction(() => this.writeViceMemory())}
          >
            <span className={codicon('cloud-upload')} /> Write
          </button>
          <button
            style={commandButtonStyle}
            onClick={() => this.runViceAction(() => this.writeViceSpritePointer())}
          >
            <span className={codicon('link')} /> Pointer
          </button>
        </div>
        <div style={panelDetailStyle}>{this.viceStatus}</div>
      </div>
    );
  }

  protected renderSingleColorTools(): React.ReactNode {
    return (
      <div style={singleColorToolsStyle}>
        {SINGLE_COLOR_CHOICES.map((choice) => (
          <div key={choice.role} style={singleColorChoiceStyle}>
            <span style={paintChoiceTextStyle}>
              {choice.label}
              {choice.detail && (
                <span style={paintChoiceDetailStyle}>{choice.detail}</span>
              )}
            </span>
            {this.renderColorButton(choice.role, choice.label)}
          </div>
        ))}
      </div>
    );
  }

  protected renderMulticolorPaintTools(): React.ReactNode {
    return (
      <div style={multicolorPaintToolsStyle}>
        {MULTICOLOR_PAINT_CHOICES.map((choice) => {
          const selected = choice.value === this.paintValue;
          return (
            <div key={choice.value} style={multicolorPaintChoiceStyle}>
              <button
                type='button'
                title={`Paint ${choice.label}`}
                style={multicolorPaintSelectButtonStyle}
                onClick={() => this.setPaintValue(choice.value)}
              >
                <span
                  style={{
                    ...paintRadioStyle,
                    background: selected
                      ? 'var(--theia-focusBorder)'
                      : 'transparent',
                    boxShadow: selected
                      ? 'inset 0 0 0 3px var(--theia-editorWidget-background)'
                      : undefined
                  }}
                />
                <span style={paintChoiceTextStyle}>
                  {choice.label}
                  {choice.detail && (
                    <span style={paintChoiceDetailStyle}>{choice.detail}</span>
                  )}
                </span>
              </button>
              <div style={multicolorPaintSwatchSlotStyle}>
                {this.renderColorButton(choice.role, choice.label)}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  protected renderColorButton(role: ColorRole, label: string): React.ReactNode {
    const colorIndex = this.document.colors[role];
    const color = C64_COLOR_PALETTE[colorIndex];
    return (
      <div style={colorButtonAnchorStyle}>
        <button
          type='button'
          title={`Choose ${label}${color ? `: ${color.name}` : ''}`}
          aria-label={`Choose ${label} color`}
          onClick={() => this.toggleColorSelector(role)}
          style={{
            ...paintChoiceSwatchButtonStyle,
            background: color?.hex ?? '#000000'
          }}
        />
        {this.openColorSelectorRole === role && (
          <>
            <div
              style={colorSelectorBackdropStyle}
              onClick={() => this.closeColorSelector()}
            />
            {this.renderColorSelector(role)}
          </>
        )}
      </div>
    );
  }

  protected renderColorSelector(role: ColorRole): React.ReactNode {
    const selectedColorIndex = this.document.colors[role];
    return (
      <div style={colorSelectorPopoverStyle}>
        {C64_COLOR_PALETTE.map((color) => {
          const selected = selectedColorIndex === color.index;
          return (
            <button
              key={`${role}:${color.index}`}
              type='button'
              title={`${color.index} ${color.name}`}
              aria-label={`${color.name} (${color.index})`}
              onClick={() => this.setColor(role, color.index)}
              style={{
                ...colorSelectorSwatchStyle,
                background: color.hex,
                borderColor: selected
                  ? 'var(--theia-focusBorder)'
                  : 'var(--theia-editorGroup-border)',
                boxShadow: selected
                  ? '0 0 0 1px var(--theia-focusBorder)'
                  : undefined
              }}
            />
          );
        })}
      </div>
    );
  }

  protected renderBitmapEditor(): React.ReactNode {
    const columns = this.document.colorMode === 'multicolor'
      ? COMMODORE_SPRITE_GEOMETRY.multicolorWidth
      : COMMODORE_SPRITE_GEOMETRY.width;
    const pixelWidth = this.document.colorMode === 'multicolor'
      ? this.editorPixelSize * 2
      : this.editorPixelSize;
    return (
      <div
        style={{
          ...bitmapGridStyle,
          gridTemplateColumns: `repeat(${columns}, ${pixelWidth}px)`
        }}
      >
        {Array.from({ length: COMMODORE_SPRITE_GEOMETRY.height }, (_, y) =>
          Array.from({ length: columns }, (_unused, x) => {
            const value = this.document.colorMode === 'multicolor'
              ? getMulticolorValue(this.document, x, y, this.selectedFrameIndex)
              : getHiresValue(this.document, x, y, this.selectedFrameIndex);
            return (
              <button
                key={`${x}:${y}`}
                title={`${x},${y}`}
                onMouseDown={(event) => this.beginPaint(x, y, event)}
                onMouseEnter={() => this.continuePaint(x, y)}
                onContextMenu={(event) => {
                  event.preventDefault();
                }}
                style={{
                  ...bitmapPixelStyle,
                  background: this.pixelColor(value),
                  height: `${this.editorPixelSize}px`,
                  width: `${pixelWidth}px`
                }}
              />
            );
          })
        )}
      </div>
    );
  }

  protected renderSpritePreview(
    pixelSize: number,
    frameIndex = this.selectedFrameIndex
  ): React.ReactNode {
    const columns = this.document.colorMode === 'multicolor'
      ? COMMODORE_SPRITE_GEOMETRY.multicolorWidth
      : COMMODORE_SPRITE_GEOMETRY.width;
    return (
      <div
        style={{
          display: 'grid',
          gap: 0,
          gridTemplateColumns: `repeat(${columns}, ${pixelSize *
            (this.document.colorMode === 'multicolor' ? 2 : 1)}px)`
        }}
      >
        {Array.from({ length: COMMODORE_SPRITE_GEOMETRY.height }, (_, y) =>
          Array.from({ length: columns }, (_unused, x) => {
            const value = this.document.colorMode === 'multicolor'
              ? getMulticolorValue(this.document, x, y, frameIndex)
              : getHiresValue(this.document, x, y, frameIndex);
            return (
              <span
                key={`${x}:${y}`}
                style={{
                  background: value === 0 ? 'transparent' : this.pixelColor(value),
                  display: 'block',
                  height: `${pixelSize}px`,
                  width: `${pixelSize *
                    (this.document.colorMode === 'multicolor' ? 2 : 1)}px`
                }}
              />
            );
          })
        )}
      </div>
    );
  }

  protected renderByteRows(): React.ReactNode {
    return (
      <div style={panelStyle}>
        <div style={panelTitleStyle}>Bytes</div>
        <div style={byteRowsStyle}>
          {Array.from({ length: COMMODORE_SPRITE_GEOMETRY.height }, (_unused, row) => {
            const bytes = [0, 1, 2].map((byteColumn) =>
              `$${hexByte(getSpriteByte(this.document, row, byteColumn, this.selectedFrameIndex))}`
            );
            return (
              <div key={row} style={byteRowStyle}>
                <span style={byteRowIndexStyle}>{row.toString().padStart(2, '0')}</span>
                <span>{bytes.join(', ')}</span>
              </div>
            );
          })}
          <div style={byteRowStyle}>
            <span style={byteRowIndexStyle}>63</span>
            <span>${hexByte(spriteToBytes(this.document, this.selectedFrameIndex)[63] ?? 0)}</span>
          </div>
        </div>
      </div>
    );
  }

  protected machineLabel(): string {
    return COMMODORE_SPRITE_MACHINE_OPTIONS.find(
      (machine) => machine.id === this.document.metadata.machine
    )?.label ?? this.document.metadata.machine;
  }

  protected pixelColor(value: number): string {
    const colorIndex = this.document.colorMode === 'multicolor'
      ? [
          this.document.colors.background,
          this.document.colors.multicolor1,
          this.document.colors.foreground,
          this.document.colors.multicolor2
        ][value] ?? this.document.colors.background
      : value === 0
        ? this.document.colors.background
        : this.document.colors.foreground;
    return C64_COLOR_PALETTE[colorIndex]?.hex ?? '#000000';
  }
}

function getHiresValue(
  document: CommodoreSpriteDocument,
  x: number,
  y: number,
  frameIndex = 0
): number {
  const byteColumn = Math.floor(x / 8);
  return (getSpriteByte(document, y, byteColumn, frameIndex) & (1 << (7 - (x % 8))))
    ? 1
    : 0;
}

function getMulticolorValue(
  document: CommodoreSpriteDocument,
  pairIndex: number,
  y: number,
  frameIndex = 0
): number {
  const byteColumn = Math.floor(pairIndex / 4);
  return (getSpriteByte(document, y, byteColumn, frameIndex) >> ((3 - (pairIndex % 4)) * 2)) & 0x03;
}

function transformRows(
  bytes: number[],
  transform: (rowValue: number) => number
): number[] {
  const next = Array.from({ length: COMMODORE_SPRITE_GEOMETRY.slotBytes }, () => 0);
  next[63] = bytes[63] ?? 0;
  for (let row = 0; row < COMMODORE_SPRITE_GEOMETRY.height; row += 1) {
    writeRow(next, row, transform(rowValue(bytes, row)));
  }
  return next;
}

function rowValue(bytes: readonly number[], row: number): number {
  const start = row * COMMODORE_SPRITE_GEOMETRY.bytesPerRow;
  return ((bytes[start] ?? 0) << 16) |
    ((bytes[start + 1] ?? 0) << 8) |
    (bytes[start + 2] ?? 0);
}

function writeRow(bytes: number[], row: number, value: number): void {
  const start = row * COMMODORE_SPRITE_GEOMETRY.bytesPerRow;
  bytes[start] = (value >> 16) & 0xff;
  bytes[start + 1] = (value >> 8) & 0xff;
  bytes[start + 2] = value & 0xff;
}

function copyRow(
  source: readonly number[],
  sourceRow: number,
  target: number[],
  targetRow: number
): void {
  writeRow(target, targetRow, rowValue(source, sourceRow));
}

function reverse24Bits(value: number): number {
  let result = 0;
  for (let bit = 0; bit < 24; bit += 1) {
    result = (result << 1) | ((value >> bit) & 1);
  }
  return result;
}

function reverseMulticolorSpriteRow(value: number): number {
  let result = 0;
  for (let pair = 0; pair < 12; pair += 1) {
    result = (result << 2) | ((value >> (pair * 2)) & 0x03);
  }
  return result;
}

function hexByte(value: number): string {
  return (value & 0xff).toString(16).toUpperCase().padStart(2, '0');
}

function parseOptionalAddress(input: string): number | undefined {
  const value = input.trim();
  if (/^\$[0-9a-f]{1,4}$/iu.test(value)) {
    return Number.parseInt(value.slice(1), 16);
  }
  if (/^0x[0-9a-f]{1,4}$/iu.test(value)) {
    return Number.parseInt(value.slice(2), 16);
  }
  if (/^[0-9a-f]{1,4}$/iu.test(value)) {
    return Number.parseInt(value, 16);
  }
  if (/^\d{1,5}$/u.test(value)) {
    const parsed = Number.parseInt(value, 10);
    return parsed >= 0 && parsed <= 0xffff ? parsed : undefined;
  }
  return undefined;
}

function memoryReference(address: number): string {
  return `0x${(address & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`;
}

function formatAddress(address: number): string {
  return `$${(address & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`;
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

function toAssemblerLabel(value: string): string {
  const label = value
    .replace(/[^A-Za-z0-9_]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
  if (!label) {
    return 'SpriteData';
  }
  return /^[A-Za-z_]/u.test(label) ? label : `SpriteData_${label}`;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const thinPixelShadow = 'inset 0 0 0 0.5px rgba(127, 127, 127, 0.34)';

const rootStyle: React.CSSProperties = {
  background: 'var(--theia-editor-background)',
  color: 'var(--theia-editor-foreground)',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0
};

const loadingStyle: React.CSSProperties = {
  color: 'var(--theia-descriptionForeground)',
  padding: '16px'
};

const toolbarStyle: React.CSSProperties = {
  alignItems: 'center',
  background: 'var(--theia-editorWidget-background)',
  borderBottom: '1px solid var(--theia-editorGroup-border)',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  padding: '8px'
};

const bodyStyle: React.CSSProperties = {
  display: 'grid',
  flex: 1,
  gap: '12px',
  gridTemplateColumns: 'minmax(190px, 230px) minmax(560px, max-content) minmax(180px, 250px)',
  minHeight: 0,
  overflow: 'auto',
  padding: '12px'
};

const leftRailStyle: React.CSSProperties = {
  alignContent: 'start',
  display: 'grid',
  gap: '12px',
  minWidth: 0
};

const rightRailStyle: React.CSSProperties = {
  alignContent: 'start',
  display: 'grid',
  gap: '12px',
  minHeight: 0,
  minWidth: 0,
  overflow: 'auto'
};

const editorSectionStyle: React.CSSProperties = {
  minHeight: 0,
  overflow: 'auto'
};

const panelStyle: React.CSSProperties = {
  alignContent: 'start',
  display: 'grid',
  gap: '10px'
};

const panelTitleStyle: React.CSSProperties = {
  color: 'var(--theia-descriptionForeground)',
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase'
};

const panelTitleRowStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  justifyContent: 'space-between'
};

const panelDetailStyle: React.CSSProperties = {
  color: 'var(--theia-descriptionForeground)',
  fontSize: '11px',
  lineHeight: '15px'
};

const previewStageStyle: React.CSSProperties = {
  alignItems: 'center',
  border: '1px solid var(--theia-editorGroup-border)',
  display: 'inline-flex',
  justifyContent: 'center',
  minHeight: '148px',
  minWidth: '166px',
  padding: '10px',
  width: 'max-content'
};

const statsGridStyle: React.CSSProperties = {
  color: 'var(--theia-descriptionForeground)',
  display: 'grid',
  fontSize: '11px',
  gap: '4px',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
};

const frameStripStyle: React.CSSProperties = {
  display: 'grid',
  gap: '6px',
  gridTemplateColumns: 'repeat(auto-fill, minmax(42px, 1fr))',
  maxHeight: '178px',
  overflow: 'auto'
};

const frameButtonStyle: React.CSSProperties = {
  alignItems: 'center',
  background: 'var(--theia-editorWidget-background)',
  border: '1px solid var(--theia-editorGroup-border)',
  borderRadius: '2px',
  color: 'var(--theia-editor-foreground)',
  display: 'grid',
  gap: '3px',
  justifyItems: 'center',
  minHeight: '58px',
  padding: '4px'
};

const frameButtonLabelStyle: React.CSSProperties = {
  color: 'var(--theia-descriptionForeground)',
  fontSize: '10px',
  lineHeight: '10px'
};

const commandButtonStyle: React.CSSProperties = {
  alignItems: 'center',
  background: 'var(--theia-button-secondaryBackground)',
  border: '1px solid var(--theia-button-border, transparent)',
  borderRadius: '2px',
  color: 'var(--theia-button-secondaryForeground)',
  display: 'inline-flex',
  gap: '5px',
  minHeight: '28px',
  padding: '3px 9px'
};

const fieldLabelStyle: React.CSSProperties = {
  alignItems: 'center',
  color: 'var(--theia-descriptionForeground)',
  display: 'inline-flex',
  fontSize: '12px',
  gap: '6px'
};

const fieldLabelGridStyle: React.CSSProperties = {
  color: 'var(--theia-descriptionForeground)',
  display: 'grid',
  fontSize: '11px',
  gap: '4px'
};

const selectStyle: React.CSSProperties = {
  background: 'var(--theia-dropdown-background)',
  border: '1px solid var(--theia-dropdown-border)',
  color: 'var(--theia-dropdown-foreground)',
  minHeight: '28px'
};

const numberInputStyle: React.CSSProperties = {
  background: 'var(--theia-input-background)',
  border: '1px solid var(--theia-input-border, var(--theia-editorGroup-border))',
  color: 'var(--theia-input-foreground)',
  minHeight: '24px',
  minWidth: 0,
  padding: '2px 6px'
};

const rangeStyle: React.CSSProperties = {
  width: '92px'
};

const toolRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px'
};

const targetGridStyle: React.CSSProperties = {
  display: 'grid',
  gap: '8px',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
};

const machineNotesStyle: React.CSSProperties = {
  color: 'var(--theia-descriptionForeground)',
  display: 'grid',
  fontSize: '10px',
  gap: '3px',
  lineHeight: '14px'
};

const iconButtonStyle: React.CSSProperties = {
  alignItems: 'center',
  background: 'var(--theia-button-secondaryBackground)',
  border: '1px solid var(--theia-button-border, transparent)',
  borderRadius: '2px',
  color: 'var(--theia-button-secondaryForeground)',
  display: 'inline-flex',
  height: '30px',
  justifyContent: 'center',
  width: '30px'
};

const multicolorPaintToolsStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px'
};

const singleColorToolsStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '28px'
};

const singleColorChoiceStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'inline-grid',
  gap: '6px',
  gridTemplateColumns: 'max-content 42px',
  minHeight: '28px'
};

const multicolorPaintChoiceStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'inline-grid',
  gap: '5px',
  gridTemplateColumns: 'max-content 42px',
  minHeight: '28px'
};

const multicolorPaintSelectButtonStyle: React.CSSProperties = {
  alignItems: 'center',
  background: 'transparent',
  border: 0,
  color: 'var(--theia-editor-foreground)',
  display: 'inline-grid',
  gap: '5px',
  gridTemplateColumns: '14px max-content',
  minHeight: '28px',
  padding: 0
};

const multicolorPaintSwatchSlotStyle: React.CSSProperties = {
  display: 'inline-flex'
};

const paintRadioStyle: React.CSSProperties = {
  border: '1px solid var(--theia-editorGroup-border)',
  borderRadius: '50%',
  boxSizing: 'border-box',
  display: 'inline-block',
  height: '14px',
  width: '14px'
};

const paintChoiceTextStyle: React.CSSProperties = {
  display: 'grid',
  fontSize: '11px',
  lineHeight: '11px',
  textAlign: 'left'
};

const paintChoiceDetailStyle: React.CSSProperties = {
  color: 'var(--theia-descriptionForeground)',
  fontSize: '10px'
};

const colorButtonAnchorStyle: React.CSSProperties = {
  display: 'inline-flex',
  position: 'relative'
};

const paintChoiceSwatchButtonStyle: React.CSSProperties = {
  border: '1px solid var(--theia-editorGroup-border)',
  borderRadius: '2px',
  boxSizing: 'border-box',
  height: '18px',
  padding: 0,
  width: '42px'
};

const colorSelectorPopoverStyle: React.CSSProperties = {
  background: 'var(--theia-editorWidget-background)',
  border: '1px solid var(--theia-editorGroup-border)',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
  display: 'grid',
  gap: '4px',
  gridTemplateColumns: 'repeat(4, 22px)',
  padding: '6px',
  position: 'absolute',
  right: 0,
  top: 'calc(100% + 4px)',
  zIndex: 20
};

const colorSelectorBackdropStyle: React.CSSProperties = {
  background: 'transparent',
  bottom: 0,
  left: 0,
  position: 'fixed',
  right: 0,
  top: 0,
  zIndex: 19
};

const colorSelectorSwatchStyle: React.CSSProperties = {
  border: '2px solid var(--theia-editorGroup-border)',
  borderRadius: '2px',
  boxSizing: 'border-box',
  height: '22px',
  padding: 0,
  width: '22px'
};

const bitmapGridStyle: React.CSSProperties = {
  display: 'grid',
  gap: '1px'
};

const bitmapPixelStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 0,
  boxShadow: thinPixelShadow,
  padding: 0
};

const byteRowsStyle: React.CSSProperties = {
  display: 'grid',
  fontFamily: 'monospace',
  fontSize: '11px',
  gap: '2px'
};

const byteRowStyle: React.CSSProperties = {
  color: 'var(--theia-editor-foreground)',
  display: 'grid',
  gap: '8px',
  gridTemplateColumns: '24px 1fr',
  whiteSpace: 'nowrap'
};

const byteRowIndexStyle: React.CSSProperties = {
  color: 'var(--theia-descriptionForeground)',
  textAlign: 'right'
};
