import * as React from 'react';

import {
  ApplicationShell,
  FrontendApplication,
  FrontendApplicationContribution,
  WidgetManager
} from '@theia/core/lib/browser';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { StatusBar, StatusBarAlignment } from '@theia/core/lib/browser/status-bar/status-bar';
import {
  TabBarToolbarContribution,
  TabBarToolbarRegistry
} from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import type {
  DeflatedContributedToolbarItem,
  ToolbarContribution
} from '@theia/toolbar/lib/browser/toolbar-interfaces';
import {
  Command,
  CommandContribution,
  CommandRegistry,
  DisposableCollection,
  Emitter,
  MenuContribution,
  MenuModelRegistry,
  SelectionService,
  UriSelection
} from '@theia/core/lib/common';
import { MessageService } from '@theia/core/lib/common/message-service';
import URI from '@theia/core/lib/common/uri';
import { EditorManager } from '@theia/editor/lib/browser';
import {
  FileService
} from '@theia/filesystem/lib/browser/file-service';
import { NavigatorContextMenu } from '@theia/navigator/lib/browser/navigator-contribution';
import { inject, injectable } from '@theia/core/shared/inversify';

import {
  SidScoreRuntimeService,
  type SidScoreExportFormat,
  type SidScoreHighlightStateEvent,
  type SidScoreInstrumentStateEvent,
  type SidScoreMidiDeviceListEvent,
  type SidScoreMidiStateEvent,
  type SidScorePlaybackStateEvent,
  type SidScoreProtocolErrorEvent,
  type SidScoreProtocolFrameEvent,
  type SidScoreRuntimeClient,
  type SidScoreRuntimeService as SidScoreRuntimeServiceProxy,
  type SidScoreScopeBucketsEvent,
  type SidScoreScopeSamplesEvent,
  type SidScoreScoreEvent,
  type SidScoreScoreMapEvent,
  type SidScoreServerOutputEvent,
  type SidScoreSongMetadata,
  type SidScoreSourceMapEntry,
  type SidScoreVoiceStateEvent
} from '../common/sidscore-runtime-service';
import {
  shouldTreatUnmatchedTerminalAsScorePlayback
} from '../common/sidscore-playback-routing';
import {
  extractSidScoreSubtuneCatalog,
  type SidScoreSubtuneInfo
} from '../common/sidscore-subtunes';
import {
  isSidScoreFileExtension
} from './sidscore-language-contribution';
import {
  SID_SCORE_WAVEFORM_WIDGET_ID,
  SidScoreWaveformWidget
} from './sidscore-waveform-widget';
import {
  SID_INSTRUMENT_CONTROL_WIDGET_ID,
  SidInstrumentControlWidget
} from './sid-instrument-control-widget';
import {
  SID_SCORE_PROTOCOL_LOG_WIDGET_ID,
  SidScoreProtocolLogWidget
} from './sidscore-protocol-log-widget';

const SID_SCORE_PLAY_STATUS_BAR_ID = 'commodoreCommander.sidscore.playStatus';
const SID_SCORE_STOP_STATUS_BAR_ID = 'commodoreCommander.sidscore.stopStatus';
export const SID_SCORE_EXPORT_TOOLBAR_ID =
  'commodoreCommander.sidscore.export.toolbar';

interface ScoreMapState {
  sourcesById: Map<number, SidScoreSourceMapEntry>;
  eventsById: Map<number, SidScoreScoreEvent>;
}

export namespace SidScoreRuntimeCommands {
  export const PLAY: Command = {
    id: 'commodoreCommander.sidscore.play',
    category: 'Commodore Commander',
    label: 'Play SIDScore',
    iconClass: 'codicon codicon-play'
  };
  export const PAUSE: Command = {
    id: 'commodoreCommander.sidscore.pause',
    category: 'Commodore Commander',
    label: 'Pause SIDScore',
    iconClass: 'codicon codicon-debug-pause'
  };
  export const CONTINUE: Command = {
    id: 'commodoreCommander.sidscore.continue',
    category: 'Commodore Commander',
    label: 'Resume SIDScore',
    iconClass: 'codicon codicon-debug-continue'
  };
  export const STOP: Command = {
    id: 'commodoreCommander.sidscore.stop',
    category: 'Commodore Commander',
    label: 'Stop SIDScore',
    iconClass: 'codicon codicon-debug-stop'
  };
  export const EXPORT_ASM: Command = {
    id: 'commodoreCommander.sidscore.exportAsm',
    category: 'Commodore Commander',
    label: 'Export SIDScore as ASM',
    iconClass: 'codicon codicon-export'
  };
  export const EXPORT_PRG: Command = {
    id: 'commodoreCommander.sidscore.exportPrg',
    category: 'Commodore Commander',
    label: 'Export SIDScore as PRG',
    iconClass: 'codicon codicon-export'
  };
  export const EXPORT_SID: Command = {
    id: 'commodoreCommander.sidscore.exportSid',
    category: 'Commodore Commander',
    label: 'Export SIDScore as SID',
    iconClass: 'codicon codicon-export'
  };
  export const EXPORT_WAV: Command = {
    id: 'commodoreCommander.sidscore.exportWav',
    category: 'Commodore Commander',
    label: 'Export SIDScore as WAV',
    iconClass: 'codicon codicon-export'
  };
}

