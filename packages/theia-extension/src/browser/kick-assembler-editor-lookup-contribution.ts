import type { FrontendApplicationContribution } from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import {
  Disposable,
  DisposableCollection
} from '@theia/core/lib/common/disposable';
import { inject, injectable } from '@theia/core/shared/inversify';
import { EditorManager } from '@theia/editor/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { BreakpointManager } from '@theia/debug/lib/browser/breakpoint/breakpoint-manager';
import { SourceBreakpoint } from '@theia/debug/lib/browser/breakpoint/breakpoint-marker';
import {
  MonacoLanguages,
  type WorkspaceSymbolProvider
} from '@theia/monaco/lib/browser/monaco-languages';
import {
  SymbolKind as ProtocolSymbolKind,
  type SymbolInformation
} from '@theia/core/shared/vscode-languageserver-protocol';
import * as monaco from '@theia/monaco-editor-core';
import { StandaloneServices } from '@theia/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';
import {
  ICommandService
} from '@theia/monaco-editor-core/esm/vs/platform/commands/common/commands';

import {
  BUNDLED_REFERENCE_ASSET_SPECS,
  buildKickAssemblerFoldingRanges,
  buildKickAssemblerRenamePlan,
  buildKickAssemblerSemanticTokens,
  createLookupHoverContent,
  createTextDocumentModel,
  findLookupTokenAtPosition,
  findKickAssemblerWorkspaceSymbols,
  formatKickAssemblerDocument,
  KickAssemblerLookupService,
  KICK_ASSEMBLER_SEMANTIC_TOKEN_MODIFIERS,
  KICK_ASSEMBLER_SEMANTIC_TOKEN_TYPES,
  prepareKickAssemblerRename,
  provideKickAssemblerCompletions,
  provideKickAssemblerQuickFixes,
  type BundledReferenceAssetSpec,
  type DocumentPosition,
  type KickAssemblerCompletionItem,
  type KickAssemblerDiagnostic,
  type KickAssemblerFoldingRange,
  type KickAssemblerHoverContent,
  type KickAssemblerIncludePathCandidate,
  type KickAssemblerLookupDocument,
  type KickAssemblerLookupKind,
  type KickAssemblerLookupOccurrence,
  type KickAssemblerLookupResult,
  type KickAssemblerLookupTokenMatch,
  type KickAssemblerQuickFix,
  type KickAssemblerSemanticToken,
  type KickAssemblerTextEdit,
  type KickAssemblerWorkspaceSymbol,
  type SourceRange,
  type TextDocumentModel
} from '@commodore-commander/language-support/runtime';
import {
  KICK_ASSEMBLER_FILE_EXTENSIONS,
  KICK_ASSEMBLER_LANGUAGE_ID
} from './kick-assembler-language-contribution';
import {
  KickAssemblerReferenceHoverWidget,
  type KickAssemblerReferenceHoverRequest
} from './kick-assembler-reference-hover-widget';
import {
  SCREEN_CAPTURE_API_KEY,
  type CommodoreCommanderScreenCaptureApi
} from './commodore-commander-screen-capture-contribution';
import {
  CommodoreMachineProfileSelectionService
} from './commodore-machine-profile-selection';

const EXCLUDED_DIRECTORY_NAMES = new Set([
  '.git',
  '.metadata',
  '.theia',
  'node_modules',
  'target'
]);

type ScreenCaptureApiWindow = Window & {
  [SCREEN_CAPTURE_API_KEY]?: CommodoreCommanderScreenCaptureApi;
};

