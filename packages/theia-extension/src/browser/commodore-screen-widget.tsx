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
import { inject, injectable } from '@theia/core/shared/inversify';

import {
  C64_COLOR_PALETTE,
  COMMODORE_CHARACTER_SET_FILE_EXTENSION,
  parseCharacterSetDocument
} from '../common/commodore-character-set-format';
import {
  COMMODORE_RAW_COLOR_FILE_EXTENSION,
  COMMODORE_RAW_SCREEN_FILE_EXTENSION,
  COMMODORE_SEQ_SCREEN_FILE_EXTENSION,
  COMMODORE_SCREEN_FILE_EXTENSION,
  applyScreenCodeSequence,
  createDefaultScreenDocument,
  fillScreen,
  formatKickAssemblerScreen,
  getScreenCell,
  getScreenGlyphByte,
  normalizeScreenDocument,
  parseScreenDocument,
  replaceScreenCharacterSet,
  screenToCharacterBytes,
  screenToColorBytes,
  serializeScreenDocument,
  setScreenCell,
  setScreenGlyphByte,
  setScreenHiresPixel,
  setScreenMulticolorPixel,
  transformScreenGlyph,
  type CommodoreScreenColorMode,
  type CommodoreScreenColors,
  type CommodoreScreenDocument
} from '../common/commodore-screen-format';

export const COMMODORE_SCREEN_WIDGET_FACTORY_ID =
  'commodore-commander.screen-editor';

export interface CommodoreScreenWidgetOptions {
  readonly uri: string;
}

type ScreenColorRole = keyof CommodoreScreenColors;
type ColorSelectorId = ScreenColorRole | 'paint';

const GLOBAL_COLOR_CHOICES: readonly {
  readonly role: ScreenColorRole;
  readonly label: string;
  readonly detail?: string;
}[] = [
  { role: 'border', label: 'border', detail: '$D020' },
  { role: 'background', label: 'backgr.', detail: '$D021' },
  { role: 'multicolor1', label: 'multi 1', detail: '$D022' },
  { role: 'multicolor2', label: 'multi 2', detail: '$D023' }
];

@injectable()
export class CommodoreScreenWidget extends ReactWidget {
  @inject(FileService)
  protected readonly fileService!: FileService;

  @inject(FileDialogService)
  protected readonly fileDialogService!: FileDialogService;

  @inject(MessageService)
  protected readonly messageService!: MessageService;

  @inject(WorkspaceService)
  protected readonly workspaceService!: WorkspaceService;

