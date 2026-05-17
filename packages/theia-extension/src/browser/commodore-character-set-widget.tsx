import * as React from 'react';

import {
  codicon,
  ReactWidget,
  Saveable,
  type SaveAsOptions
} from '@theia/core/lib/browser';
import { BinaryBuffer } from '@theia/core/lib/common/buffer';
import { Emitter } from '@theia/core/lib/common';
import URI from '@theia/core/lib/common/uri';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { FileDialogService } from '@theia/filesystem/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { MessageService } from '@theia/core/lib/common/message-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { DebugSession } from '@theia/debug/lib/browser/debug-session';
import { DebugSessionManager } from '@theia/debug/lib/browser/debug-session-manager';
import { inject, injectable } from '@theia/core/shared/inversify';

import {
  C64_COLOR_PALETTE,
  COMMODORE_CHARACTER_SET_FILE_EXTENSION,
  COMMODORE_RAW_CHARACTER_SET_FILE_EXTENSION,
  bytesToCharacterSetDocument,
  characterSetToBytes,
  createDefaultCharacterSetDocument,
  formatKickAssemblerCharacterSet,
  getGlyphByte,
  normalizeCharacterSetDocument,
  parseCharacterSetDocument,
  serializeCharacterSetDocument,
  setGlyphByte,
  setHiresPixel,
  setMulticolorPixel,
  transformGlyph,
  type CommodoreCharacterColorMode,
  type CommodoreCharacterSetColors,
  type CommodoreCharacterSetDocument,
  type CommodoreCharacterSetTarget
} from '../common/commodore-character-set-format';
import {
  formatAddress,
  parseOptionalAddress,
  readViceMemory,
  requireViceSession,
  resolveViceAddress,
  writeViceMemory
} from './commodore-vice-memory-transfer';

export const COMMODORE_CHARACTER_SET_WIDGET_FACTORY_ID =
  'commodore-commander.character-set-editor';

export interface CommodoreCharacterSetWidgetOptions {
  readonly uri: string;
}

type ColorRole = keyof CommodoreCharacterSetColors;
type CharacterSetViceTransferScope = 'glyph' | 'set';

const MULTICOLOR_PAINT_CHOICES: readonly {
  readonly value: number;
  readonly role: ColorRole;
  readonly label: string;
  readonly detail?: string;
}[] = [
  { value: 0, role: 'background', label: 'BG color', detail: '($D021)' },
  { value: 3, role: 'foreground', label: 'char color' },
  { value: 1, role: 'multicolor1', label: 'Multi 1', detail: '($D022)' },
  { value: 2, role: 'multicolor2', label: 'Multi 2', detail: '($D023)' }
];

const SINGLE_COLOR_CHOICES: readonly {
  readonly value: number;
  readonly role: ColorRole;
  readonly label: string;
  readonly detail?: string;
}[] = [
  { value: 0, role: 'background', label: 'BG color', detail: '($D021)' },
  { value: 1, role: 'foreground', label: 'char color' }
];

@injectable()
export class CommodoreCharacterSetWidget extends ReactWidget {
  @inject(FileService)
  protected readonly fileService!: FileService;

  @inject(FileDialogService)
  protected readonly fileDialogService!: FileDialogService;

  @inject(MessageService)
  protected readonly messageService!: MessageService;

  @inject(WorkspaceService)
  protected readonly workspaceService!: WorkspaceService;

  @inject(DebugSessionManager)
  protected readonly debugSessionManager!: DebugSessionManager;