@injectable()
export class KickAssemblerEditorLookupContribution
  implements FrontendApplicationContribution {
  @inject(FileService)
  protected readonly fileService!: FileService;

  @inject(WorkspaceService)
  protected readonly workspaceService!: WorkspaceService;

  @inject(EditorManager)
  protected readonly editorManager!: EditorManager;

  @inject(BreakpointManager)
  protected readonly breakpointManager!: BreakpointManager;

  @inject(MonacoLanguages)
  protected readonly monacoLanguages!: MonacoLanguages;

  @inject(CommodoreMachineProfileSelectionService)
  protected readonly machineProfileSelection!: CommodoreMachineProfileSelectionService;

  protected readonly lookupService = new KickAssemblerLookupService();
  protected readonly toDispose = new DisposableCollection();
  protected readonly trackedEditors = new WeakSet<MonacoEditor>();
  protected readonly referenceHoverWidgets = new Map<
    MonacoEditor,
    KickAssemblerReferenceHoverWidget
  >();
  protected bundledReferenceDocuments:
    | Promise<readonly KickAssemblerLookupDocument[]>
    | undefined;

  initialize(): void {
    this.installScreenCaptureApi();
    this.registerReferenceHoverWidgets();

    this.toDispose.push(
      monaco.languages.registerHoverProvider(
        KICK_ASSEMBLER_LANGUAGE_ID,
        {
          provideHover: async (model, position) => {
            const context = await this.lookupContextForPosition(model, position);
            if (!context) {
              return undefined;
            }

            const hover = createLookupHoverContent(context.lookup);
            if (!hover || hover.supportHtml) {
              return undefined;
            }

            return toMonacoHover(context.document, context.token, hover);
          }
        }
      )
    );

    this.toDispose.push(
      monaco.languages.registerDefinitionProvider(
        KICK_ASSEMBLER_LANGUAGE_ID,
        {
          provideDefinition: async (model, position) => {
            const context = await this.lookupContextForPosition(model, position);
            if (!context || context.lookup.declarations.length === 0) {
              return undefined;
            }

            return context.lookup.declarations.map(toMonacoLocation);
          }
        }
      )
    );

    this.toDispose.push(
      monaco.languages.registerReferenceProvider(
        KICK_ASSEMBLER_LANGUAGE_ID,
        {
          provideReferences: async (model, position, context) => {
            const lookupContext = await this.lookupContextForPosition(
              model,
              position
            );
            if (!lookupContext || lookupContext.lookup.declarations.length === 0) {
              return undefined;
            }

            const locations = context.includeDeclaration
              ? [
                  ...lookupContext.lookup.declarations,
                  ...lookupContext.lookup.references
                ]
              : lookupContext.lookup.references;

            return deduplicateOccurrences(locations).map(toMonacoLocation);
          }
        }
      )
    );

    this.toDispose.push(
      monaco.languages.registerCompletionItemProvider(
        KICK_ASSEMBLER_LANGUAGE_ID,
        {
          triggerCharacters: ['.', '#', '"', '/', ' ', '\t'],
          provideCompletionItems: async (model, position) => {
            if (!isKickAssemblerModel(model)) {
              return { suggestions: [] };
            }

            const document = toTextDocumentModel(model);
            const index = await this.buildLookupIndexForModel(model, document);
            const includePathCandidates =
              await this.collectIncludePathCandidates(new URI(model.uri.toString()));
            const suggestions = provideKickAssemblerCompletions(
              document,
              toDocumentPosition(position),
              {
                index,
                includePathCandidates
              }
            ).map(toMonacoCompletionItem);

            return { suggestions };
          }
        }
      )
    );

    this.toDispose.push(
      monaco.languages.registerRenameProvider(
        KICK_ASSEMBLER_LANGUAGE_ID,
        {
          resolveRenameLocation: async (model, position) => {
            if (!isKickAssemblerModel(model)) {
              return {
                range: new monaco.Range(
                  position.lineNumber,
                  position.column,
                  position.lineNumber,
                  position.column
                ),
                text: '',
                rejectReason: 'Not a Kick Assembler document.'
              };
            }

            const document = toTextDocumentModel(model);
            const index = await this.buildLookupIndexForModel(model, document);
            const prepared = prepareKickAssemblerRename(
              document,
              toDocumentPosition(position),
              index
            );

            if (!prepared) {
              return {
                range: new monaco.Range(
                  position.lineNumber,
                  position.column,
                  position.lineNumber,
                  position.column
                ),
                text: '',
                rejectReason: 'This symbol cannot be renamed.'
              };
            }

            return {
              range: toMonacoRangeFromSource(prepared.range),
              text: prepared.placeholder
            };
          },
          provideRenameEdits: async (model, position, newName) => {
            const document = toTextDocumentModel(model);
            const index = await this.buildLookupIndexForModel(model, document);
            const plan = buildKickAssemblerRenamePlan(
              document,
              toDocumentPosition(position),
              newName,
              index
            );

            if (!plan) {
              return {
                edits: [],
                rejectReason: 'This symbol cannot be renamed.'
              };
            }

            return {
              edits: plan.edits.map((edit) => ({
                resource: monaco.Uri.parse(edit.uri),
                textEdit: {
                  range: toMonacoRangeFromSource(edit.range),
                  text: edit.newText
                },
                versionId: undefined
              }))
            };
          }
        }
      )
    );

    this.toDispose.push(
      monaco.languages.registerDocumentSemanticTokensProvider(
        KICK_ASSEMBLER_LANGUAGE_ID,
        {
          getLegend: () => ({
            tokenTypes: [...KICK_ASSEMBLER_SEMANTIC_TOKEN_TYPES],
            tokenModifiers: [...KICK_ASSEMBLER_SEMANTIC_TOKEN_MODIFIERS]
          }),
          provideDocumentSemanticTokens: async (model) => {
            if (!isKickAssemblerModel(model)) {
              return { data: new Uint32Array() };
            }

            const document = toTextDocumentModel(model);
            const index = await this.buildLookupIndexForModel(model, document);
            return {
              data: encodeSemanticTokens(
                buildKickAssemblerSemanticTokens(document, index),
                document
              )
            };
          },
          releaseDocumentSemanticTokens: () => undefined
        }
      )
    );

    this.toDispose.push(
      monaco.languages.registerFoldingRangeProvider(
        KICK_ASSEMBLER_LANGUAGE_ID,
        {
          provideFoldingRanges: (model) => {
            if (!isKickAssemblerModel(model)) {
              return [];
            }

            return buildKickAssemblerFoldingRanges(toTextDocumentModel(model))
              .map(toMonacoFoldingRange);
          }
        }
      )
    );

    this.toDispose.push(
      monaco.languages.registerDocumentFormattingEditProvider(
        KICK_ASSEMBLER_LANGUAGE_ID,
        {
          displayName: 'Kick Assembler',
          provideDocumentFormattingEdits: (model, options) => {
            if (!isKickAssemblerModel(model)) {
              return [];
            }

            return formatKickAssemblerDocument(toTextDocumentModel(model), {
              tabSize: options.tabSize,
              insertSpaces: options.insertSpaces
            }).map(toMonacoTextEdit);
          }
        }
      )
    );

    this.toDispose.push(
      monaco.languages.registerCodeActionProvider(
        KICK_ASSEMBLER_LANGUAGE_ID,
        {
          provideCodeActions: async (model, range, context) => {
            if (!isKickAssemblerModel(model)) {
              return emptyCodeActionList();
            }

            const document = toTextDocumentModel(model);
            const includePathCandidates =
              await this.collectIncludePathCandidates(new URI(model.uri.toString()));
            const markerDiagnostics = context.markers.length > 0
              ? context.markers.map((marker) =>
                  toKickAssemblerDiagnostic(marker, model.uri.toString())
                )
              : undefined;
            const actions = provideKickAssemblerQuickFixes(
              document,
              toSourceRange(range),
              {
                includePathCandidates,
                ...(markerDiagnostics ? { diagnostics: markerDiagnostics } : {})
              }
            ).map((action) => toMonacoCodeAction(action, model.uri));

            return {
              actions,
              dispose: () => undefined
            };
          }
        },
        {
          providedCodeActionKinds: ['quickfix']
        }
      )
    );

    this.toDispose.push(
      this.monacoLanguages.registerWorkspaceSymbolProvider(
        this.createWorkspaceSymbolProvider()
      )
    );
  }

  onStop(): void {
    this.toDispose.dispose();
  }

  protected registerReferenceHoverWidgets(): void {
    for (const editor of MonacoEditor.getAll(this.editorManager)) {
      this.attachReferenceHoverWidget(editor);
    }

    this.toDispose.push(
      this.editorManager.onCreated((widget) => {
        const editor = MonacoEditor.get(widget);
        if (!editor) {
          return;
        }

        this.attachReferenceHoverWidget(editor);
      })
    );
  }

  protected attachReferenceHoverWidget(editor: MonacoEditor): void {
    if (this.trackedEditors.has(editor)) {
      return;
    }

    this.trackedEditors.add(editor);
    const hoverWidget = new KickAssemblerReferenceHoverWidget(
      editor,
      async (model, position) => this.referenceHoverForPosition(model, position)
    );
    this.referenceHoverWidgets.set(editor, hoverWidget);
    this.toDispose.push(
      Disposable.create(() => this.referenceHoverWidgets.delete(editor))
    );
    this.toDispose.push(hoverWidget);
  }

  protected installScreenCaptureApi(): void {
    const captureWindow = window as ScreenCaptureApiWindow;
    captureWindow[SCREEN_CAPTURE_API_KEY] = {
      ...captureWindow[SCREEN_CAPTURE_API_KEY],
      runEditorAction: async (actionId) =>
        this.runEditorActionForScreenCapture(actionId),
      setEditorSource: async (source, marker) =>
        this.setEditorSourceForScreenCapture(source, marker),
      setEditorMarker: async (marker) =>
        this.setEditorMarkerForScreenCapture(marker),
      setSourceBreakpoint: async (marker) =>
        this.setSourceBreakpointForScreenCapture(marker),
      showMnemonicHover: async () => this.showMnemonicHoverForScreenCapture(),
      showReferences: async () => this.showReferencesForScreenCapture()
    };
  }

  protected async runEditorActionForScreenCapture(
    actionId: string
  ): Promise<boolean> {
    const editor = this.editorForScreenCapture();
    if (!editor) {
      return false;
    }

    const action = editor.getControl().getAction(actionId);
    if (!action) {
      return false;
    }

    void action.run();
    return true;
  }

  protected setEditorSourceForScreenCapture(
    source: string,
    marker?: { needle?: string; offset?: number }
  ): boolean {
    const editor = this.editorForScreenCapture();
    if (!editor) {
      return false;
    }

    const control = editor.getControl();
    const model = control.getModel();
    if (!model) {
      return false;
    }

    model.setValue(source);
    return this.setEditorMarkerForScreenCapture(marker);
  }

  protected setEditorMarkerForScreenCapture(
    marker?: { needle?: string; offset?: number }
  ): boolean {
    const editor = this.editorForScreenCapture();
    if (!editor) {
      return false;
    }

    const control = editor.getControl();
    const model = control.getModel();
    if (!model) {
      return false;
    }

    const position = this.positionForScreenCaptureMarker(model, marker);
    if (!position) {
      return false;
    }
    control.focus();
    control.setSelection(new monaco.Selection(
      position.lineNumber,
      position.column,
      position.lineNumber,
      position.column
    ));
    control.setPosition(position);
    control.revealPositionInCenterIfOutsideViewport(position);
    return true;
  }

  protected setSourceBreakpointForScreenCapture(
    marker?: { needle?: string; offset?: number }
  ): boolean {
    const editor = this.editorForScreenCapture();
    if (!editor) {
      return false;
    }

    const control = editor.getControl();
    const model = control.getModel();
    if (!model) {
      return false;
    }

    const position = this.positionForScreenCaptureMarker(model, marker);
    if (!position) {
      return false;
    }

    control.focus();
    control.setSelection(new monaco.Selection(
      position.lineNumber,
      position.column,
      position.lineNumber,
      position.column
    ));
    control.setPosition(position);
    control.revealPositionInCenterIfOutsideViewport(position);

    const uri = new URI(model.uri.toString());
    const breakpoint = SourceBreakpoint.create(uri, {
      line: position.lineNumber
    });
    const breakpoints = this.breakpointManager.getBreakpoints(uri)
      .filter(({ raw }) => raw.line !== position.lineNumber);
    this.breakpointManager.setBreakpoints(uri, [...breakpoints, breakpoint]);
    return true;
  }

  protected positionForScreenCaptureMarker(
    model: monaco.editor.ITextModel,
    marker?: { needle?: string; offset?: number }
  ): monaco.Position | undefined {
    let offset = 0;
    if (marker?.needle) {
      const source = model.getValue();
      const markerOffset = source.indexOf(marker.needle);
      if (markerOffset === -1) {
        return undefined;
      }
      offset = markerOffset + (marker.offset ?? marker.needle.length);
    }
    return model.getPositionAt(offset);
  }

  protected async showMnemonicHoverForScreenCapture(): Promise<boolean> {
    const editor = this.editorForScreenCapture();
    if (!editor) {
      return false;
    }

    const hoverWidget = this.referenceHoverWidgets.get(editor);
    if (!hoverWidget) {
      return false;
    }

    const control = editor.getControl();
    const model = control.getModel();
    if (!model) {
      return false;
    }

    for (let lineNumber = 1; lineNumber <= model.getLineCount(); lineNumber += 1) {
      const text = model.getLineContent(lineNumber);
      const mnemonicIndex = text.indexOf('asl');
      if (mnemonicIndex === -1) {
        continue;
      }

      const position = new monaco.Position(lineNumber, mnemonicIndex + 2);
      control.focus();
      control.revealPositionInCenterIfOutsideViewport(position);
      control.setPosition(position);
      return hoverWidget.showAtPosition(position);
    }

    return false;
  }

  protected async showReferencesForScreenCapture(): Promise<boolean> {
    const editor = this.editorForScreenCapture();
    if (!editor) {
      return false;
    }

    const control = editor.getControl();
    const model = control.getModel();
    const position = control.getPosition();
    if (!model || !position || !isKickAssemblerModel(model)) {
      return false;
    }

    const document = toTextDocumentModel(model);
    const index = await this.buildLookupIndexForModel(model, document);
    const lookup = this.lookupService.lookupAtPosition(
      document,
      toDocumentPosition(position),
      index
    );
    if (!lookup || lookup.declarations.length === 0) {
      return false;
    }

    const locations = deduplicateOccurrences([
      ...lookup.declarations,
      ...lookup.references
    ]).map(toMonacoLocation);
    if (locations.length === 0) {
      return false;
    }

    control.focus();
    await StandaloneServices.get(ICommandService).executeCommand(
      'editor.action.showReferences',
      model.uri,
      position,
      locations
    );
    return true;
  }

  protected editorForScreenCapture(): MonacoEditor | undefined {
    const editorWidget = this.editorManager.currentEditor;
    const currentEditor = editorWidget ? MonacoEditor.get(editorWidget) : undefined;
    return currentEditor ?? this.referenceHoverWidgets.keys().next().value;
  }

  protected async referenceHoverForPosition(
    model: monaco.editor.ITextModel,
    position: monaco.Position
  ): Promise<KickAssemblerReferenceHoverRequest | undefined> {
    if (!isKickAssemblerModel(model)) {
      return undefined;
    }

    const context = await this.lookupContextForPosition(model, position);
    if (!context) {
      return undefined;
    }

    const hover = createLookupHoverContent(context.lookup);
    if (!hover || !hover.supportHtml) {
      return undefined;
    }

    return toReferenceHoverRequest(context.document, context.token, hover);
  }

  protected async lookupContextForPosition(
    model: monaco.editor.ITextModel,
    position: monaco.Position
  ): Promise<KickAssemblerLookupContext | undefined> {
    const document = createTextDocumentModel({
      uri: model.uri.toString(),
      text: model.getValue()
    });
    const documentPosition = toDocumentPosition(position);
    const token = findLookupTokenAtPosition(document, documentPosition);
    if (!token) {
      return undefined;
    }

    const index = await this.buildLookupIndexForModel(model, document);
    const lookup = this.lookupService.lookupAtPosition(
      document,
      documentPosition,
      index
    );
    if (!lookup) {
      return undefined;
    }

    return {
      document,
      lookup,
      token
    };
  }

  protected async buildLookupIndexForModel(
    model: monaco.editor.ITextModel,
    currentDocument: ReturnType<typeof createTextDocumentModel>
  ) {
    const documents = await this.collectLookupDocuments(model, currentDocument);
    return this.lookupService.buildIndex(documents, {
      machineProfileId: this.machineProfileSelection.getActiveMachineProfileId(
        new URI(model.uri.toString())
      )
    });
  }

  protected async collectLookupDocuments(
    currentModel: monaco.editor.ITextModel,
    currentDocument: ReturnType<typeof createTextDocumentModel>
  ): Promise<KickAssemblerLookupDocument[]> {
    const overlayTexts = this.collectOverlayTexts();
    const currentUri = new URI(currentModel.uri.toString());
    const candidateUris = await this.collectCandidateUris(currentUri);
    const documents: KickAssemblerLookupDocument[] = [];
    const seen = new Set<string>();

    for (const candidateUri of candidateUris) {
      const key = candidateUri.toString();
      if (seen.has(key)) {
        continue;
      }

      const overlayText = overlayTexts.get(key);
      if (overlayText !== undefined) {
        documents.push(createLookupDocument('kickassembler', key, overlayText));
        seen.add(key);
        continue;
      }

      try {
        const content = await this.fileService.read(candidateUri);
        documents.push(
          createLookupDocument('kickassembler', key, content.value)
        );
        seen.add(key);
      } catch {
        continue;
      }
    }

    const currentKey = currentUri.toString();
    if (!seen.has(currentKey)) {
      documents.push({
        kind: 'kickassembler',
        document: currentDocument
      });
    }

    documents.push(...(await this.loadBundledReferenceDocuments()));

    return documents;
  }

  protected collectOverlayTexts(): Map<string, string> {
    const overlays = new Map<string, string>();

    for (const model of monaco.editor.getModels()) {
      const modelUri = new URI(model.uri.toString());

      if (
        model.getLanguageId() !== KICK_ASSEMBLER_LANGUAGE_ID &&
        !hasKickAssemblerExtension(modelUri)
      ) {
        continue;
      }

      overlays.set(model.uri.toString(), model.getValue());
    }

    return overlays;
  }

  protected async loadBundledReferenceDocuments():
    Promise<readonly KickAssemblerLookupDocument[]> {
    if (!this.bundledReferenceDocuments) {
      this.bundledReferenceDocuments = Promise.all(
        BUNDLED_REFERENCE_ASSET_SPECS.map(async (entry) => {
          const text = await this.readBundledReferenceAsset(entry);
          return createLookupDocument(
            entry.kind,
            entry.assetUrl.toString(),
            text,
            'xml'
          );
        })
      ).catch((error: unknown) => {
        this.bundledReferenceDocuments = undefined;
        throw error;
      });
    }

    return this.bundledReferenceDocuments;
  }

  protected async readBundledReferenceAsset(
    entry: BundledReferenceAssetSpec
  ): Promise<string> {
    if (entry.assetUrl.protocol === 'file:') {
      const content = await this.fileService.read(new URI(entry.assetUrl.toString()));
      return content.value;
    }

    const response = await fetch(entry.assetUrl);
    if (!response.ok) {
      throw new Error(
        `Unable to load bundled reference asset: ${entry.assetUrl.toString()}`
      );
    }
    return response.text();
  }

  protected async collectCandidateUris(currentUri: URI): Promise<URI[]> {
    if (!hasKickAssemblerExtension(currentUri) && currentUri.scheme !== 'file') {
      return [currentUri];
    }

    const workspaceRoot =
      currentUri.scheme === 'file'
        ? this.workspaceService.getWorkspaceRootUri(currentUri)
        : undefined;

    if (!workspaceRoot) {
      return [currentUri];
    }

    return this.collectKickAssemblerFiles(workspaceRoot);
  }

  protected async collectKickAssemblerFiles(rootUri: URI): Promise<URI[]> {
    const files: URI[] = [];
    const pending: URI[] = [rootUri];
    const seen = new Set<string>();

    while (pending.length > 0) {
      const candidate = pending.pop();
      if (!candidate) {
        continue;
      }

      const key = candidate.toString();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      let stat;
      try {
        stat = await this.fileService.resolve(candidate);
      } catch {
        continue;
      }

      if (stat.isFile) {
        if (hasKickAssemblerExtension(stat.resource)) {
          files.push(stat.resource);
        }
        continue;
      }

      for (const child of stat.children ?? []) {
        if (child.isDirectory) {
          if (EXCLUDED_DIRECTORY_NAMES.has(child.name)) {
            continue;
          }
          pending.push(child.resource);
          continue;
        }

        if (child.isFile && hasKickAssemblerExtension(child.resource)) {
          files.push(child.resource);
        }
      }
    }

    return files;
  }

  protected createWorkspaceSymbolProvider(): WorkspaceSymbolProvider {
    return {
      provideWorkspaceSymbols: async (params) => {
        const documents = await this.collectWorkspaceLookupDocuments();
        const index = this.lookupService.buildIndex(documents, {
          machineProfileId: this.machineProfileSelection.getActiveMachineProfileId(
            this.editorManager.currentEditor?.editor.uri
          )
        });
        return findKickAssemblerWorkspaceSymbols(index, params.query)
          .map(toProtocolWorkspaceSymbol);
      }
    };
  }

  protected async collectWorkspaceLookupDocuments():
    Promise<KickAssemblerLookupDocument[]> {
    const overlayTexts = this.collectOverlayTexts();
    const candidateUris: URI[] = [];

    for (const root of this.workspaceService.tryGetRoots()) {
      candidateUris.push(...(await this.collectKickAssemblerFiles(root.resource)));
    }

    const documents: KickAssemblerLookupDocument[] = [];
    const seen = new Set<string>();

    for (const candidateUri of candidateUris) {
      const key = candidateUri.toString();
      if (seen.has(key)) {
        continue;
      }

      const overlayText = overlayTexts.get(key);
      if (overlayText !== undefined) {
        documents.push(createLookupDocument('kickassembler', key, overlayText));
        seen.add(key);
        continue;
      }

      try {
        const content = await this.fileService.read(candidateUri);
        documents.push(createLookupDocument('kickassembler', key, content.value));
        seen.add(key);
      } catch {
        continue;
      }
    }

    documents.push(...(await this.loadBundledReferenceDocuments()));
    return documents;
  }

  protected async collectIncludePathCandidates(
    currentUri: URI
  ): Promise<KickAssemblerIncludePathCandidate[]> {
    if (currentUri.scheme !== 'file') {
      return [];
    }

    const candidates = new Map<string, KickAssemblerIncludePathCandidate>();
    const currentDirectory = currentUri.parent;

    try {
      const currentDirectoryStat = await this.fileService.resolve(currentDirectory);
      for (const child of currentDirectoryStat.children ?? []) {
        candidates.set(child.name, {
          path: child.name,
          isDirectory: child.isDirectory,
          detail: child.isDirectory ? 'Directory' : 'Current directory'
        });
      }
    } catch {
      // Include completion is opportunistic; unresolved directories should not
      // block other language features.
    }

    const workspaceRoot = this.workspaceService.getWorkspaceRootUri(currentUri);
    if (workspaceRoot) {
      for (const fileUri of await this.collectKickAssemblerFiles(workspaceRoot)) {
        if (fileUri.isEqual(currentUri)) {
          continue;
        }

        const relative = currentDirectory.relative(fileUri) ??
          workspaceRoot.relative(fileUri);
        const relativePath = relative?.toString();
        if (!relativePath || relativePath.length === 0) {
          continue;
        }

        addIncludeCandidate(candidates, relativePath, false, 'Workspace source');
        addParentDirectoryCandidates(candidates, relativePath);
      }
    }

    return [...candidates.values()]
      .sort((left, right) => {
        if (Boolean(left.isDirectory) !== Boolean(right.isDirectory)) {
          return left.isDirectory ? -1 : 1;
        }
        return left.path.localeCompare(right.path);
      });
  }
}

