import {
  FrontendApplicationContribution,
  WebSocketConnectionProvider,
  WidgetFactory
} from '@theia/core/lib/browser';
import { ColorContribution } from '@theia/core/lib/browser/color-application-contribution';
import {
  OpenHandler
} from '@theia/core/lib/browser/opener-service';
import { StylingParticipant } from '@theia/core/lib/browser/styling-service';
import {
  CommandContribution,
  MenuContribution,
  ResourceResolver
} from '@theia/core/lib/common';
import {
  Agent,
  bindToolProvider
} from '@theia/ai-core';
import {
  ChatAgent
} from '@theia/ai-chat';
import URI from '@theia/core/lib/common/uri';
import {
  PreferenceContribution
} from '@theia/core/lib/common/preferences';
import { bindViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { TabBarToolbarContribution } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { ContainerModule } from '@theia/core/shared/inversify';
import {
  ToolbarAlignment,
  ToolbarContribution
} from '@theia/toolbar/lib/browser/toolbar-interfaces';
import {
  ToolbarDefaults,
  ToolbarDefaultsFactory
} from '@theia/toolbar/lib/browser/toolbar-defaults';
import { TaskContribution } from '@theia/task/lib/browser/task-contribution';
import { GettingStartedWidget } from '@theia/getting-started/lib/browser/getting-started-widget';
import { MonacoThemingService } from '@theia/monaco/lib/browser/monaco-theming-service';
import { LanguageGrammarDefinitionContribution } from '@theia/monaco/lib/browser/textmate/textmate-contribution';
import { PreviewHandler } from '@theia/preview/lib/browser/preview-handler';
import { PreviewLinkNormalizer } from '@theia/preview/lib/browser/preview-link-normalizer';
import { DebugContribution } from '@theia/debug/lib/browser/debug-contribution';
import { BreakpointManager } from '@theia/debug/lib/browser/breakpoint/breakpoint-manager';

import {
  KickAssemblerBuildService,
  KickAssemblerBuildServicePath
} from '../common/kick-assembler-build-service';
import {
  COMMODORE_COMMANDER_TOOL_PREFERENCE_BINDING
} from '../common/commodore-commander-tool-preferences';
import {
  CommodorePrgService,
  CommodorePrgServicePath
} from '../common/commodore-prg-service';
import {
  CommodoreViceEmbedService,
  CommodoreViceEmbedServicePath
} from '../common/commodore-vice-embed-service';
import { CommodoreCommanderFrontendContribution } from './commodore-commander-frontend-contribution';
import { CommodoreCommanderGettingStartedWidget } from './commodore-commander-getting-started-widget';
import {
  CommodoreCommanderThemeStyleParticipant,
  CommodoreCommanderThemingService
} from './commodore-commander-theme';
import {
  CommodoreCommanderBundledDocumentationContribution,
  CommodoreCommanderBundledDocumentationEditorContribution,
  CommodoreCommanderBundledDocumentationImagePreviewHandler,
  CommodoreCommanderBundledDocumentationLinkNormalizer,
  CommodoreCommanderBundledDocumentationOpenHandler,
  CommodoreCommanderBundledDocumentationPreviewHandler,
  CommodoreCommanderBundledDocumentationResourceResolver
} from './commodore-commander-bundled-docs';
import {
  CommodoreCommanderChatAgent,
  CommodoreCommanderChatViewContribution,
  CommodoreCommanderDocumentationRagService,
  CommodoreCommanderDocumentationSearchTool
} from './commodore-commander-ai';
import {
  COMMODORE_MACHINE_PROFILE_PREFERENCE_BINDING,
  CommodoreMachineProfileContribution,
  COMMODORE_MACHINE_PROFILE_WIDGET_ID,
  CommodoreMachineProfileSelectionService
} from './commodore-machine-profile-selection';
import {
  COMMODORE_EMULATOR_SHORTCUT_PREFERENCE_BINDING
} from './commodore-emulator-shortcuts';
import {
  CommodoreMachineProfileWidget
} from './commodore-machine-profile-widget';
import { CommodoreCommanderScreenCaptureContribution } from './commodore-commander-screen-capture-contribution';
import {
  CommodoreCharacterSetContribution
} from './commodore-character-set-contribution';
import {
  COMMODORE_CHARACTER_SET_WIDGET_FACTORY_ID,
  CommodoreCharacterSetWidget,
  type CommodoreCharacterSetWidgetOptions
} from './commodore-character-set-widget';
import {
  CommodoreScreenContribution
} from './commodore-screen-contribution';
import {
  COMMODORE_SCREEN_WIDGET_FACTORY_ID,
  CommodoreScreenWidget,
  type CommodoreScreenWidgetOptions
} from './commodore-screen-widget';
import {
  CommodoreSpriteContribution
} from './commodore-sprite-contribution';
import {
  COMMODORE_SPRITE_WIDGET_FACTORY_ID,
  CommodoreSpriteWidget,
  type CommodoreSpriteWidgetOptions
} from './commodore-sprite-widget';
import { CommodorePrgContribution } from './commodore-prg-contribution';
import { CommodoreViceBreakpointManager } from './commodore-vice-breakpoint-manager';
import { CommodoreDebugWatchContribution } from './commodore-debug-watch-contribution';
import { CommodoreViceBreakpointStateContribution } from './commodore-vice-breakpoint-state-contribution';
import { CommodoreViceLaunchConfigurationContribution } from './commodore-vice-launch-configuration-contribution';
import { CommodoreCommanderWelcomeContribution } from './commodore-commander-welcome-contribution';
import { ViceMemoryContribution } from './vice-memory-contribution';
import {
  VICE_MEMORY_WIDGET_ID,
  ViceMemoryWidget
} from './vice-memory-widget';
import { ViceMonitorLogContribution } from './vice-monitor-log-contribution';
import {
  VICE_MONITOR_LOG_WIDGET_ID,
  ViceMonitorLogWidget
} from './vice-monitor-log-widget';
import { C64VisualDebuggerContribution } from './c64-visual-debugger-contribution';
import {
  C64_VISUAL_DEBUGGER_WIDGET_ID,
  C64VisualDebuggerWidget
} from './c64-visual-debugger-widget';
import {
  KICK_ASSEMBLER_BUILD_CONSOLE_WIDGET_ID,
  KickAssemblerBuildConsoleWidget
} from './kick-assembler-build-console-widget';
import { KickAssemblerBuilderContribution } from './kick-assembler-builder-contribution';
import {
  KickAssemblerBuildTaskContribution
} from './kick-assembler-build-task-contribution';
import { KickAssemblerEditorLookupContribution } from './kick-assembler-editor-lookup-contribution';
import { KickAssemblerLanguageContribution } from './kick-assembler-language-contribution';
import { KickAssemblerOutlineContribution } from './kick-assembler-outline-contribution';
import { SidScoreLanguageContribution } from './sidscore-language-contribution';
import { SidScoreOutlineContribution } from './sidscore-outline-contribution';
import {
  SID_SCORE_EXPORT_TOOLBAR_ID,
  SidScoreRuntimeContribution
} from './sidscore-runtime-contribution';
import { SidScoreProtocolLogContribution } from './sidscore-protocol-log-contribution';
import {
  SID_SCORE_PROTOCOL_LOG_WIDGET_ID,
  SidScoreProtocolLogWidget
} from './sidscore-protocol-log-widget';
import {
  SID_SCORE_WAVEFORM_WIDGET_ID,
  SidScoreWaveformWidget
} from './sidscore-waveform-widget';
import {
  SID_INSTRUMENT_CONTROL_WIDGET_ID,
  SidInstrumentControlWidget
} from './sid-instrument-control-widget';
import { SidInstrumentControlContribution } from './sid-instrument-control-contribution';
import { SidSfxEditorContribution } from './sid-sfx-editor-contribution';
import {
  SID_SFX_EDITOR_WIDGET_ID,
  SidSfxEditorWidget
} from './sid-sfx-editor-widget';
import {
  SidScoreRuntimeService,
  SidScoreRuntimeServicePath
} from '../common/sidscore-runtime-service';

const commodoreCommanderToolbarDefaults: typeof ToolbarDefaults = () => {
  const defaults = ToolbarDefaults();
  return {
    items: {
      ...defaults.items,
      [ToolbarAlignment.LEFT]: [
        ...defaults.items[ToolbarAlignment.LEFT],
        [
          {
            id: SID_SCORE_EXPORT_TOOLBAR_ID,
            group: 'contributed'
          }
        ]
      ]
    }
  };
};

export default new ContainerModule((bind, _unbind, _isBound, rebind) => {
  rebind(MonacoThemingService)
    .to(CommodoreCommanderThemingService)
    .inSingletonScope();
  rebind(BreakpointManager)
    .to(CommodoreViceBreakpointManager)
    .inSingletonScope();
  bind(CommodoreCommanderThemeStyleParticipant).toSelf().inSingletonScope();
  bind(ColorContribution).toService(CommodoreCommanderThemeStyleParticipant);
  bind(StylingParticipant).toService(CommodoreCommanderThemeStyleParticipant);
  bind(CommodoreCommanderFrontendContribution).toSelf().inSingletonScope();
  bind(FrontendApplicationContribution).toService(CommodoreCommanderFrontendContribution);
  bind(CommodoreCommanderBundledDocumentationResourceResolver)
    .toSelf()
    .inSingletonScope();
  bind(ResourceResolver).toService(
    CommodoreCommanderBundledDocumentationResourceResolver
  );
  rebind(PreviewLinkNormalizer)
    .to(CommodoreCommanderBundledDocumentationLinkNormalizer)
    .inSingletonScope();
  bind(CommodoreCommanderBundledDocumentationContribution)
    .toSelf()
    .inSingletonScope();
  bind(CommandContribution).toService(
    CommodoreCommanderBundledDocumentationContribution
  );
  bind(MenuContribution).toService(
    CommodoreCommanderBundledDocumentationContribution
  );
  bind(CommodoreCommanderBundledDocumentationPreviewHandler)
    .toSelf()
    .inSingletonScope();
  bind(PreviewHandler).toService(
    CommodoreCommanderBundledDocumentationPreviewHandler
  );
  bind(CommodoreCommanderBundledDocumentationImagePreviewHandler)
    .toSelf()
    .inSingletonScope();
  bind(PreviewHandler).toService(
    CommodoreCommanderBundledDocumentationImagePreviewHandler
  );
  bind(CommodoreCommanderBundledDocumentationOpenHandler)
    .toSelf()
    .inSingletonScope();
  bind(OpenHandler).toService(
    CommodoreCommanderBundledDocumentationOpenHandler
  );
  bind(CommodoreCommanderBundledDocumentationEditorContribution)
    .toSelf()
    .inSingletonScope();
  bind(FrontendApplicationContribution).toService(
    CommodoreCommanderBundledDocumentationEditorContribution
  );
  bind(CommodoreCommanderDocumentationRagService).toSelf().inSingletonScope();
  bind(CommodoreCommanderChatAgent).toSelf().inSingletonScope();
  bind(Agent).toService(CommodoreCommanderChatAgent);
  bind(ChatAgent).toService(CommodoreCommanderChatAgent);
  bind(CommodoreCommanderChatViewContribution).toSelf().inSingletonScope();
  bind(FrontendApplicationContribution).toService(
    CommodoreCommanderChatViewContribution
  );
  bindToolProvider(CommodoreCommanderDocumentationSearchTool, bind);
  bind(CommodoreCommanderGettingStartedWidget).toSelf();
  rebind(GettingStartedWidget).toService(CommodoreCommanderGettingStartedWidget);
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: GettingStartedWidget.ID,
      createWidget: () => context.container.get(CommodoreCommanderGettingStartedWidget)
    }))
    .inSingletonScope();
  bind(CommodoreCommanderWelcomeContribution).toSelf().inSingletonScope();
  bind(CommandContribution).toService(CommodoreCommanderWelcomeContribution);
  bind(PreferenceContribution).toConstantValue(
    COMMODORE_MACHINE_PROFILE_PREFERENCE_BINDING
  );
  bind(PreferenceContribution).toConstantValue(
    COMMODORE_EMULATOR_SHORTCUT_PREFERENCE_BINDING
  );
  bind(PreferenceContribution).toConstantValue(
    COMMODORE_COMMANDER_TOOL_PREFERENCE_BINDING
  );
  bind(CommodoreMachineProfileSelectionService).toSelf().inSingletonScope();
  bind(CommodoreMachineProfileWidget).toSelf();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: COMMODORE_MACHINE_PROFILE_WIDGET_ID,
      createWidget: () => context.container.get(CommodoreMachineProfileWidget)
    }))
    .inSingletonScope();
  bind(CommodoreMachineProfileContribution).toSelf().inSingletonScope();
  bind(CommandContribution).toService(CommodoreMachineProfileContribution);
  bind(FrontendApplicationContribution).toService(
    CommodoreMachineProfileContribution
  );
  bind(CommodoreCommanderScreenCaptureContribution).toSelf().inSingletonScope();
  bind(FrontendApplicationContribution).toService(
    CommodoreCommanderScreenCaptureContribution
  );
  bind(CommodoreCharacterSetWidget).toSelf();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: COMMODORE_CHARACTER_SET_WIDGET_FACTORY_ID,
      createWidget: async (options?: CommodoreCharacterSetWidgetOptions) => {
        const widget = context.container.get(CommodoreCharacterSetWidget);
        if (!options?.uri) {
          throw new Error('Character set editor requires a resource URI.');
        }
        await widget.initialize(new URI(options.uri));
        return widget;
      }
    }))
    .inSingletonScope();
  bind(CommodoreCharacterSetContribution).toSelf().inSingletonScope();
  bind(CommandContribution).toService(CommodoreCharacterSetContribution);
  bind(MenuContribution).toService(CommodoreCharacterSetContribution);
  bind(OpenHandler).toService(CommodoreCharacterSetContribution);
  bind(CommodoreScreenWidget).toSelf();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: COMMODORE_SCREEN_WIDGET_FACTORY_ID,
      createWidget: async (options?: CommodoreScreenWidgetOptions) => {
        const widget = context.container.get(CommodoreScreenWidget);
        if (!options?.uri) {
          throw new Error('Screen editor requires a resource URI.');
        }
        await widget.initialize(new URI(options.uri));
        return widget;
      }
    }))
    .inSingletonScope();
  bind(CommodoreScreenContribution).toSelf().inSingletonScope();
  bind(CommandContribution).toService(CommodoreScreenContribution);
  bind(MenuContribution).toService(CommodoreScreenContribution);
  bind(OpenHandler).toService(CommodoreScreenContribution);
  bind(CommodoreSpriteWidget).toSelf();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: COMMODORE_SPRITE_WIDGET_FACTORY_ID,
      createWidget: async (options?: CommodoreSpriteWidgetOptions) => {
        const widget = context.container.get(CommodoreSpriteWidget);
        if (!options?.uri) {
          throw new Error('Sprite editor requires a resource URI.');
        }
        await widget.initialize(new URI(options.uri));
        return widget;
      }
    }))
    .inSingletonScope();
  bind(CommodoreSpriteContribution).toSelf().inSingletonScope();
  bind(CommandContribution).toService(CommodoreSpriteContribution);
  bind(MenuContribution).toService(CommodoreSpriteContribution);
  bind(OpenHandler).toService(CommodoreSpriteContribution);
  bind(CommodorePrgService)
    .toDynamicValue((context) =>
      WebSocketConnectionProvider.createProxy(
        context.container,
        CommodorePrgServicePath
      )
    )
    .inSingletonScope();
  bind(CommodorePrgContribution).toSelf().inSingletonScope();
  bind(CommandContribution).toService(CommodorePrgContribution);
  bind(MenuContribution).toService(CommodorePrgContribution);
  bind(OpenHandler).toService(CommodorePrgContribution);
  bind(ResourceResolver).toService(CommodorePrgContribution);
  bind(CommodoreViceLaunchConfigurationContribution)
    .toSelf()
    .inSingletonScope();
  bind(CommandContribution).toService(
    CommodoreViceLaunchConfigurationContribution
  );
  bind(CommodoreDebugWatchContribution).toSelf().inSingletonScope();
  bind(CommandContribution).toService(CommodoreDebugWatchContribution);
  bind(MenuContribution).toService(CommodoreDebugWatchContribution);
  bind(FrontendApplicationContribution).toService(
    CommodoreDebugWatchContribution
  );
  bind(CommodoreViceBreakpointStateContribution).toSelf().inSingletonScope();
  bind(DebugContribution).toService(CommodoreViceBreakpointStateContribution);
  bind(CommodoreViceEmbedService)
    .toDynamicValue((context) =>
      WebSocketConnectionProvider.createProxy(
        context.container,
        CommodoreViceEmbedServicePath
      )
    )
    .inSingletonScope();
  bind(ViceMemoryWidget).toSelf();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: VICE_MEMORY_WIDGET_ID,
      createWidget: () => context.container.get(ViceMemoryWidget)
    }))
    .inSingletonScope();
  bindViewContribution(bind, ViceMemoryContribution);
  bind(FrontendApplicationContribution).toService(ViceMemoryContribution);
  bind(ViceMonitorLogWidget).toSelf();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: VICE_MONITOR_LOG_WIDGET_ID,
      createWidget: () => context.container.get(ViceMonitorLogWidget)
    }))
    .inSingletonScope();
  bindViewContribution(bind, ViceMonitorLogContribution);
  bind(FrontendApplicationContribution).toService(ViceMonitorLogContribution);
  bind(C64VisualDebuggerWidget).toSelf();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: C64_VISUAL_DEBUGGER_WIDGET_ID,
      createWidget: () => context.container.get(C64VisualDebuggerWidget)
    }))
    .inSingletonScope();
  bindViewContribution(bind, C64VisualDebuggerContribution);
  bind(FrontendApplicationContribution).toService(C64VisualDebuggerContribution);
  bind(KickAssemblerLanguageContribution).toSelf().inSingletonScope();
  bind(FrontendApplicationContribution).toService(KickAssemblerLanguageContribution);
  bind(LanguageGrammarDefinitionContribution).toService(KickAssemblerLanguageContribution);
  bind(SidScoreLanguageContribution).toSelf().inSingletonScope();
  bind(FrontendApplicationContribution).toService(SidScoreLanguageContribution);
  bind(LanguageGrammarDefinitionContribution).toService(SidScoreLanguageContribution);
  bind(SidScoreRuntimeService)
    .toDynamicValue((context) =>
      WebSocketConnectionProvider.createProxy(
        context.container,
        SidScoreRuntimeServicePath
      )
    )
    .inSingletonScope();
  bind(SidScoreRuntimeContribution).toSelf().inSingletonScope();
  bind(CommandContribution).toService(SidScoreRuntimeContribution);
  bind(MenuContribution).toService(SidScoreRuntimeContribution);
  bind(TabBarToolbarContribution).toService(SidScoreRuntimeContribution);
  bind(FrontendApplicationContribution).toService(SidScoreRuntimeContribution);
  bind(ToolbarContribution).toService(SidScoreRuntimeContribution);
  rebind(ToolbarDefaultsFactory).toConstantValue(
    commodoreCommanderToolbarDefaults
  );
  bind(SidScoreWaveformWidget).toSelf();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: SID_SCORE_WAVEFORM_WIDGET_ID,
      createWidget: () => context.container.get(SidScoreWaveformWidget)
    }))
    .inSingletonScope();
  bind(SidInstrumentControlWidget).toSelf();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: SID_INSTRUMENT_CONTROL_WIDGET_ID,
      createWidget: () => context.container.get(SidInstrumentControlWidget)
    }))
    .inSingletonScope();
  bindViewContribution(bind, SidInstrumentControlContribution);
  bind(FrontendApplicationContribution).toService(SidInstrumentControlContribution);
  bind(SidSfxEditorWidget).toSelf();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: SID_SFX_EDITOR_WIDGET_ID,
      createWidget: () => context.container.get(SidSfxEditorWidget)
    }))
    .inSingletonScope();
  bindViewContribution(bind, SidSfxEditorContribution);
  bind(FrontendApplicationContribution).toService(SidSfxEditorContribution);
  bind(SidScoreProtocolLogWidget).toSelf();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: SID_SCORE_PROTOCOL_LOG_WIDGET_ID,
      createWidget: () => context.container.get(SidScoreProtocolLogWidget)
    }))
    .inSingletonScope();
  bindViewContribution(bind, SidScoreProtocolLogContribution);
  bind(FrontendApplicationContribution).toService(SidScoreProtocolLogContribution);
  bind(KickAssemblerEditorLookupContribution).toSelf().inSingletonScope();
  bind(FrontendApplicationContribution).toService(KickAssemblerEditorLookupContribution);
  bind(KickAssemblerOutlineContribution).toSelf().inSingletonScope();
  bind(FrontendApplicationContribution).toService(KickAssemblerOutlineContribution);
  bind(SidScoreOutlineContribution).toSelf().inSingletonScope();
  bind(FrontendApplicationContribution).toService(SidScoreOutlineContribution);
  bind(KickAssemblerBuildService)
    .toDynamicValue((context) =>
      WebSocketConnectionProvider.createProxy(
        context.container,
        KickAssemblerBuildServicePath
      )
    )
    .inSingletonScope();
  bind(KickAssemblerBuildConsoleWidget).toSelf().inSingletonScope();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: KICK_ASSEMBLER_BUILD_CONSOLE_WIDGET_ID,
      createWidget: () => context.container.get(KickAssemblerBuildConsoleWidget)
    }))
    .inSingletonScope();
  bindViewContribution(bind, KickAssemblerBuilderContribution);
  bind(FrontendApplicationContribution).toService(KickAssemblerBuilderContribution);
  bind(KickAssemblerBuildTaskContribution).toSelf().inSingletonScope();
  bind(TaskContribution).toService(KickAssemblerBuildTaskContribution);
  bind(FrontendApplicationContribution).toService(KickAssemblerBuildTaskContribution);
});