  protected readonly dirtyChangedEmitter = new Emitter<void>();
  protected readonly contentChangedEmitter = new Emitter<void>();
  protected resourceUri: URI | undefined;
  protected document = createDefaultCharacterSetDocument();
  protected selectedGlyph = 0;
  protected paintValue = 3;
  protected openColorSelectorRole: ColorRole | undefined;
  protected characterDataAddressInput = '$2000';
  protected memoryTransferScope: CharacterSetViceTransferScope = 'set';
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
        'Commodore Commander Character Set': [
          COMMODORE_CHARACTER_SET_FILE_EXTENSION.slice(1)
        ]
      })
    };
  }

  async initialize(resourceUri: URI): Promise<void> {
    this.resourceUri = resourceUri;
    this.id = `${COMMODORE_CHARACTER_SET_WIDGET_FACTORY_ID}:${resourceUri.toString()}`;
    this.title.label = resourceUri.path.base;
    this.title.caption = resourceUri.toString();
    this.title.iconClass = codicon('symbol-color');
    this.title.closable = true;
    this.addClass('cc-character-set-editor');
    await this.load();
  }

  getResourceUri(): URI | undefined {
    return this.resourceUri;
  }

  createMoveToUri(resourceUri: URI): URI | undefined {
    return resourceUri;
  }

  override dispose(): void {
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
          parseCharacterSetDocument(content.value)
        );
      } else {
        this.document = this.withFilenameDerivedName(
          createDefaultCharacterSetDocument(this.resourceUri.path.name)
        );
        await this.writeDocument(this.resourceUri);
      }
      this.syncTargetInputsFromDocument();
      this.loaded = true;
      this.setDirty(false);
      this.update();
    } catch (error) {
      this.messageService.error(
        `Could not open character set: ${toErrorMessage(error)}`
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
    await this.fileService.write(uri, serializeCharacterSetDocument(this.document));
  }

  protected markChanged(document: CommodoreCharacterSetDocument): void {
    this.document = this.withFilenameDerivedName(
      normalizeCharacterSetDocument(document)
    );
    this.setDirty(true);
    this.contentChangedEmitter.fire();
    this.update();
  }

  protected withFilenameDerivedName(
    document: CommodoreCharacterSetDocument,
    uri = this.resourceUri
  ): CommodoreCharacterSetDocument {
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

  protected syncTargetInputsFromDocument(): void {
    this.syncTargetInputs(this.document.target);
  }

  protected syncTargetInputs(target: CommodoreCharacterSetTarget): void {
    this.characterDataAddressInput = formatAddress(target.characterDataAddress);
  }

  protected setTargetInput(value: string): void {
    this.characterDataAddressInput = value;
    this.update();
  }

  protected setTargetValue(value: number): void {
    const target = {
      ...this.document.target,
      characterDataAddress: value & 0xffff
    };
    this.syncTargetInputs(target);
    this.markChanged({
      ...this.document,
      target
    });
  }

  protected async readViceMemory(): Promise<void> {
    const session = requireViceSession(this.debugSessionManager, false);
    const target = await this.resolveTargetAddress(session);
    if (this.memoryTransferScope === 'glyph') {
      const address = selectedGlyphAddress(target, this.selectedGlyph);
      const bytes = await readViceMemory(
        session,
        address,
        this.document.geometry.bytesPerGlyph,
        { sideEffects: false }
      );
      this.viceStatus =
        `Read glyph $${hexByte(this.selectedGlyph)} from ${formatAddress(address)}.`;
      this.syncTargetInputs(target);
      this.markChanged({
        ...replaceGlyphBytes(this.document, this.selectedGlyph, bytes),
        target
      });
      return;
    }

    const bytes = await readViceMemory(
      session,
      target.characterDataAddress,
      CHARACTER_SET_BYTE_COUNT,
      { sideEffects: false }
    );
    const imported = bytesToCharacterSetDocument(
      bytes,
      this.document.metadata.name
    );
    this.viceStatus =
      `Read ${bytes.length} character byte(s) from ${formatAddress(target.characterDataAddress)}.`;
    this.syncTargetInputs(target);
    this.markChanged({
      ...imported,
      metadata: this.document.metadata,
      colorMode: this.document.colorMode,
      colors: this.document.colors,
      target
    });
  }

  protected async writeViceMemory(): Promise<void> {
    const session = requireViceSession(this.debugSessionManager, true);
    const target = await this.resolveTargetAddress(session);
    if (this.memoryTransferScope === 'glyph') {
      const address = selectedGlyphAddress(target, this.selectedGlyph);
      const bytes = selectedGlyphBytes(this.document, this.selectedGlyph);
      await writeViceMemory(
        session,
        address,
        bytes,
        { sideEffects: false }
      );
      this.viceStatus =
        `Wrote glyph $${hexByte(this.selectedGlyph)} to ${formatAddress(address)}.`;
      this.storeResolvedTarget(target);
      return;
    }

    const bytes = characterSetToBytes(this.document);
    await writeViceMemory(
      session,
      target.characterDataAddress,
      bytes,
      { sideEffects: false }
    );
    this.viceStatus =
      `Wrote ${bytes.length} character byte(s) to ${formatAddress(target.characterDataAddress)}.`;
    this.storeResolvedTarget(target);
  }

  protected async resolveTargetAddress(
    session: DebugSession
  ): Promise<CommodoreCharacterSetTarget> {
    return {
      characterDataAddress: await resolveViceAddress(
        session,
        this.characterDataAddressInput
      )
    };
  }

  protected storeResolvedTarget(target: CommodoreCharacterSetTarget): void {
    this.syncTargetInputs(target);
    if (
      target.characterDataAddress === this.document.target.characterDataAddress
    ) {
      this.update();
      return;
    }
    this.markChanged({
      ...this.document,
      target
    });
  }

  protected runViceAction(action: () => Promise<void>): void {
    void action().catch((error) => {
      this.viceStatus = error instanceof Error ? error.message : String(error);
      this.update();
    });
  }

  protected async exportRaw(): Promise<void> {
    const target = await this.pickExportTarget(
      'Export Character Set Bytes',
      COMMODORE_RAW_CHARACTER_SET_FILE_EXTENSION
    );
    if (!target) {
      return;
    }

    await this.fileService.writeFile(
      target,
      BinaryBuffer.wrap(characterSetToBytes(this.document))
    );
    this.messageService.info(`Exported ${target.path.base}.`);
  }

  protected async importRaw(): Promise<void> {
    const root = this.resourceUri
      ? await this.fileService.resolve(this.resourceUri.parent)
      : (await this.workspaceService.roots)[0];
    const source = await this.fileDialogService.showOpenDialog(
      {
        title: 'Import Raw Character Set',
        openLabel: 'Import',
        canSelectFiles: true,
        canSelectFolders: false,
        filters: {
          'Raw Character Sets': [
            COMMODORE_RAW_CHARACTER_SET_FILE_EXTENSION.slice(1),
            'bin',
            'chr'
          ]
        }
      },
      root
    );
    if (!source) {
      return;
    }

    const content = await this.fileService.readFile(source);
    const imported = bytesToCharacterSetDocument(content.value.buffer);
    this.markChanged({
      ...imported,
      metadata: this.document.metadata,
      colorMode: this.document.colorMode,
      colors: this.document.colors
    });
    this.messageService.info(`Imported ${source.path.base}.`);
  }

  protected async exportAssembler(): Promise<void> {
    const target = await this.pickExportTarget(
      'Export KickAssembler Character Set',
      '.asm'
    );
    if (!target) {
      return;
    }

    await this.fileService.write(
      target,
      formatKickAssemblerCharacterSet(
        this.withFilenameDerivedName(this.document),
        this.resourceUri?.path.name || 'CharacterSet'
      )
    );
    this.messageService.info(`Exported ${target.path.base}.`);
  }

  protected async pickExportTarget(
    title: string,
    extension: string
  ): Promise<URI | undefined> {
    const root = this.resourceUri
      ? await this.fileService.resolve(this.resourceUri.parent)
      : (await this.workspaceService.roots)[0];
    const baseName = this.resourceUri?.path.name || 'charset';
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

  protected selectGlyph(index: number): void {
    this.selectedGlyph = index;
    this.update();
  }

  protected setColorMode(colorMode: CommodoreCharacterColorMode): void {
    this.paintValue = colorMode === 'multicolor' ? 3 : 1;
    this.openColorSelectorRole = undefined;
    this.markChanged({
      ...this.document,
      colorMode
    });
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

  protected paintHiresPixel(x: number, y: number, enabled?: boolean): void {
    const nextEnabled = enabled ?? getHiresValue(
      this.document,
      this.selectedGlyph,
      x,
      y
    ) === 0;
    this.markChanged(
      setHiresPixel(
        this.document,
        this.selectedGlyph,
        x,
        y,
        nextEnabled
      )
    );
  }

  protected paintMulticolorPixel(x: number, y: number): void {
    this.markChanged(
      setMulticolorPixel(
        this.document,
        this.selectedGlyph,
        x,
        y,
        this.paintValue
      )
    );
  }

  protected clearSelectedGlyph(): void {
    let next = this.document;
    for (let row = 0; row < 8; row += 1) {
      next = setGlyphByte(next, this.selectedGlyph, row, 0);
    }
    this.markChanged(next);
  }

  protected invertSelectedGlyph(): void {
    this.markChanged(
      transformGlyph(
        this.document,
        this.selectedGlyph,
        (bytes) => bytes.map((byte) => byte ^ 0xff)
      )
    );
  }

  protected flipSelectedGlyphHorizontally(): void {
    this.markChanged(
      transformGlyph(
        this.document,
        this.selectedGlyph,
        (bytes) => bytes.map((byte) =>
          this.document.colorMode === 'multicolor'
            ? reverseMulticolorPairs(byte)
            : reverseBits(byte)
        )
      )
    );
  }

  protected flipSelectedGlyphVertically(): void {
    this.markChanged(
      transformGlyph(
        this.document,
        this.selectedGlyph,
        (bytes) => [...bytes].reverse()
      )
    );
  }

  protected shiftSelectedGlyph(dx: number, dy: number): void {
    const rows = Array.from({ length: 8 }, (_, row) =>
      getGlyphByte(this.document, this.selectedGlyph, row)
    );
    const shifted = rows.map((_row, y) => {
      const sourceY = y - dy;
      if (sourceY < 0 || sourceY >= 8) {
        return 0;
      }
      if (dx === 0) {
        return rows[sourceY];
      }
      return dx < 0
        ? (rows[sourceY] << Math.abs(dx)) & 0xff
        : rows[sourceY] >> dx;
    });
    this.markChanged(
      transformGlyph(this.document, this.selectedGlyph, () => shifted)
    );
  }

  protected render(): React.ReactNode {
    if (!this.loaded) {
      return (
        <div style={rootStyle}>
          <div style={loadingStyle}>Loading character set...</div>
        </div>
      );
    }

    return (
      <div style={rootStyle}>
        {this.renderToolbar()}
        <div style={bodyStyle}>
          <section style={tableSectionStyle}>
            {this.renderCharacterTable()}
          </section>
          <section style={editorSectionStyle}>
            <div style={sidePanelStackStyle}>
              {this.renderInspector()}
              {this.renderTargetPanel()}
              {this.renderVicePanel()}
            </div>
            {this.renderBitmapEditor()}
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
          <span className={codicon('folder-opened')} /> Import .64C
        </button>
        <button style={commandButtonStyle} onClick={() => void this.exportRaw()}>
          <span className={codicon('file-binary')} /> .64C
        </button>
        <button
          style={commandButtonStyle}
          onClick={() => void this.exportAssembler()}
        >
          <span className={codicon('file-code')} /> ASM
        </button>
        <label style={fieldLabelStyle}>
          Mode
          <select
            value={this.document.colorMode}
            onChange={(event) =>
              this.setColorMode(event.currentTarget.value as CommodoreCharacterColorMode)
            }
            style={selectStyle}
          >
            <option value='hires'>Single color</option>
            <option value='multicolor'>Multi-color</option>
          </select>
        </label>
        {this.document.colorMode === 'multicolor'
          ? this.renderMulticolorPaintTools()
          : this.renderSingleColorTools()}
      </div>
    );
  }

  protected renderCharacterTable(): React.ReactNode {
    return (
      <div
        style={{
          ...characterTableStyle,
          background: 'var(--theia-editor-background)'
        }}
      >
        {this.document.glyphs.map((_glyph, index) => {
          const selected = index === this.selectedGlyph;
          return (
            <button
              key={index}
              title={`$${hexByte(index)} / ${index}`}
              onClick={() => this.selectGlyph(index)}
              style={{
                ...glyphButtonStyle,
                boxShadow: selected ? glyphSelectedShadow : undefined,
                outline: 'none'
              }}
            >
              {this.renderGlyphPreview(index, 3)}
            </button>
          );
        })}
      </div>
    );
  }

  protected renderInspector(): React.ReactNode {
    return (
      <div style={inspectorStyle}>
        <div style={selectedIndexStyle}>
          ${hexByte(this.selectedGlyph)}
          <span style={selectedIndexDetailStyle}>{this.selectedGlyph}</span>
        </div>
        <div style={toolRowStyle}>
          <button
            title='Flip horizontally'
            style={iconButtonStyle}
            onClick={() => this.flipSelectedGlyphHorizontally()}
          >
            <span className={codicon('split-horizontal')} />
          </button>
          <button
            title='Flip vertically'
            style={iconButtonStyle}
            onClick={() => this.flipSelectedGlyphVertically()}
          >
            <span className={codicon('split-vertical')} />
          </button>
          <button
            title='Invert'
            style={iconButtonStyle}
            onClick={() => this.invertSelectedGlyph()}
          >
            <span className={codicon('color-mode')} />
          </button>
          <button
            title='Clear'
            style={iconButtonStyle}
            onClick={() => this.clearSelectedGlyph()}
          >
            <span className={codicon('clear-all')} />
          </button>
        </div>
        <div style={toolRowStyle}>
          <button
            title='Shift left'
            style={iconButtonStyle}
            onClick={() => this.shiftSelectedGlyph(-1, 0)}
          >
            <span className={codicon('arrow-left')} />
          </button>
          <button
            title='Shift right'
            style={iconButtonStyle}
            onClick={() => this.shiftSelectedGlyph(1, 0)}
          >
            <span className={codicon('arrow-right')} />
          </button>
          <button
            title='Shift up'
            style={iconButtonStyle}
            onClick={() => this.shiftSelectedGlyph(0, -1)}
          >
            <span className={codicon('arrow-up')} />
          </button>
          <button
            title='Shift down'
            style={iconButtonStyle}
            onClick={() => this.shiftSelectedGlyph(0, 1)}
          >
            <span className={codicon('arrow-down')} />
          </button>
        </div>
      </div>
    );
  }

  protected renderTargetPanel(): React.ReactNode {
    return (
      <div style={panelStyle}>
        <div style={panelTitleStyle}>Target</div>
        <label style={fieldLabelGridStyle}>
          Character data
          <input
            onBlur={(event) => {
              const address = parseOptionalAddress(event.currentTarget.value);
              if (address !== undefined) {
                this.setTargetValue(address);
              }
            }}
            onChange={(event) => this.setTargetInput(event.currentTarget.value)}
            style={numberInputStyle}
            value={this.characterDataAddressInput}
          />
        </label>
      </div>
    );
  }

  protected renderVicePanel(): React.ReactNode {
    return (
      <div style={panelStyle}>
        <div style={panelTitleStyle}>VICE</div>
        <label style={fieldLabelGridStyle}>
          Scope
          <select
            onChange={(event) => {
              this.memoryTransferScope = event.currentTarget.value as CharacterSetViceTransferScope;
              this.update();
            }}
            style={selectStyle}
            value={this.memoryTransferScope}
          >
            <option value='glyph'>Selected glyph</option>
            <option value='set'>Full character set</option>
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
    const columns = this.document.colorMode === 'multicolor' ? 4 : 8;
    return (
      <div
        style={{
          ...bitmapGridStyle,
          gridTemplateColumns: `repeat(${columns}, minmax(28px, 42px))`
        }}
      >
        {Array.from({ length: 8 }, (_, y) =>
          Array.from({ length: columns }, (_unused, x) => {
            const value = this.document.colorMode === 'multicolor'
              ? getMulticolorValue(this.document, this.selectedGlyph, x, y)
              : getHiresValue(this.document, this.selectedGlyph, x, y);
            return (
              <button
                key={`${x}:${y}`}
                title={`${x},${y}`}
                onClick={() => {
                  if (this.document.colorMode === 'multicolor') {
                    this.paintMulticolorPixel(x, y);
                  } else {
                    this.paintHiresPixel(x, y);
                  }
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  const oldPaintValue = this.paintValue;
                  this.paintValue = 0;
                  if (this.document.colorMode === 'multicolor') {
                    this.paintMulticolorPixel(x, y);
                  } else {
                    this.paintHiresPixel(x, y, false);
                  }
                  this.paintValue = oldPaintValue;
                }}
                style={{
                  ...bitmapPixelStyle,
                  aspectRatio: this.document.colorMode === 'multicolor'
                    ? '2 / 1'
                    : '1 / 1',
                  background: this.pixelColor(value)
                }}
              />
            );
          })
        )}
      </div>
    );
  }

  protected renderGlyphPreview(
    glyphIndex: number,
    pixelSize: number
  ): React.ReactNode {
    const columns = this.document.colorMode === 'multicolor' ? 4 : 8;
    return (
      <div
        style={{
          display: 'grid',
          gap: 0,
          gridTemplateColumns: `repeat(${columns}, ${pixelSize *
            (this.document.colorMode === 'multicolor' ? 2 : 1)}px)`
        }}
      >
        {Array.from({ length: 8 }, (_, y) =>
          Array.from({ length: columns }, (_unused, x) => {
            const value = this.document.colorMode === 'multicolor'
              ? getMulticolorValue(this.document, glyphIndex, x, y)
              : getHiresValue(this.document, glyphIndex, x, y);
            return (
              <span
                key={`${x}:${y}`}
                style={{
                  background: this.pixelColor(value),
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

  protected pixelColor(value: number): string {
    const colorIndex = this.document.colorMode === 'multicolor'
      ? [
          this.document.colors.background,
          this.document.colors.multicolor1,
          this.document.colors.multicolor2,
          this.document.colors.foreground
        ][value] ?? this.document.colors.background
      : value === 0
        ? this.document.colors.background
        : this.document.colors.foreground;
    return C64_COLOR_PALETTE[colorIndex]?.hex ?? '#000000';
  }
}

function selectedGlyphAddress(
  target: CommodoreCharacterSetTarget,
  selectedGlyph: number
): number {
  return (
    target.characterDataAddress +
    (selectedGlyph & 0xff) * COMMODORE_CHARACTER_SET_BYTES_PER_GLYPH
  ) & 0xffff;
}

function selectedGlyphBytes(
  document: CommodoreCharacterSetDocument,
  selectedGlyph: number
): Uint8Array {
  return Uint8Array.from(
    { length: document.geometry.bytesPerGlyph },
    (_unused, row) => getGlyphByte(document, selectedGlyph, row)
  );
}

function replaceGlyphBytes(
  document: CommodoreCharacterSetDocument,
  selectedGlyph: number,
  bytes: Uint8Array
): CommodoreCharacterSetDocument {
  let next = document;
  for (let row = 0; row < document.geometry.bytesPerGlyph; row += 1) {
    next = setGlyphByte(next, selectedGlyph, row, bytes[row] ?? 0);
  }
  return next;
}

function getHiresValue(
  document: CommodoreCharacterSetDocument,
  glyphIndex: number,
  x: number,
  y: number
): number {
  return (getGlyphByte(document, glyphIndex, y) & (1 << (7 - x))) ? 1 : 0;
}

function getMulticolorValue(
  document: CommodoreCharacterSetDocument,
  glyphIndex: number,
  x: number,
  y: number
): number {
  return (getGlyphByte(document, glyphIndex, y) >> ((3 - x) * 2)) & 0x03;
}

function reverseBits(value: number): number {
  let result = 0;
  for (let bit = 0; bit < 8; bit += 1) {
    result = (result << 1) | ((value >> bit) & 1);
  }
  return result;
}

function reverseMulticolorPairs(value: number): number {
  return ((value & 0x03) << 6) |
    ((value & 0x0c) << 2) |
    ((value & 0x30) >> 2) |
    ((value & 0xc0) >> 6);
}

function hexByte(value: number): string {
  return (value & 0xff).toString(16).toUpperCase().padStart(2, '0');
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const thinPixelShadow = 'inset 0 0 0 0.5px rgba(127, 127, 127, 0.28)';
const glyphSelectedShadow =
  '0 0 0 1px var(--theia-focusBorder), inset 0 0 0 0.5px var(--theia-focusBorder)';
const COMMODORE_CHARACTER_SET_BYTES_PER_GLYPH = 8;
const CHARACTER_SET_BYTE_COUNT = 2048;

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
  gridTemplateColumns: 'minmax(280px, 460px) minmax(300px, 1fr)',
  minHeight: 0,
  overflow: 'hidden',
  padding: '12px'
};

const tableSectionStyle: React.CSSProperties = {
  minHeight: 0,
  overflow: 'auto'
};

const editorSectionStyle: React.CSSProperties = {
  alignContent: 'start',
  display: 'grid',
  gap: '12px',
  gridTemplateColumns: 'minmax(150px, 190px) minmax(260px, max-content)',
  minHeight: 0,
  overflow: 'auto'
};

const sidePanelStackStyle: React.CSSProperties = {
  alignContent: 'start',
  display: 'grid',
  gap: '12px'
};

const characterTableStyle: React.CSSProperties = {
  display: 'grid',
  gap: '1px',
  gridTemplateColumns: 'repeat(16, 24px)',
  width: 'max-content'
};

const glyphButtonStyle: React.CSSProperties = {
  alignItems: 'center',
  background: 'transparent',
  border: 0,
  borderRadius: 0,
  display: 'flex',
  height: '24px',
  justifyContent: 'center',
  padding: 0,
  width: '24px'
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

const fieldLabelGridStyle: React.CSSProperties = {
  color: 'var(--theia-descriptionForeground)',
  display: 'grid',
  fontSize: '11px',
  gap: '4px'
};

const panelStyle: React.CSSProperties = {
  alignContent: 'start',
  border: '1px solid var(--theia-editorGroup-border)',
  display: 'grid',
  gap: '10px',
  padding: '10px'
};

const panelTitleStyle: React.CSSProperties = {
  color: 'var(--theia-descriptionForeground)',
  fontSize: '12px',
  textTransform: 'uppercase'
};

const panelDetailStyle: React.CSSProperties = {
  color: 'var(--theia-descriptionForeground)',
  fontSize: '11px',
  lineHeight: '15px'
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

const inspectorStyle: React.CSSProperties = {
  alignContent: 'start',
  display: 'grid',
  gap: '10px'
};

const selectedIndexStyle: React.CSSProperties = {
  color: 'var(--theia-editor-foreground)',
  fontFamily: 'monospace',
  fontSize: '24px',
  fontWeight: 700
};

const selectedIndexDetailStyle: React.CSSProperties = {
  color: 'var(--theia-descriptionForeground)',
  fontSize: '12px',
  fontWeight: 400,
  marginLeft: '8px'
};

const toolRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px'
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

const bitmapGridStyle: React.CSSProperties = {
  display: 'grid',
  gap: '1px'
};

const bitmapPixelStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 0,
  boxShadow: thinPixelShadow,
  minHeight: '28px',
  minWidth: '28px',
  padding: 0
};