function toTextDocumentModel(model: monaco.editor.ITextModel): TextDocumentModel {
  return createTextDocumentModel({
    uri: model.uri.toString(),
    text: model.getValue(),
    languageId: model.getLanguageId(),
    version: model.getVersionId()
  });
}

function hasKickAssemblerExtension(resource: URI): boolean {
  return KICK_ASSEMBLER_FILE_EXTENSIONS.includes(resource.path.ext.toLowerCase());
}

function isKickAssemblerModel(model: monaco.editor.ITextModel): boolean {
  if (model.getLanguageId() === KICK_ASSEMBLER_LANGUAGE_ID) {
    return true;
  }

  return hasKickAssemblerExtension(new URI(model.uri.toString()));
}

function toMonacoLocation(
  occurrence: KickAssemblerLookupOccurrence
): monaco.languages.Location {
  const { start, end } = occurrence.location.range;

  return {
    uri: monaco.Uri.parse(occurrence.location.uri),
    range: new monaco.Range(
      start.line + 1,
      start.character + 1,
      end.line + 1,
      end.character + 1
    )
  };
}

function toMonacoCompletionItem(
  item: KickAssemblerCompletionItem
): monaco.languages.CompletionItem {
  const completion: monaco.languages.CompletionItem = {
    label: item.label,
    kind: toMonacoCompletionItemKind(item),
    insertText: item.insertText,
    range: toMonacoRangeFromSource(item.range),
    sortText: item.sortText,
    filterText: item.label
  };

  if (item.detail) {
    completion.detail = item.detail;
  }
  if (item.documentation) {
    completion.documentation = item.documentation;
  }

  return completion;
}