@injectable()
export class SidScoreRuntimeContribution
  extends AbstractViewContribution<SidScoreWaveformWidget>
  implements
    CommandContribution,
    MenuContribution,
    ToolbarContribution,
    TabBarToolbarContribution,
    FrontendApplicationContribution,
    SidScoreRuntimeClient
{
  readonly id = SID_SCORE_EXPORT_TOOLBAR_ID;

  @inject(SidScoreRuntimeService)
  protected readonly sidScoreRuntimeService!: SidScoreRuntimeServiceProxy;

  @inject(EditorManager)
  protected readonly editorManager!: EditorManager;

  @inject(FileService)
  protected readonly fileService!: FileService;

  @inject(MessageService)
  protected readonly messageService!: MessageService;

  @inject(SelectionService)
  protected readonly selectionService!: SelectionService;

  @inject(StatusBar)
  protected readonly statusBar!: StatusBar;

  @inject(WidgetManager)
  protected readonly widgetManager!: WidgetManager;

  @inject(ApplicationShell)
  protected readonly shell!: ApplicationShell;

  protected readonly toDispose = new DisposableCollection();
  protected readonly scoreMaps = new Map<string, ScoreMapState>();
  protected readonly decorationIdsByEditorUri = new Map<string, string[]>();
  protected readonly toolbarDidChangeEmitter = new Emitter<void>();
  readonly onDidChange = this.toolbarDidChangeEmitter.event;
  protected playbackState: SidScorePlaybackStateEvent['state'] = 'idle';
  protected playbackLabel = 'Idle';
  protected songMetadata: SidScoreSongMetadata | undefined;
  protected scorePlaybackRequestId: number | undefined;
  protected scorePlaybackScoreId: string | undefined;
  protected nextScorePlaybackRequestId = 0x4000_0000;
  protected currentScoreResource: URI | undefined;
  protected exportInProgress = false;
  protected selectedSubtune = 1;
  protected subtunes: readonly SidScoreSubtuneInfo[] = [
    {
      number: 1,
      source: 'main'
    }
  ];

  constructor() {
    super({
      widgetId: SID_SCORE_WAVEFORM_WIDGET_ID,
      widgetName: 'SIDScore',
      defaultWidgetOptions: {
        area: 'bottom'
      },
      toggleCommandId: 'commodoreCommander.sidscore.toggleWaveforms'
    });
  }

  onStart(): void {
    this.sidScoreRuntimeService.setClient(this);
    this.configureWaveformWidget();
    this.toDispose.push(
      this.editorManager.onCurrentEditorChanged(() => {
        this.toolbarDidChangeEmitter.fire();
        void this.updatePlayStatusBar();
        void this.refreshSubtunesForActiveResource();
      })
    );
    this.toDispose.push(this.toolbarDidChangeEmitter);
    void this.updatePlayStatusBar();
    void this.refreshSubtunesForActiveResource();
  }

  async onDidInitializeLayout(_app: FrontendApplication): Promise<void> {
    this.configureWaveformWidget(await this.openView({ reveal: true }));
    void this.refreshSubtunesForActiveResource();
  }

  onStop(): void {
    this.toDispose.dispose();
    this.sidScoreRuntimeService.setClient(undefined);
    this.clearEditorHighlights();
    void this.statusBar.removeElement(SID_SCORE_PLAY_STATUS_BAR_ID);
    void this.statusBar.removeElement(SID_SCORE_STOP_STATUS_BAR_ID);
  }

  toJSON(): DeflatedContributedToolbarItem {
    return {
      id: this.id,
      group: 'contributed'
    };
  }

  render(): React.ReactNode {
    return this.renderExportToolbarItem();
  }

  override registerCommands(commands: CommandRegistry): void {
    super.registerCommands(commands);
    commands.registerCommand(SidScoreRuntimeCommands.PLAY, {
      execute: (resource?: unknown) => this.play(resource),
      isEnabled: (resource?: unknown) =>
        Boolean(this.getSidScoreResource(resource)),
      isVisible: (resource?: unknown) =>
        Boolean(this.getSidScoreResource(resource))
    });
    commands.registerCommand(SidScoreRuntimeCommands.PAUSE, {
      execute: () => this.pause(),
      isEnabled: () => this.playbackState === 'playing',
      isVisible: () => true
    });
    commands.registerCommand(SidScoreRuntimeCommands.CONTINUE, {
      execute: () => this.resume(),
      isEnabled: () => this.playbackState === 'paused',
      isVisible: () => true
    });
    commands.registerCommand(SidScoreRuntimeCommands.STOP, {
      execute: () => this.stop(),
      isEnabled: () =>
        this.playbackState === 'playing' ||
        this.playbackState === 'paused' ||
        this.playbackState === 'loading',
      isVisible: () => true
    });
    commands.registerCommand(SidScoreRuntimeCommands.EXPORT_ASM, {
      execute: () => this.exportActiveScore('asm'),
      isEnabled: () =>
        Boolean(this.getActiveEditorSidScoreResource()) && !this.exportInProgress,
      isVisible: () => true
    });
    commands.registerCommand(SidScoreRuntimeCommands.EXPORT_PRG, {
      execute: () => this.exportActiveScore('prg'),
      isEnabled: () =>
        Boolean(this.getActiveEditorSidScoreResource()) && !this.exportInProgress,
      isVisible: () => true
    });
    commands.registerCommand(SidScoreRuntimeCommands.EXPORT_SID, {
      execute: () => this.exportActiveScore('sid'),
      isEnabled: () =>
        Boolean(this.getActiveEditorSidScoreResource()) && !this.exportInProgress,
      isVisible: () => true
    });
    commands.registerCommand(SidScoreRuntimeCommands.EXPORT_WAV, {
      execute: () => this.exportActiveScore('wav'),
      isEnabled: () =>
        Boolean(this.getActiveEditorSidScoreResource()) && !this.exportInProgress,
      isVisible: () => true
    });
  }

  override registerMenus(menus: MenuModelRegistry): void {
    super.registerMenus(menus);
    menus.registerMenuAction(NavigatorContextMenu.NAVIGATION, {
      commandId: SidScoreRuntimeCommands.PLAY.id,
      label: SidScoreRuntimeCommands.PLAY.label,
      order: '2'
    });
  }

  registerToolbarItems(toolbar: TabBarToolbarRegistry): void {
    toolbar.registerItem({
      id: 'commodoreCommander.sidscore.subtune.toolbar',
      render: () => this.renderSubtuneToolbarItem(),
      priority: -1,
      onDidChange: this.toolbarDidChangeEmitter.event,
      isVisible: (widget) => widget?.id === SID_SCORE_WAVEFORM_WIDGET_ID
    });
    toolbar.registerItem({
      id: `${SidScoreRuntimeCommands.PLAY.id}.toolbar`,
      command: SidScoreRuntimeCommands.PLAY.id,
      text: '$(play)',
      tooltip: 'Play SIDScore',
      priority: 0,
      onDidChange: this.toolbarDidChangeEmitter.event,
      isVisible: (widget) => widget?.id === SID_SCORE_WAVEFORM_WIDGET_ID
    });
    toolbar.registerItem({
      id: `${SidScoreRuntimeCommands.PAUSE.id}.toolbar`,
      command: SidScoreRuntimeCommands.PAUSE.id,
      text: '$(debug-pause)',
      tooltip: 'Pause SIDScore',
      priority: 1,
      onDidChange: this.toolbarDidChangeEmitter.event,
      isVisible: (widget) => widget?.id === SID_SCORE_WAVEFORM_WIDGET_ID
    });
    toolbar.registerItem({
      id: `${SidScoreRuntimeCommands.CONTINUE.id}.toolbar`,
      command: SidScoreRuntimeCommands.CONTINUE.id,
      text: '$(debug-continue)',
      tooltip: 'Resume SIDScore',
      priority: 2,
      onDidChange: this.toolbarDidChangeEmitter.event,
      isVisible: (widget) => widget?.id === SID_SCORE_WAVEFORM_WIDGET_ID
    });
    toolbar.registerItem({
      id: `${SidScoreRuntimeCommands.STOP.id}.toolbar`,
      command: SidScoreRuntimeCommands.STOP.id,
      text: '$(debug-stop)',
      tooltip: 'Stop SIDScore',
      priority: 3,
      onDidChange: this.toolbarDidChangeEmitter.event,
      isVisible: (widget) => widget?.id === SID_SCORE_WAVEFORM_WIDGET_ID
    });
  }

  onSidScorePlaybackState(event: SidScorePlaybackStateEvent): void {
    const scorePlaybackEvent = this.shouldHandleAsScorePlaybackStateEvent(event);
    this.syncInstrumentScorePlaybackState(event, scorePlaybackEvent);
    if (!scorePlaybackEvent) {
      return;
    }

    this.playbackState = event.state;
    this.playbackLabel = formatPlaybackLabel(event);
    this.toolbarDidChangeEmitter.fire();
    const widget = this.tryGetWidget();
    widget?.setPlaybackLabel(this.playbackLabel);
    this.syncSubtuneToolbar(widget);
    if (
      event.state === 'idle' ||
      event.state === 'stopped' ||
      event.state === 'ended' ||
      event.state === 'error'
    ) {
      this.songMetadata = undefined;
      this.clearEditorHighlights();
      widget?.clear(this.playbackLabel);
    }
    void this.updatePlayStatusBar();
  }

  onSidScoreScoreMap(event: SidScoreScoreMapEvent): void {
    this.scoreMaps.set(event.scoreId, {
      sourcesById: new Map(event.sources.map((source) => [source.sourceId, source])),
      eventsById: new Map(event.events.map((scoreEvent) => [scoreEvent.eventId, scoreEvent]))
    });
  }

  onSidScoreHighlightState(event: SidScoreHighlightStateEvent): void {
    this.applyHighlightState(event);
  }

  onSidScoreVoiceState(event: SidScoreVoiceStateEvent): void {
    this.tryGetWidget()?.setVoiceState(event);
  }

  onSidScoreScopeBuckets(event: SidScoreScopeBucketsEvent): void {
    this.tryGetWidget()?.setScopeBuckets(event);
  }

  onSidScoreScopeSamples(event: SidScoreScopeSamplesEvent): void {
    this.tryGetWidget()?.setScopeSamples(event);
  }

  onSidScoreInstrumentState(event: SidScoreInstrumentStateEvent): void {
    this.getInstrumentWidget()?.setInstrumentState(event);
  }

  onSidScoreMidiDeviceList(event: SidScoreMidiDeviceListEvent): void {
    this.getInstrumentWidget()?.setMidiDeviceList(event);
  }

  onSidScoreMidiState(event: SidScoreMidiStateEvent): void {
    this.getInstrumentWidget()?.setMidiState(event);
  }

  onSidScoreProtocolFrame(event: SidScoreProtocolFrameEvent): void {
    this.getProtocolLogWidget()?.appendFrame(event);
  }

  onSidScoreProtocolError(event: SidScoreProtocolErrorEvent): void {
    this.messageService.error(`SIDScore server error: ${event.message}`);
  }

  onSidScoreServerOutput(event: SidScoreServerOutputEvent): void {
    const output = event.output.trim();
    if (output.length > 0) {
      console.debug(`SIDScore server ${event.stream}: ${output}`);
      this.getProtocolLogWidget()?.appendServerOutput(event);
    }
  }

  onSidScoreServerStopped(): void {
    this.playbackState = 'idle';
    this.playbackLabel = 'Idle';
    this.songMetadata = undefined;
    this.scorePlaybackRequestId = undefined;
    this.scorePlaybackScoreId = undefined;
    this.getInstrumentWidget()?.setScorePlaybackActive(false, false);
    this.toolbarDidChangeEmitter.fire();
    this.clearEditorHighlights();
    const widget = this.tryGetWidget();
    widget?.clear();
    this.syncSubtuneToolbar(widget);
    void this.updatePlayStatusBar();
  }

  protected async play(resource?: unknown, subtune?: number): Promise<void> {
    const resourceUri = this.getSidScoreResource(resource);
    if (!resourceUri) {
      this.messageService.warn('Select a .sidscore file before playing.');
      return;
    }

    try {
      const sourceText = await this.refreshSubtunes(resourceUri, true);
      if (sourceText === undefined) {
        return;
      }

      const selectedSubtune = normalizeSubtuneNumber(
        subtune ?? this.selectedSubtune
      );
      if (this.subtunes.some((entry) => entry.number === selectedSubtune)) {
        this.selectedSubtune = selectedSubtune;
      }
      this.playbackState = 'loading';
      this.playbackLabel = `loading subtune ${selectedSubtune}`;
      this.songMetadata = undefined;
      this.toolbarDidChangeEmitter.fire();
      this.tryGetWidget()?.clear(this.playbackLabel);
      this.syncSubtuneToolbar();
      void this.updatePlayStatusBar();
      const requestId = this.nextScorePlaybackRequestIdValue();
      this.scorePlaybackRequestId = requestId;
      this.scorePlaybackScoreId = undefined;
      const instrumentWidget = await this.openInstrumentWidgetForScorePlayback();
      instrumentWidget?.setScorePlaybackActive(true, false);
      await instrumentWidget?.prepareMidiForScorePlayback();
      const result = await this.sidScoreRuntimeService.play({
        resourceUri: resourceUri.toString(),
        requestId,
        sidModel: instrumentWidget?.getSidModel(),
        subtune: selectedSubtune,
        ...(sourceText !== undefined ? { sourceText } : {})
      });
      this.songMetadata = result.songMetadata;
      this.tryGetWidget()?.setSongMetadata(this.songMetadata);
      this.selectedSubtune = result.subtune;
      this.syncSubtuneToolbar();
      void this.openWaveformView().catch((error) => {
        console.warn('Unable to open SIDScore waveform view.', error);
      });
    } catch (error) {
      this.playbackState = 'idle';
      this.playbackLabel = 'Idle';
      this.songMetadata = undefined;
      this.scorePlaybackRequestId = undefined;
      this.scorePlaybackScoreId = undefined;
      this.getInstrumentWidget()?.setScorePlaybackActive(false);
      this.toolbarDidChangeEmitter.fire();
      this.syncSubtuneToolbar();
      void this.updatePlayStatusBar();
      const message =
        error instanceof Error ? error.message : 'Unknown SIDScore playback failure.';
      this.messageService.error(`Could not play SIDScore: ${message}`);
    }
  }

  protected async exportActiveScore(format: SidScoreExportFormat): Promise<void> {
    const resourceUri = this.getActiveEditorSidScoreResource();
    if (!resourceUri) {
      this.messageService.warn('Open a .sidscore file before exporting.');
      return;
    }

    try {
      const sourceText = await this.refreshSubtunes(resourceUri, true);
      if (sourceText === undefined) {
        return;
      }

      this.exportInProgress = true;
      this.toolbarDidChangeEmitter.fire();
      const selectedSubtune = normalizeSubtuneNumber(this.selectedSubtune);
      const outputUri = toSidScoreExportOutputUri(resourceUri, format);
      const result = await this.sidScoreRuntimeService.exportScore({
        resourceUri: resourceUri.toString(),
        outputUri: outputUri.toString(),
        format,
        sidModel: this.getInstrumentWidget()?.getSidModel(),
        subtune: selectedSubtune,
        sourceText
      });
      this.messageService.info(
        `Exported ${resourceUri.path.base} to ${result.outputPath} (${formatExportByteLength(result.outputByteLength)}).`
      );
    } catch (error) {
      this.messageService.error(
        `Could not export SIDScore: ${toErrorMessage(error)}`
      );
    } finally {
      this.exportInProgress = false;
      this.toolbarDidChangeEmitter.fire();
    }
  }

  protected async refreshSubtunesForActiveResource(): Promise<void> {
    const resourceUri = this.getActiveEditorSidScoreResource();
    if (!resourceUri) {
      this.currentScoreResource = undefined;
      this.subtunes = [
        {
          number: 1,
          source: 'main'
        }
      ];
      this.selectedSubtune = 1;
      this.syncSubtuneToolbar();
      return;
    }

    await this.refreshSubtunes(resourceUri);
  }

  protected async refreshSubtunes(
    resourceUri: URI,
    reportErrors = false
  ): Promise<string | undefined> {
    if (resourceUri.scheme !== 'file' || !isSidScoreFileExtension(resourceUri.path.ext)) {
      if (reportErrors) {
        this.messageService.warn('Choose a .sidscore file.');
      }
      return undefined;
    }

    try {
      const sourceText =
        this.getOpenEditorSourceText(resourceUri) ??
        (await this.fileService.read(resourceUri, {
          acceptTextOnly: true
        })).value;
      const catalog = extractSidScoreSubtuneCatalog(sourceText);
      const sameResource =
        this.currentScoreResource?.toString() === resourceUri.toString();
      const currentSubtune = catalog.subtunes.some(
        (subtune) => subtune.number === this.selectedSubtune
      ) && sameResource
        ? this.selectedSubtune
        : catalog.defaultSubtune;

      this.currentScoreResource = resourceUri;
      this.subtunes = catalog.subtunes;
      this.selectedSubtune = currentSubtune;
      this.syncSubtuneToolbar();
      return sourceText;
    } catch (error) {
      if (reportErrors) {
        this.messageService.error(
          `Could not read SIDScore subtunes: ${toErrorMessage(error)}`
        );
      } else {
        console.warn('Could not read SIDScore subtunes.', error);
      }
      return undefined;
    }
  }

  protected selectSubtune(subtune: number): void {
    const selected = normalizeSubtuneNumber(subtune);
    if (
      selected === this.selectedSubtune ||
      !this.subtunes.some((entry) => entry.number === selected)
    ) {
      return;
    }

    this.selectedSubtune = selected;
    this.syncSubtuneToolbar();
  }

  protected async pause(): Promise<void> {
    try {
      await this.sidScoreRuntimeService.pause();
    } catch (error) {
      this.messageService.error(`Could not pause SIDScore: ${toErrorMessage(error)}`);
    }
  }

  protected async resume(): Promise<void> {
    try {
      await this.sidScoreRuntimeService.resume();
    } catch (error) {
      this.messageService.error(`Could not continue SIDScore: ${toErrorMessage(error)}`);
    }
  }

  protected async stop(): Promise<void> {
    try {
      await this.sidScoreRuntimeService.stop();
      this.applyLocalStoppedPlaybackState();
    } catch (error) {
      this.messageService.error(`Could not stop SIDScore: ${toErrorMessage(error)}`);
    }
  }

  protected applyLocalStoppedPlaybackState(): void {
    this.playbackState = 'stopped';
    this.playbackLabel = 'stopped';
    this.songMetadata = undefined;
    this.scorePlaybackRequestId = undefined;
    this.scorePlaybackScoreId = undefined;
    this.getInstrumentWidget()?.setScorePlaybackActive(false);
    this.toolbarDidChangeEmitter.fire();
    this.clearEditorHighlights();
    const widget = this.tryGetWidget();
    widget?.clear(this.playbackLabel);
    this.syncSubtuneToolbar(widget);
    void this.updatePlayStatusBar();
  }

  protected async openWaveformView(): Promise<SidScoreWaveformWidget | undefined> {
    const widget = await this.openView({ reveal: true });
    this.configureWaveformWidget(widget);
    return widget;
  }

  protected async openInstrumentWidgetForScorePlayback(): Promise<
    SidInstrumentControlWidget | undefined
  > {
    const widget = await this.widgetManager.getOrCreateWidget<
      SidInstrumentControlWidget
    >(SID_INSTRUMENT_CONTROL_WIDGET_ID);
    if (!widget.isAttached) {
      await this.shell.addWidget(widget, { area: 'right', rank: 120 });
    }

    this.shell.expandPanel('right');
    await this.shell.revealWidget(widget.id);
    await widget.initializeMidiDevices();
    return widget;
  }

  protected configureWaveformWidget(
    widget: SidScoreWaveformWidget | undefined = this.tryGetWidget()
  ): void {
    if (!widget) {
      return;
    }
    widget.setPlaybackLabel(this.playbackLabel);
    widget.setSongMetadata(this.songMetadata);
    this.syncSubtuneToolbar(widget);
  }

  protected syncSubtuneToolbar(
    _widget: SidScoreWaveformWidget | undefined = this.tryGetWidget()
  ): void {
    this.toolbarDidChangeEmitter.fire();
  }

  protected syncInstrumentScorePlaybackState(
    event: SidScorePlaybackStateEvent,
    scorePlaybackEvent = this.isScorePlaybackStateEvent(event)
  ): void {
    if (!scorePlaybackEvent) {
      return;
    }

    if (
      event.state === 'loading' ||
      event.state === 'playing' ||
      event.state === 'paused'
    ) {
      this.scorePlaybackScoreId = event.scoreId;
      this.getInstrumentWidget()?.setScorePlaybackActive(true, false);
      return;
    }

    if (
      event.state === 'idle' ||
      event.state === 'stopped' ||
      event.state === 'ended' ||
      event.state === 'error'
    ) {
      this.scorePlaybackRequestId = undefined;
      this.scorePlaybackScoreId = undefined;
      this.getInstrumentWidget()?.setScorePlaybackActive(false);
    }
  }

  protected isScorePlaybackStateEvent(event: SidScorePlaybackStateEvent): boolean {
    return (
      (
        this.scorePlaybackRequestId !== undefined &&
        event.requestId === this.scorePlaybackRequestId
      ) ||
      (
        this.scorePlaybackScoreId !== undefined &&
        event.scoreId === this.scorePlaybackScoreId
      )
    );
  }

  protected shouldHandleAsScorePlaybackStateEvent(
    event: SidScorePlaybackStateEvent
  ): boolean {
    return (
      this.isScorePlaybackStateEvent(event) ||
      this.isUnmatchedTerminalScorePlaybackStateEvent(event)
    );
  }

  protected isUnmatchedTerminalScorePlaybackStateEvent(
    event: SidScorePlaybackStateEvent
  ): boolean {
    // The SIDScore server can report normal score completion with request id 0,
    // then immediately switch to a separate MIDI monitor score. If that terminal
    // frame misses the strict request/score id match, the instrument widget would
    // keep scorePlaybackActive=true and continue sending MIDI settings with
    // enabled=false. Treat one unmatched terminal frame as belonging to the active
    // score so Instrument mode can re-arm MIDI after song playback. Do not apply
    // that fallback while a new score is still loading; an ending SFX preview can
    // otherwise race with a fresh Play request and mark the new score as ended.
    return shouldTreatUnmatchedTerminalAsScorePlayback(
      event,
      this.playbackState,
      this.scorePlaybackRequestId !== undefined ||
        this.scorePlaybackScoreId !== undefined
    );
  }

  protected nextScorePlaybackRequestIdValue(): number {
    const requestId = this.nextScorePlaybackRequestId;
    this.nextScorePlaybackRequestId =
      this.nextScorePlaybackRequestId >= 0x7fff_ffff
        ? 0x4000_0000
        : this.nextScorePlaybackRequestId + 1;
    return requestId;
  }

  protected renderSubtuneToolbarItem(): React.ReactNode {
    const subtunes = this.subtunes.length > 0
      ? this.subtunes
      : [{ number: 1, source: 'main' as const }];
    const selectedSubtune = subtunes.some(
      (subtune) => subtune.number === this.selectedSubtune
    )
      ? this.selectedSubtune
      : subtunes[0].number;

    return React.createElement(
      'label',
      {
        key: 'commodoreCommander.sidscore.subtune.toolbar',
        onClick: stopToolbarEvent,
        onMouseDown: stopToolbarEvent,
        style: {
          alignItems: 'center',
          display: 'inline-flex',
          gap: '5px',
          height: '22px',
          padding: '0 4px'
        },
        title: 'SIDScore subtune'
      },
      React.createElement(
        'span',
        {
          style: {
            color: 'var(--theia-descriptionForeground)',
            flexShrink: 0,
            fontSize: '12px'
          }
        },
        'Subtune'
      ),
      React.createElement(
        'select',
        {
          'aria-label': 'SIDScore subtune',
          disabled: !this.currentScoreResource,
          onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
            this.selectSubtune(Number.parseInt(event.currentTarget.value, 10)),
          style: {
            background: 'var(--theia-dropdown-background)',
            border: '1px solid var(--theia-dropdown-border)',
            color: 'var(--theia-dropdown-foreground)',
            fontSize: '12px',
            height: '22px',
            maxWidth: '320px',
            width: '260px'
          },
          value: selectedSubtune
        },
        subtunes.map((subtune) =>
          React.createElement(
            'option',
            {
              key: subtune.number,
              value: subtune.number
            },
            formatSubtuneOption(subtune)
          )
        )
      )
    );
  }

  protected renderExportToolbarItem(): React.ReactNode {
    const resourceUri = this.getActiveEditorSidScoreResource();
    const disabled = !resourceUri || this.exportInProgress;
    const title = resourceUri
      ? `Export ${resourceUri.path.base} with SIDScore player server`
      : 'Open a SIDScore file to export';

    return React.createElement(
      'label',
      {
        key: SID_SCORE_EXPORT_TOOLBAR_ID,
        onClick: stopToolbarEvent,
        onMouseDown: stopToolbarEvent,
        style: {
          alignItems: 'center',
          display: 'inline-flex',
          gap: '5px',
          height: '24px',
          padding: '0 4px'
        },
        title
      },
      React.createElement('span', {
        className: 'codicon codicon-export',
        style: {
          color: disabled
            ? 'var(--theia-disabledForeground)'
            : 'var(--theia-foreground)',
          flexShrink: 0
        }
      }),
      React.createElement(
        'select',
        {
          'aria-label': 'Export SIDScore',
          disabled,
          onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
            const format = event.currentTarget.value as SidScoreExportFormat;
            event.currentTarget.value = '';
            if (format) {
              void this.exportActiveScore(format);
            }
          },
          style: {
            background: 'var(--theia-dropdown-background)',
            border: '1px solid var(--theia-dropdown-border)',
            color: disabled
              ? 'var(--theia-disabledForeground)'
              : 'var(--theia-dropdown-foreground)',
            fontSize: '12px',
            height: '22px',
            width: '112px'
          },
          value: ''
        },
        React.createElement(
          'option',
          {
            value: ''
          },
          this.exportInProgress ? 'Exporting...' : 'Export...'
        ),
        React.createElement(
          'option',
          {
            value: 'asm'
          },
          'ASM'
        ),
        React.createElement(
          'option',
          {
            value: 'prg'
          },
          'PRG'
        ),
        React.createElement(
          'option',
          {
            value: 'sid'
          },
          'SID (PSID)'
        ),
        React.createElement(
          'option',
          {
            value: 'wav'
          },
          'WAV'
        )
      )
    );
  }

  protected async updatePlayStatusBar(): Promise<void> {
    const resourceUri = this.getSidScoreResource();
    if (!resourceUri) {
      await this.statusBar.removeElement(SID_SCORE_PLAY_STATUS_BAR_ID);
    } else {
      await this.statusBar.setElement(SID_SCORE_PLAY_STATUS_BAR_ID, {
        text: '$(play) Play',
        alignment: StatusBarAlignment.LEFT,
        priority: 90,
        command: SidScoreRuntimeCommands.PLAY.id,
        tooltip: `Play ${resourceUri.path.base} with SIDScore player server`
      });
    }

    if (
      this.playbackState === 'playing' ||
      this.playbackState === 'paused' ||
      this.playbackState === 'loading'
    ) {
      await this.statusBar.setElement(SID_SCORE_STOP_STATUS_BAR_ID, {
        text: '$(debug-stop) Stop',
        alignment: StatusBarAlignment.LEFT,
        priority: 89,
        command: SidScoreRuntimeCommands.STOP.id,
        tooltip: 'Stop SIDScore playback'
      });
    } else {
      await this.statusBar.removeElement(SID_SCORE_STOP_STATUS_BAR_ID);
    }
  }

  protected applyHighlightState(event: SidScoreHighlightStateEvent): void {
    const scoreMap = this.scoreMaps.get(event.scoreId);
    if (!scoreMap) {
      return;
    }

    const decorationsBySourceUri = new Map<string, ReturnType<typeof toEditorDecoration>[]>();
    for (const [voiceOffset, eventId] of event.activeEventIds.entries()) {
      if (eventId < 0) {
        continue;
      }
      const scoreEvent = scoreMap.eventsById.get(eventId);
      if (!scoreEvent) {
        continue;
      }
      const source = scoreMap.sourcesById.get(scoreEvent.sourceId);
      if (!source) {
        continue;
      }
      const sourceUri = normalizeUri(source.resourceUri);
      const decorations = decorationsBySourceUri.get(sourceUri) ?? [];
      decorations.push(toEditorDecoration(scoreEvent, voiceOffset + 1));
      decorationsBySourceUri.set(sourceUri, decorations);
    }

    for (const editorWidget of this.editorManager.all) {
      const editorUri = editorWidget.editor.uri.toString();
      const oldDecorations = this.decorationIdsByEditorUri.get(editorUri) ?? [];
      const newDecorations = decorationsBySourceUri.get(editorUri) ?? [];
      const decorationIds = editorWidget.editor.deltaDecorations({
        oldDecorations,
        newDecorations
      });
      if (decorationIds.length > 0) {
        this.decorationIdsByEditorUri.set(editorUri, decorationIds);
      } else {
        this.decorationIdsByEditorUri.delete(editorUri);
      }
    }
  }

  protected clearEditorHighlights(): void {
    for (const editorWidget of this.editorManager.all) {
      const editorUri = editorWidget.editor.uri.toString();
      const oldDecorations = this.decorationIdsByEditorUri.get(editorUri);
      if (!oldDecorations) {
        continue;
      }
      editorWidget.editor.deltaDecorations({
        oldDecorations,
        newDecorations: []
      });
    }
    this.decorationIdsByEditorUri.clear();
  }

  protected getSidScoreResource(resource?: unknown): URI | undefined {
    const resourceUri =
      toUri(resource) ??
      UriSelection.getUri(this.selectionService.selection) ??
      this.editorManager.currentEditor?.editor.uri;

    if (!resourceUri || resourceUri.scheme !== 'file') {
      return undefined;
    }

    return isSidScoreFileExtension(resourceUri.path.ext)
      ? resourceUri
      : undefined;
  }

  protected getActiveEditorSidScoreResource(): URI | undefined {
    const resourceUri = this.editorManager.currentEditor?.editor.uri;

    if (!resourceUri || resourceUri.scheme !== 'file') {
      return undefined;
    }

    return isSidScoreFileExtension(resourceUri.path.ext)
      ? resourceUri
      : undefined;
  }

  protected getOpenEditorSourceText(resourceUri: URI): string | undefined {
    const normalizedResourceUri = resourceUri.toString();
    for (const editorWidget of this.editorManager.all) {
      if (editorWidget.editor.uri.toString() === normalizedResourceUri) {
        return editorWidget.editor.document.getText();
      }
    }
    return undefined;
  }

  protected getInstrumentWidget(): SidInstrumentControlWidget | undefined {
    return this.widgetManager.tryGetWidget<SidInstrumentControlWidget>(
      SID_INSTRUMENT_CONTROL_WIDGET_ID
    );
  }

  protected getProtocolLogWidget(): SidScoreProtocolLogWidget | undefined {
    return this.widgetManager.tryGetWidget<SidScoreProtocolLogWidget>(
      SID_SCORE_PROTOCOL_LOG_WIDGET_ID
    );
  }
}