  protected readonly dirtyChangedEmitter = new Emitter<void>();
  protected readonly contentChangedEmitter = new Emitter<void>();
  protected resourceUri: URI | undefined;
  protected document = createDefaultScreenDocument();
  protected selectedCharacter = 32;
  protected selectedColor = this.document.colors.foreground;
  protected glyphPaintValue = 1;
  protected cursorColumn = 0;
  protected cursorRow = 0;
  protected openColorSelector: ColorSelectorId | undefined;
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
        'Commodore Commander Screen': [
          COMMODORE_SCREEN_FILE_EXTENSION.slice(1)
        ]
      })
    };
  }

  async initialize(resourceUri: URI): Promise<void> {
    this.resourceUri = resourceUri;
    this.id = `${COMMODORE_SCREEN_WIDGET_FACTORY_ID}:${resourceUri.toString()}`;
    this.title.label = resourceUri.path.base;
    this.title.caption = resourceUri.toString();
    this.title.iconClass = codicon('layout');
    this.title.closable = true;
    this.addClass('cc-screen-editor');
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
          parseScreenDocument(content.value)
        );
      } else {
        this.document = this.withFilenameDerivedName(
          createDefaultScreenDocument(this.resourceUri.path.name)
        );
        await this.writeDocument(this.resourceUri);
      }
      this.selectedColor = this.document.colors.foreground;
      this.glyphPaintValue = this.document.colorMode === 'multicolor' ? 3 : 1;
      this.loaded = true;
      this.setDirty(false);
      this.update();
    } catch (error) {
      this.messageService.error(
        `Could not open screen: ${toErrorMessage(error)}`
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
    await this.fileService.write(uri, serializeScreenDocument(this.document));
  }

  protected markChanged(document: CommodoreScreenDocument): void {
    this.document = this.withFilenameDerivedName(
      normalizeScreenDocument(document)
    );
    this.cursorColumn = Math.min(
      this.cursorColumn,
      this.document.geometry.columns - 1
    );
    this.cursorRow = Math.min(this.cursorRow, this.document.geometry.rows - 1);
    this.setDirty(true);
    this.contentChangedEmitter.fire();
    this.update();
  }

  protected withFilenameDerivedName(
    document: CommodoreScreenDocument,
    uri = this.resourceUri
  ): CommodoreScreenDocument {
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

  protected async importCharacterSet(): Promise<void> {
    const root = this.resourceUri
      ? await this.fileService.resolve(this.resourceUri.parent)
      : (await this.workspaceService.roots)[0];
    const source = await this.fileDialogService.showOpenDialog(
      {
        title: 'Use Character Set',
        openLabel: 'Use',
        canSelectFiles: true,
        canSelectFolders: false,
        filters: {
          'Commodore Commander Character Set': [
            COMMODORE_CHARACTER_SET_FILE_EXTENSION.slice(1)
          ]
        }
      },
      root
    );
    if (!source) {
      return;
    }

    const content = await this.fileService.read(source, {
      acceptTextOnly: true
    });
    const characterSet = parseCharacterSetDocument(content.value);
    this.selectedColor = characterSet.colors.foreground;
    this.glyphPaintValue = characterSet.colorMode === 'multicolor' ? 3 : 1;
    this.markChanged(replaceScreenCharacterSet(this.document, characterSet));
    this.messageService.info(`Using ${source.path.base}.`);
  }

  protected async importSeq(): Promise<void> {
    const root = this.resourceUri
      ? await this.fileService.resolve(this.resourceUri.parent)
      : (await this.workspaceService.roots)[0];
    const source = await this.fileDialogService.showOpenDialog(
      {
        title: 'Import SEQ Screen Codes',
        openLabel: 'Import',
        canSelectFiles: true,
        canSelectFolders: false,
        filters: {
          'SEQ Screen Code Files': [
            COMMODORE_SEQ_SCREEN_FILE_EXTENSION.slice(1)
          ]
        }
      },
      root
    );
    if (!source) {
      return;
    }

    const content = await this.fileService.readFile(source);
    const bytes = content.value.buffer;
    this.markChanged(applyScreenCodeSequence(this.document, bytes));
    this.messageService.info(
      `Imported ${Math.min(bytes.length, this.document.cells.length)} screen codes from ${source.path.base}.`
    );
  }

  protected async exportScreenBytes(): Promise<void> {
    const target = await this.pickExportTarget(
      'Export Screen Codes',
      COMMODORE_RAW_SCREEN_FILE_EXTENSION
    );
    if (!target) {
      return;
    }

    await this.fileService.writeFile(
      target,
      BinaryBuffer.wrap(screenToCharacterBytes(this.document))
    );
    this.messageService.info(`Exported ${target.path.base}.`);
  }

  protected async exportColorBytes(): Promise<void> {
    const target = await this.pickExportTarget(
      'Export Color RAM',
      COMMODORE_RAW_COLOR_FILE_EXTENSION
    );
    if (!target) {
      return;
    }

    await this.fileService.writeFile(
      target,
      BinaryBuffer.wrap(screenToColorBytes(this.document))
    );
    this.messageService.info(`Exported ${target.path.base}.`);
  }

  protected async exportAssembler(): Promise<void> {
    const target = await this.pickExportTarget(
      'Export KickAssembler Screen',
      '.asm'
    );
    if (!target) {
      return;
    }

    await this.fileService.write(
      target,
      formatKickAssemblerScreen(
        this.withFilenameDerivedName(this.document),
        this.resourceUri?.path.name || 'Screen'
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
    const baseName = this.resourceUri?.path.name || 'screen';
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

  protected selectCharacter(character: number): void {
    this.selectedCharacter = character & 0xff;
    this.openColorSelector = undefined;
    this.update();
  }

  protected setColorMode(colorMode: CommodoreScreenColorMode): void {
    this.openColorSelector = undefined;
    this.glyphPaintValue = colorMode === 'multicolor' ? 3 : 1;
    this.markChanged({
      ...this.document,
      colorMode
    });
  }

  protected setGlyphPaintValue(value: number): void {
    this.glyphPaintValue = value & 0x03;
    this.openColorSelector = undefined;
    this.update();
  }

  protected setGlobalColor(role: ScreenColorRole, index: number): void {
    this.openColorSelector = undefined;
    this.markChanged({
      ...this.document,
      colors: {
        ...this.document.colors,
        [role]: index
      }
    });
  }

  protected setSelectedColor(index: number): void {
    this.selectedColor = index & 0x0f;
    this.openColorSelector = undefined;
    this.update();
  }

  protected toggleColorSelector(selector: ColorSelectorId): void {
    this.openColorSelector = this.openColorSelector === selector
      ? undefined
      : selector;
    this.update();
  }

  protected closeColorSelector(): void {
    if (!this.openColorSelector) {
      return;
    }
    this.openColorSelector = undefined;
    this.update();
  }

  protected paintCell(column: number, row: number): void {
    this.cursorColumn = column;
    this.cursorRow = row;
    this.markChanged(
      setScreenCell(this.withSelectedColor(this.document), column, row, {
        character: this.selectedCharacter,
        color: this.selectedColor
      })
    );
  }

  protected pickCell(column: number, row: number): void {
    const cell = getScreenCell(this.document, column, row);
    if (!cell) {
      return;
    }
    this.cursorColumn = column;
    this.cursorRow = row;
    this.selectedCharacter = cell.character;
    this.selectedColor = cell.color;
    this.openColorSelector = undefined;
    this.update();
  }

  protected clearCell(column = this.cursorColumn, row = this.cursorRow): void {
    this.cursorColumn = column;
    this.cursorRow = row;
    this.markChanged(
      setScreenCell(this.withSelectedColor(this.document), column, row, {
        character: 32,
        color: this.selectedColor
      })
    );
  }

  protected typeCharacter(character: number): void {
    this.selectedCharacter = character & 0xff;
    this.paintCell(this.cursorColumn, this.cursorRow);
    this.moveCursor(1, 0, true);
  }

  protected moveCursor(
    deltaColumn: number,
    deltaRow: number,
    wrap = false
  ): void {
    const { columns, rows } = this.document.geometry;
    let column = this.cursorColumn + deltaColumn;
    let row = this.cursorRow + deltaRow;
    if (wrap) {
      while (column >= columns) {
        column -= columns;
        row += 1;
      }
      while (column < 0) {
        column += columns;
        row -= 1;
      }
    }
    this.cursorColumn = Math.max(0, Math.min(columns - 1, column));
    this.cursorRow = Math.max(0, Math.min(rows - 1, row));
    this.update();
  }

  protected fillWithSelection(): void {
    this.markChanged(
      fillScreen(this.withSelectedColor(this.document), {
        character: this.selectedCharacter,
        color: this.selectedColor
      })
    );
  }

  protected clearScreen(): void {
    this.markChanged(
      fillScreen(this.withSelectedColor(this.document), {
        character: 32,
        color: this.selectedColor
      })
    );
  }

  protected paintHiresGlyphPixel(x: number, y: number): void {
    this.markChanged(
      setScreenHiresPixel(
        this.document,
        this.selectedCharacter,
        x,
        y,
        this.glyphPaintValue !== 0
      )
    );
  }

  protected paintMulticolorGlyphPixel(x: number, y: number): void {
    this.markChanged(
      setScreenMulticolorPixel(
        this.document,
        this.selectedCharacter,
        x,
        y,
        this.glyphPaintValue
      )
    );
  }

  protected clearSelectedGlyph(): void {
    let next = this.document;
    for (let row = 0; row < 8; row += 1) {
      next = setScreenGlyphByte(next, this.selectedCharacter, row, 0);
    }
    this.markChanged(next);
  }

  protected invertSelectedGlyph(): void {
    this.markChanged(
      transformScreenGlyph(
        this.document,
        this.selectedCharacter,
        (bytes) => bytes.map((byte) => byte ^ 0xff)
      )
    );
  }

  protected flipSelectedGlyphHorizontally(): void {
    this.markChanged(
      transformScreenGlyph(
        this.document,
        this.selectedCharacter,
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
      transformScreenGlyph(
        this.document,
        this.selectedCharacter,
        (bytes) => [...bytes].reverse()
      )
    );
  }

  protected shiftSelectedGlyph(dx: number, dy: number): void {
    const rows = Array.from({ length: 8 }, (_, row) =>
      getScreenGlyphByte(this.document, this.selectedCharacter, row)
    );
    const bitShift = Math.abs(dx) * (
      this.document.colorMode === 'multicolor' ? 2 : 1
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
        ? (rows[sourceY] << bitShift) & 0xff
        : rows[sourceY] >> bitShift;
    });
    this.markChanged(
      transformScreenGlyph(this.document, this.selectedCharacter, () => shifted)
    );
  }

  protected withSelectedColor(
    document: CommodoreScreenDocument
  ): CommodoreScreenDocument {
    return {
      ...document,
      colors: {
        ...document.colors,
        foreground: this.selectedColor
      }
    };
  }

  protected render(): React.ReactNode {
    if (!this.loaded) {
      return (
        <div style={rootStyle}>
          <div style={loadingStyle}>Loading screen...</div>
        </div>
      );
    }

    return (
      <div style={rootStyle}>
        {this.renderToolbar()}
        <div style={bodyStyle}>
          <section style={screenSectionStyle}>
            {this.renderScreenPanel()}
          </section>
          <section style={toolsSectionStyle}>
            {this.renderInspector()}
            {this.renderBitmapEditor()}
            {this.renderCharacterTable()}
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
          onClick={() => void this.importCharacterSet()}
        >
          <span className={codicon('symbol-color')} /> Use .charset
        </button>
        <button
          style={commandButtonStyle}
          onClick={() => void this.importSeq()}
        >
          <span className={codicon('folder-opened')} /> Import .SEQ
        </button>
        <button
          style={commandButtonStyle}
          onClick={() => void this.exportScreenBytes()}
        >
          <span className={codicon('file-binary')} /> .SCR
        </button>
        <button
          style={commandButtonStyle}
          onClick={() => void this.exportColorBytes()}
        >
          <span className={codicon('symbol-color')} /> .COL
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
              this.setColorMode(event.currentTarget.value as CommodoreScreenColorMode)
            }
            style={selectStyle}
          >
            <option value='hires'>Single color</option>
            <option value='multicolor'>Multi-color</option>
          </select>
        </label>
      </div>
    );
  }

  protected renderScreenPanel(): React.ReactNode {
    return (
      <div style={screenPanelStyle}>
        <div style={screenStatusStyle}>
          <span>{this.document.geometry.columns} x {this.document.geometry.rows}</span>
          <span>row {this.cursorRow + 1}, col {this.cursorColumn + 1}</span>
          <span>char ${hexByte(this.selectedCharacter)}</span>
          <span>color {this.selectedColor}</span>
        </div>
        <ScreenCanvas
          cursorColumn={this.cursorColumn}
          cursorRow={this.cursorRow}
          document={this.document}
          onClearCell={(column, row) => this.clearCell(column, row)}
          onMoveCursor={(deltaColumn, deltaRow) =>
            this.moveCursor(deltaColumn, deltaRow)
          }
          onPaintCell={(column, row) => this.paintCell(column, row)}
          onPickCell={(column, row) => this.pickCell(column, row)}
          onTypeCharacter={(character) => this.typeCharacter(character)}
        />
      </div>
    );
  }

  protected renderInspector(): React.ReactNode {
    const cell = getScreenCell(this.document, this.cursorColumn, this.cursorRow);
    return (
      <div style={inspectorStyle}>
        <div style={selectedIndexStyle}>
          ${hexByte(this.selectedCharacter)}
          <span style={selectedIndexDetailStyle}>
            {this.selectedCharacter}
          </span>
        </div>
        <div style={smallDetailStyle}>
          Cell ${hexByte(cell?.character ?? 32)} / color {cell?.color ?? 0}
        </div>
        <div style={toolRowStyle}>
          <button
            title='Fill screen with selected character'
            style={iconButtonStyle}
            onClick={() => this.fillWithSelection()}
          >
            <span className={codicon('color-mode')} />
          </button>
          <button
            title='Clear screen'
            style={iconButtonStyle}
            onClick={() => this.clearScreen()}
          >
            <span className={codicon('clear-all')} />
          </button>
        </div>
        <div style={colorToolsStyle}>
          <div style={colorChoiceStyle}>
            <span style={paintChoiceTextStyle}>char color</span>
            {this.renderPaintColorButton()}
          </div>
          {GLOBAL_COLOR_CHOICES.map((choice) => (
            <div key={choice.role} style={colorChoiceStyle}>
              <span style={paintChoiceTextStyle}>
                {choice.label}
                {choice.detail && (
                  <span style={paintChoiceDetailStyle}>{choice.detail}</span>
                )}
              </span>
              {this.renderGlobalColorButton(choice.role, choice.label)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  protected renderPaintColorButton(): React.ReactNode {
    const color = C64_COLOR_PALETTE[this.selectedColor];
    return (
      <div style={colorButtonAnchorStyle}>
        <button
          type='button'
          title={`Choose paint color${color ? `: ${color.name}` : ''}`}
          aria-label='Choose paint color'
          onClick={() => this.toggleColorSelector('paint')}
          style={{
            ...paintChoiceSwatchButtonStyle,
            background: color?.hex ?? '#000000'
          }}
        />
        {this.openColorSelector === 'paint' && (
          <>
            <div
              style={colorSelectorBackdropStyle}
              onClick={() => this.closeColorSelector()}
            />
            {this.renderColorSelector(this.selectedColor, index =>
              this.setSelectedColor(index)
            )}
          </>
        )}
      </div>
    );
  }

  protected renderGlobalColorButton(
    role: ScreenColorRole,
    label: string
  ): React.ReactNode {
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
        {this.openColorSelector === role && (
          <>
            <div
              style={colorSelectorBackdropStyle}
              onClick={() => this.closeColorSelector()}
            />
            {this.renderColorSelector(colorIndex, index =>
              this.setGlobalColor(role, index)
            )}
          </>
        )}
      </div>
    );
  }

  protected renderColorSelector(
    selectedColorIndex: number,
    onSelect: (index: number) => void
  ): React.ReactNode {
    return (
      <div style={colorSelectorPopoverStyle}>
        {C64_COLOR_PALETTE.map((color) => {
          const selected = selectedColorIndex === color.index;
          return (
            <button
              key={color.index}
              type='button'
              title={`${color.index} ${color.name}`}
              aria-label={`${color.name} (${color.index})`}
              onClick={() => onSelect(color.index)}
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

  protected renderCharacterTable(): React.ReactNode {
    return (
      <div style={characterTableOuterStyle}>
        <div style={sectionTitleStyle}>Character table</div>
        <div
          style={{
            ...characterTableStyle,
            background: 'var(--theia-editor-background)'
          }}
        >
          {this.document.characterSet.glyphs.map((_glyph, index) => {
            const selected = index === this.selectedCharacter;
            return (
              <button
                key={index}
                title={`$${hexByte(index)} / ${index}`}
                onClick={() => this.selectCharacter(index)}
                style={{
                  ...glyphButtonStyle,
                  boxShadow: selected ? glyphSelectedShadow : undefined,
                  outline: 'none'
                }}
              >
                {this.renderGlyphPreview(index, CHARACTER_TABLE_PIXEL_SIZE, this.selectedColor)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  protected renderBitmapEditor(): React.ReactNode {
    const columns = this.document.colorMode === 'multicolor' ? 4 : 8;
    return (
      <div style={bitmapEditorStyle}>
        <div style={bitmapEditorHeaderStyle}>
          <div style={sectionTitleStyle}>bitmap editor</div>
          <div style={bitmapPreviewStyle}>
            {this.renderGlyphPreview(this.selectedCharacter, 3, this.selectedColor)}
          </div>
        </div>
        {this.renderGlyphPaintTools()}
        <div
          style={{
            ...bitmapGridStyle,
            gridTemplateColumns: `repeat(${columns}, ${
              this.document.colorMode === 'multicolor'
                ? BITMAP_PIXEL_SIZE * 2
                : BITMAP_PIXEL_SIZE
            }px)`
          }}
        >
          {Array.from({ length: 8 }, (_, y) =>
            Array.from({ length: columns }, (_unused, x) => {
              const value = this.document.colorMode === 'multicolor'
                ? getMulticolorValue(this.document, this.selectedCharacter, x, y)
                : getHiresValue(this.document, this.selectedCharacter, x, y);
              return (
                <button
                  key={`${x}:${y}`}
                  title={`${x},${y}`}
                  onClick={() => {
                    if (this.document.colorMode === 'multicolor') {
                      this.paintMulticolorGlyphPixel(x, y);
                    } else {
                      this.paintHiresGlyphPixel(x, y);
                    }
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    if (this.document.colorMode === 'multicolor') {
                      this.markChanged(
                        setScreenMulticolorPixel(
                          this.document,
                          this.selectedCharacter,
                          x,
                          y,
                          0
                        )
                      );
                    } else {
                      this.markChanged(
                        setScreenHiresPixel(
                          this.document,
                          this.selectedCharacter,
                          x,
                          y,
                          false
                        )
                      );
                    }
                  }}
                  style={{
                    ...bitmapPixelStyle,
                    background: this.pixelColor(value, this.selectedColor),
                    width: `${this.document.colorMode === 'multicolor'
                      ? BITMAP_PIXEL_SIZE * 2
                      : BITMAP_PIXEL_SIZE}px`
                  }}
                />
              );
            })
          )}
        </div>
        <div style={bitmapToolRowStyle}>
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
            title='Clear character'
            style={iconButtonStyle}
            onClick={() => this.clearSelectedGlyph()}
          >
            <span className={codicon('clear-all')} />
          </button>
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

  protected renderGlyphPaintTools(): React.ReactNode {
    const choices = this.document.colorMode === 'multicolor'
      ? [
          { value: 0, label: 'BG', color: this.document.colors.background },
          { value: 1, label: 'M1', color: this.document.colors.multicolor1 },
          { value: 2, label: 'M2', color: this.document.colors.multicolor2 },
          { value: 3, label: 'char', color: this.selectedColor }
        ]
      : [
          { value: 0, label: 'BG', color: this.document.colors.background },
          { value: 1, label: 'char', color: this.selectedColor }
        ];
    return (
      <div style={bitmapPaintToolsStyle}>
        {choices.map((choice) => {
          const selected = choice.value === this.glyphPaintValue;
          const color = C64_COLOR_PALETTE[choice.color & 0x0f];
          return (
            <button
              key={choice.value}
              style={{
                ...bitmapPaintButtonStyle,
                borderColor: selected
                  ? 'var(--theia-focusBorder)'
                  : 'var(--theia-editorGroup-border)'
              }}
              title={choice.label}
              onClick={() => this.setGlyphPaintValue(choice.value)}
            >
              <span
                style={{
                  ...bitmapPaintSwatchStyle,
                  background: color?.hex ?? '#000000'
                }}
              />
              <span>{choice.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  protected renderGlyphPreview(
    glyphIndex: number,
    pixelSize: number,
    color: number
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
                  background: this.pixelColor(value, color),
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

  protected pixelColor(value: number, color: number): string {
    const colorIndex = this.document.colorMode === 'multicolor'
      ? [
          this.document.colors.background,
          this.document.colors.multicolor1,
          this.document.colors.multicolor2,
          color
        ][value] ?? this.document.colors.background
      : value === 0
        ? this.document.colors.background
        : color;
    return C64_COLOR_PALETTE[colorIndex]?.hex ?? '#000000';
  }
}

interface ScreenCanvasProps {
  readonly document: CommodoreScreenDocument;
  readonly cursorColumn: number;
  readonly cursorRow: number;
  readonly onPaintCell: (column: number, row: number) => void;
  readonly onPickCell: (column: number, row: number) => void;
  readonly onClearCell: (column: number, row: number) => void;
  readonly onMoveCursor: (deltaColumn: number, deltaRow: number) => void;
  readonly onTypeCharacter: (character: number) => void;
}

function ScreenCanvas(props: ScreenCanvasProps): React.ReactElement {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const width = screenCanvasWidth(props.document);
  const height = screenCanvasHeight(props.document);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    drawScreenCanvas(
      canvas,
      props.document,
      props.cursorColumn,
      props.cursorRow
    );
  }, [
    props.document,
    props.cursorColumn,
    props.cursorRow
  ]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      tabIndex={0}
      role='application'
      aria-label='Commodore screen editor canvas'
      onPointerDown={(event) => {
        event.currentTarget.focus();
        const cell = cellFromPointerEvent(event, props.document);
        if (!cell) {
          return;
        }
        event.preventDefault();
        if (event.button === 2 || event.altKey) {
          props.onPickCell(cell.column, cell.row);
        } else {
          props.onPaintCell(cell.column, cell.row);
        }
      }}
      onContextMenu={(event) => {
        const cell = cellFromPointerEvent(event, props.document);
        if (cell) {
          event.preventDefault();
          props.onPickCell(cell.column, cell.row);
        }
      }}
      onKeyDown={(event) => {
        if (handleScreenCanvasKey(event, props)) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      style={{
        ...screenCanvasStyle,
        aspectRatio: `${width} / ${height}`,
        width: `${width * 2}px`
      }}
    />
  );
}

function handleScreenCanvasKey(
  event: React.KeyboardEvent<HTMLCanvasElement>,
  props: ScreenCanvasProps
): boolean {
  switch (event.key) {
    case 'ArrowLeft':
      props.onMoveCursor(-1, 0);
      return true;
    case 'ArrowRight':
      props.onMoveCursor(1, 0);
      return true;
    case 'ArrowUp':
      props.onMoveCursor(0, -1);
      return true;
    case 'ArrowDown':
      props.onMoveCursor(0, 1);
      return true;
    case 'Enter':
      props.onPaintCell(props.cursorColumn, props.cursorRow);
      return true;
    case ' ':
      props.onTypeCharacter(32);
      return true;
    case 'Backspace':
    case 'Delete':
      props.onClearCell(props.cursorColumn, props.cursorRow);
      return true;
    default: {
      const character = printableToScreenCode(event.key);
      if (character === undefined) {
        return false;
      }
      props.onTypeCharacter(character);
      return true;
    }
  }
}

function printableToScreenCode(value: string): number | undefined {
  if (value.length !== 1) {
    return undefined;
  }
  if (value === '@') {
    return 0;
  }
  if (/^[a-z]$/iu.test(value)) {
    return value.toUpperCase().charCodeAt(0) - 64;
  }
  const code = value.charCodeAt(0);
  if (code >= 32 && code <= 63) {
    return code;
  }
  if (code >= 91 && code <= 95) {
    return code - 64;
  }
  return undefined;
}

function drawScreenCanvas(
  canvas: HTMLCanvasElement,
  document: CommodoreScreenDocument,
  cursorColumn: number,
  cursorRow: number
): void {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  context.imageSmoothingEnabled = false;
  context.fillStyle = paletteColor(document.colors.border);
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = paletteColor(document.colors.background);
  context.fillRect(
    SCREEN_BORDER_X,
    SCREEN_BORDER_Y,
    document.geometry.columns * CHARACTER_WIDTH,
    document.geometry.rows * CHARACTER_HEIGHT
  );

  document.cells.forEach((cell, index) => {
    const column = index % document.geometry.columns;
    const row = Math.floor(index / document.geometry.columns);
    drawScreenGlyph(
      context,
      document,
      cell.character,
      cell.color,
      SCREEN_BORDER_X + column * CHARACTER_WIDTH,
      SCREEN_BORDER_Y + row * CHARACTER_HEIGHT
    );
  });

  drawCursor(context, document, cursorColumn, cursorRow);
}

function drawScreenGlyph(
  context: CanvasRenderingContext2D,
  document: CommodoreScreenDocument,
  character: number,
  color: number,
  x: number,
  y: number
): void {
  if (document.colorMode === 'multicolor') {
    for (let row = 0; row < CHARACTER_HEIGHT; row += 1) {
      const byte = getScreenGlyphByte(document, character, row);
      for (let pair = 0; pair < 4; pair += 1) {
        const value = (byte >> ((3 - pair) * 2)) & 0x03;
        context.fillStyle = screenPixelColor(document, value, color);
        context.fillRect(x + pair * 2, y + row, 2, 1);
      }
    }
    return;
  }

  for (let row = 0; row < CHARACTER_HEIGHT; row += 1) {
    const byte = getScreenGlyphByte(document, character, row);
    for (let bit = 0; bit < CHARACTER_WIDTH; bit += 1) {
      const enabled = (byte & (1 << (7 - bit))) !== 0;
      context.fillStyle = enabled
        ? paletteColor(color)
        : paletteColor(document.colors.background);
      context.fillRect(x + bit, y + row, 1, 1);
    }
  }
}

function drawCursor(
  context: CanvasRenderingContext2D,
  document: CommodoreScreenDocument,
  cursorColumn: number,
  cursorRow: number
): void {
  const x = SCREEN_BORDER_X + cursorColumn * CHARACTER_WIDTH;
  const y = SCREEN_BORDER_Y + cursorRow * CHARACTER_HEIGHT;
  if (
    cursorColumn < 0 ||
    cursorColumn >= document.geometry.columns ||
    cursorRow < 0 ||
    cursorRow >= document.geometry.rows
  ) {
    return;
  }
  context.strokeStyle = '#FFFFFF';
  context.lineWidth = 1;
  context.strokeRect(x + 0.5, y + 0.5, CHARACTER_WIDTH - 1, CHARACTER_HEIGHT - 1);
  context.strokeStyle = '#000000';
  context.strokeRect(x + 1.5, y + 1.5, CHARACTER_WIDTH - 3, CHARACTER_HEIGHT - 3);
}

function cellFromPointerEvent(
  event: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>,
  document: CommodoreScreenDocument
): { column: number; row: number } | undefined {
  const canvas = event.currentTarget;
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (canvas.width / rect.width);
  const y = (event.clientY - rect.top) * (canvas.height / rect.height);
  const screenX = x - SCREEN_BORDER_X;
  const screenY = y - SCREEN_BORDER_Y;
  if (screenX < 0 || screenY < 0) {
    return undefined;
  }
  const column = Math.floor(screenX / CHARACTER_WIDTH);
  const row = Math.floor(screenY / CHARACTER_HEIGHT);
  if (
    column < 0 ||
    column >= document.geometry.columns ||
    row < 0 ||
    row >= document.geometry.rows
  ) {
    return undefined;
  }
  return { column, row };
}

function screenPixelColor(
  document: CommodoreScreenDocument,
  value: number,
  color: number
): string {
  const colorIndex = [
    document.colors.background,
    document.colors.multicolor1,
    document.colors.multicolor2,
    color
  ][value] ?? document.colors.background;
  return paletteColor(colorIndex);
}

function getHiresValue(
  document: CommodoreScreenDocument,
  glyphIndex: number,
  x: number,
  y: number
): number {
  return (getScreenGlyphByte(document, glyphIndex, y) & (1 << (7 - x))) ? 1 : 0;
}

function getMulticolorValue(
  document: CommodoreScreenDocument,
  glyphIndex: number,
  x: number,
  y: number
): number {
  return (getScreenGlyphByte(document, glyphIndex, y) >> ((3 - x) * 2)) & 0x03;
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

function paletteColor(index: number): string {
  return C64_COLOR_PALETTE[index & 0x0f]?.hex ?? '#000000';
}

function screenCanvasWidth(document: CommodoreScreenDocument): number {
  return document.geometry.columns * CHARACTER_WIDTH + SCREEN_BORDER_X * 2;
}

function screenCanvasHeight(document: CommodoreScreenDocument): number {
  return document.geometry.rows * CHARACTER_HEIGHT + SCREEN_BORDER_Y * 2;
}

function hexByte(value: number): string {
  return (value & 0xff).toString(16).toUpperCase().padStart(2, '0');
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const CHARACTER_WIDTH = 8;
const CHARACTER_HEIGHT = 8;
const SCREEN_BORDER_X = 8;
const SCREEN_BORDER_Y = 8;
const BITMAP_PIXEL_SIZE = 28;
const CHARACTER_TABLE_PIXEL_SIZE = 2;
const CHARACTER_TABLE_CELL_SIZE = CHARACTER_TABLE_PIXEL_SIZE * 8;
const CHARACTER_TABLE_GRID_GAP = 2;
const glyphSelectedShadow =
  '0 0 0 1px var(--theia-focusBorder), inset 0 0 0 0.5px var(--theia-focusBorder)';

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
  gridTemplateColumns: 'minmax(360px, 1fr) minmax(280px, 420px)',
  minHeight: 0,
  overflow: 'hidden',
  padding: '12px'
};

const screenSectionStyle: React.CSSProperties = {
  minHeight: 0,
  overflow: 'auto'
};

const toolsSectionStyle: React.CSSProperties = {
  alignContent: 'start',
  display: 'grid',
  gap: '12px',
  gridTemplateRows: 'max-content max-content minmax(0, 1fr)',
  minHeight: 0,
  overflow: 'hidden'
};

const screenPanelStyle: React.CSSProperties = {
  display: 'grid',
  gap: '8px',
  justifyItems: 'start',
  minWidth: 'max-content'
};

const screenStatusStyle: React.CSSProperties = {
  color: 'var(--theia-descriptionForeground)',
  display: 'flex',
  flexWrap: 'wrap',
  fontSize: '12px',
  gap: '12px'
};

const screenCanvasStyle: React.CSSProperties = {
  border: '1px solid var(--theia-editorGroup-border)',
  boxSizing: 'border-box',
  cursor: 'crosshair',
  height: 'auto',
  imageRendering: 'pixelated',
  maxWidth: '100%',
  outline: 'none'
};

const inspectorStyle: React.CSSProperties = {
  alignContent: 'start',
  border: '1px solid var(--theia-editorGroup-border)',
  display: 'grid',
  gap: '10px',
  padding: '10px'
};

const selectedIndexStyle: React.CSSProperties = {
  alignItems: 'baseline',
  display: 'flex',
  fontSize: '24px',
  gap: '8px',
  lineHeight: 1
};

const selectedIndexDetailStyle: React.CSSProperties = {
  color: 'var(--theia-descriptionForeground)',
  fontSize: '12px'
};

const smallDetailStyle: React.CSSProperties = {
  color: 'var(--theia-descriptionForeground)',
  fontSize: '12px'
};

const toolRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '6px'
};

const colorToolsStyle: React.CSSProperties = {
  display: 'grid',
  gap: '8px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))'
};

const colorChoiceStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'grid',
  gap: '6px',
  gridTemplateColumns: 'minmax(64px, 1fr) 42px',
  minHeight: '28px'
};

const paintChoiceTextStyle: React.CSSProperties = {
  color: 'var(--theia-editor-foreground)',
  fontSize: '12px',
  lineHeight: 1.2
};

const paintChoiceDetailStyle: React.CSSProperties = {
  color: 'var(--theia-descriptionForeground)',
  display: 'block',
  fontSize: '11px'
};

const colorButtonAnchorStyle: React.CSSProperties = {
  position: 'relative'
};

const paintChoiceSwatchButtonStyle: React.CSSProperties = {
  border: '1px solid var(--theia-editorGroup-border)',
  borderRadius: '2px',
  boxSizing: 'border-box',
  height: '24px',
  width: '36px'
};

const colorSelectorBackdropStyle: React.CSSProperties = {
  bottom: 0,
  left: 0,
  position: 'fixed',
  right: 0,
  top: 0,
  zIndex: 10
};

const colorSelectorPopoverStyle: React.CSSProperties = {
  background: 'var(--theia-editorWidget-background)',
  border: '1px solid var(--theia-editorGroup-border)',
  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
  display: 'grid',
  gap: '4px',
  gridTemplateColumns: 'repeat(4, 22px)',
  padding: '6px',
  position: 'absolute',
  right: 0,
  top: '28px',
  zIndex: 20
};

const colorSelectorSwatchStyle: React.CSSProperties = {
  border: '1px solid var(--theia-editorGroup-border)',
  boxSizing: 'border-box',
  height: '22px',
  padding: 0,
  width: '22px'
};

const characterTableOuterStyle: React.CSSProperties = {
  minHeight: 0,
  overflow: 'auto'
};

const bitmapEditorStyle: React.CSSProperties = {
  alignContent: 'start',
  border: '1px solid var(--theia-editorGroup-border)',
  display: 'grid',
  gap: '8px',
  justifyItems: 'start',
  padding: '10px'
};

const bitmapEditorHeaderStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  gap: '10px',
  justifyContent: 'space-between',
  width: '100%'
};

const bitmapPreviewStyle: React.CSSProperties = {
  background: 'rgba(127, 127, 127, 0.08)',
  padding: '3px'
};

const bitmapPaintToolsStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px'
};

const bitmapPaintButtonStyle: React.CSSProperties = {
  alignItems: 'center',
  background: 'var(--theia-button-secondaryBackground)',
  border: '1px solid var(--theia-editorGroup-border)',
  borderRadius: '2px',
  color: 'var(--theia-button-secondaryForeground)',
  display: 'inline-flex',
  fontSize: '11px',
  gap: '5px',
  minHeight: '24px',
  padding: '2px 6px'
};

const bitmapPaintSwatchStyle: React.CSSProperties = {
  border: '1px solid rgba(127, 127, 127, 0.45)',
  boxSizing: 'border-box',
  display: 'inline-block',
  height: '14px',
  width: '14px'
};

const bitmapGridStyle: React.CSSProperties = {
  display: 'grid',
  gap: '1px',
  width: 'max-content'
};

const bitmapPixelStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 0,
  boxShadow: 'inset 0 0 0 0.5px rgba(0, 0, 0, 0.3)',
  boxSizing: 'border-box',
  height: `${BITMAP_PIXEL_SIZE}px`,
  padding: 0
};

const bitmapToolRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px'
};

const sectionTitleStyle: React.CSSProperties = {
  color: 'var(--theia-descriptionForeground)',
  fontSize: '12px',
  marginBottom: '6px'
};

const characterTableStyle: React.CSSProperties = {
  display: 'grid',
  gap: `${CHARACTER_TABLE_GRID_GAP}px`,
  gridTemplateColumns: `repeat(16, ${CHARACTER_TABLE_CELL_SIZE}px)`,
  width: 'max-content'
};

const glyphButtonStyle: React.CSSProperties = {
  alignItems: 'center',
  background: 'rgba(127, 127, 127, 0.08)',
  border: 0,
  borderRadius: 0,
  display: 'flex',
  height: `${CHARACTER_TABLE_CELL_SIZE}px`,
  justifyContent: 'center',
  padding: 0,
  width: `${CHARACTER_TABLE_CELL_SIZE}px`
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

const iconButtonStyle: React.CSSProperties = {
  alignItems: 'center',
  background: 'var(--theia-button-secondaryBackground)',
  border: '1px solid var(--theia-button-border, transparent)',
  borderRadius: '2px',
  color: 'var(--theia-button-secondaryForeground)',
  display: 'inline-flex',
  height: '28px',
  justifyContent: 'center',
  padding: 0,
  width: '32px'
};