function toMonacoHover(
  document: TextDocumentModel,
  token: KickAssemblerLookupTokenMatch,
  hover: KickAssemblerHoverContent
): monaco.languages.Hover {
  const range = toMonacoRange(document, token);

  return {
    range,
    contents: [{
      value: hover.value,
      supportHtml: hover.supportHtml
    }]
  };
}

function toReferenceHoverRequest(
  document: TextDocumentModel,
  token: KickAssemblerLookupTokenMatch,
  hover: KickAssemblerHoverContent
): KickAssemblerReferenceHoverRequest {
  const range = toMonacoRange(document, token);

  return {
    anchor: range.getEndPosition(),
    html: hover.value,
    range
  };
}

function toMonacoRange(
  document: TextDocumentModel,
  token: KickAssemblerLookupTokenMatch
): monaco.Range {
  const start = document.positionAt(token.startOffset);
  const end = document.positionAt(token.endOffset);

  return new monaco.Range(
    start.line + 1,
    start.character + 1,
    end.line + 1,
    end.character + 1
  );
}

function toMonacoRangeFromSource(range: SourceRange): monaco.Range {
  return new monaco.Range(
    range.start.line + 1,
    range.start.character + 1,
    range.end.line + 1,
    range.end.character + 1
  );
}

function toSourceRange(range: monaco.Range): SourceRange {
  return {
    start: {
      line: range.startLineNumber - 1,
      character: range.startColumn - 1
    },
    end: {
      line: range.endLineNumber - 1,
      character: range.endColumn - 1
    }
  };
}