function toEditorDecoration(scoreEvent: SidScoreScoreEvent, voiceIndex: number) {
  const startLine = Math.max(0, scoreEvent.startLine - 1);
  const startCharacter = Math.max(0, scoreEvent.startColumn - 1);
  let endLine = Math.max(0, scoreEvent.endLine - 1);
  let endCharacter = Math.max(0, scoreEvent.endColumn - 1);
  if (endLine < startLine || (endLine === startLine && endCharacter <= startCharacter)) {
    endLine = startLine;
    endCharacter = startCharacter + Math.max(1, scoreEvent.displayText.length);
  }

  return {
    range: {
      start: {
        line: startLine,
        character: startCharacter
      },
      end: {
        line: endLine,
        character: endCharacter
      }
    },
    options: {
      className: `cc-sidscore-highlight cc-sidscore-highlight-voice-${voiceIndex}`,
      hoverMessage: `Voice ${voiceIndex}: ${scoreEvent.displayText}`
    }
  };
}

function formatPlaybackLabel(event: SidScorePlaybackStateEvent): string {
  const frame = event.frameIndex !== '0' ? ` frame ${event.frameIndex}` : '';
  return `${event.state}${frame}`;
}

function normalizeUri(uri: string): string {
  try {
    return new URI(uri).toString();
  } catch {
    return uri;
  }
}

function toUri(resource: unknown): URI | undefined {
  if (resource instanceof URI) {
    return resource;
  }

  return UriSelection.getUri(resource);
}

function normalizeSubtuneNumber(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(255, Math.max(1, Math.trunc(value)));
}

function formatSubtuneOption(subtune: SidScoreSubtuneInfo): string {
  const detail = subtune.title ?? subtune.path;
  return detail ? `${subtune.number} - ${detail}` : `${subtune.number}`;
}

function toSidScoreExportOutputUri(
  resourceUri: URI,
  format: SidScoreExportFormat
): URI {
  return resourceUri.withPath(
    resourceUri.path.dir.join(`${resourceUri.path.name}.${format}`)
  );
}

function formatExportByteLength(value: string): string {
  const bytes = Number.parseInt(value, 10);
  return Number.isFinite(bytes)
    ? `${bytes.toLocaleString()} bytes`
    : `${value} bytes`;
}

function stopToolbarEvent(event: React.SyntheticEvent): void {
  event.stopPropagation();
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