function toMonacoTextEdit(edit: KickAssemblerTextEdit): monaco.languages.TextEdit {
  return {
    range: toMonacoRangeFromSource(edit.range),
    text: edit.newText
  };
}

function toMonacoCodeAction(
  action: KickAssemblerQuickFix,
  uri: monaco.Uri
): monaco.languages.CodeAction {
  const codeAction: monaco.languages.CodeAction = {
    title: action.title,
    kind: action.kind,
    edit: {
      edits: action.edits.map((edit) => ({
        resource: uri,
        textEdit: {
          range: toMonacoRangeFromSource(edit.range),
          text: edit.newText
        },
        versionId: undefined
      }))
    },
    isPreferred: action.isPreferred
  };

  return codeAction;
}

function emptyCodeActionList(): monaco.languages.CodeActionList {
  return {
    actions: [],
    dispose: () => undefined
  };
}

function toMonacoFoldingRange(
  range: KickAssemblerFoldingRange
): monaco.languages.FoldingRange {
  const foldingRange: monaco.languages.FoldingRange = {
    start: range.startLine + 1,
    end: range.endLine + 1
  };

  if (range.kind === 'comment') {
    foldingRange.kind = monaco.languages.FoldingRangeKind.Comment;
  } else if (range.kind === 'imports') {
    foldingRange.kind = monaco.languages.FoldingRangeKind.Imports;
  } else {
    foldingRange.kind = monaco.languages.FoldingRangeKind.Region;
  }

  return foldingRange;
}

function encodeSemanticTokens(
  tokens: readonly KickAssemblerSemanticToken[],
  document: TextDocumentModel
): Uint32Array {
  const data: number[] = [];
  let previousLine = 0;
  let previousCharacter = 0;

  for (const token of tokens) {
    const typeIndex = KICK_ASSEMBLER_SEMANTIC_TOKEN_TYPES.indexOf(token.type);
    if (typeIndex < 0) {
      continue;
    }

    const modifierBits = semanticTokenModifierBits(token);
    for (const segment of semanticTokenSegments(token, document)) {
      if (segment.length <= 0) {
        continue;
      }

      const deltaLine = segment.line - previousLine;
      const deltaStart = deltaLine === 0
        ? segment.character - previousCharacter
        : segment.character;
      data.push(deltaLine, deltaStart, segment.length, typeIndex, modifierBits);
      previousLine = segment.line;
      previousCharacter = segment.character;
    }
  }

  return Uint32Array.from(data);
}

function semanticTokenSegments(
  token: KickAssemblerSemanticToken,
  document: TextDocumentModel
): Array<{ line: number; character: number; length: number }> {
  const { start, end } = token.location.range;
  if (start.line === end.line) {
    return [{
      line: start.line,
      character: start.character,
      length: end.character - start.character
    }];
  }

  const segments: Array<{ line: number; character: number; length: number }> = [];
  for (let line = start.line; line <= end.line; line += 1) {
    const lineText = document.lineAt(line);
    const character = line === start.line ? start.character : 0;
    const endCharacter = line === end.line ? end.character : lineText.length;
    segments.push({
      line,
      character,
      length: Math.max(0, endCharacter - character)
    });
  }
  return segments;
}

function semanticTokenModifierBits(token: KickAssemblerSemanticToken): number {
  let bits = 0;
  for (const modifier of token.modifiers) {
    const index = KICK_ASSEMBLER_SEMANTIC_TOKEN_MODIFIERS.indexOf(modifier);
    if (index >= 0) {
      bits |= 1 << index;
    }
  }
  return bits;
}

function toKickAssemblerDiagnostic(
  marker: monaco.editor.IMarkerData,
  uri: string
): KickAssemblerDiagnostic {
  return {
    code: String(marker.code ?? ''),
    message: marker.message,
    severity: toKickAssemblerSeverity(marker.severity),
    location: {
      uri,
      range: {
        start: {
          line: marker.startLineNumber - 1,
          character: marker.startColumn - 1
        },
        end: {
          line: marker.endLineNumber - 1,
          character: marker.endColumn - 1
        }
      }
    }
  };
}

function toKickAssemblerSeverity(
  severity: monaco.MarkerSeverity
): KickAssemblerDiagnostic['severity'] {
  if (severity === monaco.MarkerSeverity.Error) {
    return 'error';
  }
  if (severity === monaco.MarkerSeverity.Warning) {
    return 'warning';
  }
  return 'info';
}

function deduplicateOccurrences(
  occurrences: readonly KickAssemblerLookupOccurrence[]
): KickAssemblerLookupOccurrence[] {
  const unique = new Map<string, KickAssemblerLookupOccurrence>();

  for (const occurrence of occurrences) {
    const { start, end } = occurrence.location.range;
    const key = `${occurrence.location.uri}:${start.line}:${start.character}:${end.line}:${end.character}`;
    unique.set(key, occurrence);
  }

  return [...unique.values()];
}

function createLookupDocument(
  kind: KickAssemblerLookupDocument['kind'],
  uri: string,
  text: string,
  languageId?: string
): KickAssemblerLookupDocument {
  return {
    kind,
    document: createTextDocumentModel({ uri, text, languageId })
  };
}

function toMonacoCompletionItemKind(
  item: KickAssemblerCompletionItem
): monaco.languages.CompletionItemKind {
  switch (item.kind) {
    case 'directive':
      return monaco.languages.CompletionItemKind.Keyword;
    case 'include-path':
      return item.insertText.endsWith('/')
        ? monaco.languages.CompletionItemKind.Folder
        : monaco.languages.CompletionItemKind.File;
    case 'mnemonic':
      return monaco.languages.CompletionItemKind.Function;
    case 'addressing-mode':
      return monaco.languages.CompletionItemKind.Snippet;
    case 'symbol':
      return monaco.languages.CompletionItemKind.Variable;
  }
}

function toProtocolWorkspaceSymbol(
  symbol: KickAssemblerWorkspaceSymbol
): SymbolInformation {
  const location = toProtocolLocation(symbol.location);
  const info: SymbolInformation = {
    name: symbol.name,
    kind: toProtocolSymbolKind(symbol.kind),
    location
  };

  if (symbol.containerName) {
    info.containerName = symbol.containerName;
  }

  return info;
}

function toProtocolLocation(
  location: KickAssemblerWorkspaceSymbol['location']
): SymbolInformation['location'] {
  return {
    uri: location.uri,
    range: {
      start: location.range.start,
      end: location.range.end
    }
  };
}

function toProtocolSymbolKind(
  kind: KickAssemblerLookupKind
): ProtocolSymbolKind {
  switch (kind) {
    case 'namespace':
      return ProtocolSymbolKind.Namespace;
    case 'macro':
      return ProtocolSymbolKind.Method;
    case 'function':
      return ProtocolSymbolKind.Function;
    case 'pseudocommand':
      return ProtocolSymbolKind.Operator;
    case 'struct':
      return ProtocolSymbolKind.Struct;
    case 'enum':
      return ProtocolSymbolKind.Enum;
    case 'enum-member':
      return ProtocolSymbolKind.EnumMember;
    case 'constant':
      return ProtocolSymbolKind.Constant;
    case 'variable':
    case 'for-variable':
    case 'parameter':
      return ProtocolSymbolKind.Variable;
    case 'segment':
    case 'segment-definition':
      return ProtocolSymbolKind.Property;
    case '6502-mnemonic':
      return ProtocolSymbolKind.Function;
    case 'c64-io-address':
      return ProtocolSymbolKind.Number;
    case 'c64-io-id':
    case 'machine-io-id':
      return ProtocolSymbolKind.Constant;
    case 'machine-io-address':
    case 'machine-memory-address':
    case 'machine-zero-page':
      return ProtocolSymbolKind.Number;
    case 'machine-rom-symbol':
      return ProtocolSymbolKind.Function;
    case 'label':
    case 'local-label':
    case 'anonymous-label':
    case 'generated':
      return ProtocolSymbolKind.Field;
  }

  return ProtocolSymbolKind.Variable;
}

function addIncludeCandidate(
  candidates: Map<string, KickAssemblerIncludePathCandidate>,
  path: string,
  isDirectory: boolean,
  detail: string
): void {
  if (path.length === 0 || candidates.has(path)) {
    return;
  }

  candidates.set(path, {
    path,
    isDirectory,
    detail
  });
}

function addParentDirectoryCandidates(
  candidates: Map<string, KickAssemblerIncludePathCandidate>,
  path: string
): void {
  const parts = path.split('/');
  parts.pop();
  let current = '';

  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    addIncludeCandidate(candidates, current, true, 'Workspace directory');
  }
}

function toDocumentPosition(position: monaco.Position): DocumentPosition {
  return {
    line: position.lineNumber - 1,
    character: position.column - 1
  };
}

interface KickAssemblerLookupContext {
  document: TextDocumentModel;
  lookup: KickAssemblerLookupResult;
  token: KickAssemblerLookupTokenMatch;
}

// TODO(theia-ts-migration): Replace this on-demand file crawl with an
// incremental workspace/project service once the language-support index has a
// backend-neutral cache boundary.
