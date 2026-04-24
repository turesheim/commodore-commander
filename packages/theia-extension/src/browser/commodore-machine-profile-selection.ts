import {
  FrontendApplication,
  FrontendApplicationContribution,
  QuickInputService,
  WidgetManager
} from '@theia/core/lib/browser';
import {
  Command,
  CommandContribution,
  CommandRegistry,
  type QuickPickValue
} from '@theia/core/lib/common';
import { MessageService } from '@theia/core/lib/common/message-service';
import {
  PreferenceContribution,
  PreferenceScope,
  PreferenceService,
  type PreferenceSchema
} from '@theia/core/lib/common/preferences';
import URI from '@theia/core/lib/common/uri';
import {
  TabBarToolbarContribution,
  TabBarToolbarRegistry
} from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { inject, injectable } from '@theia/core/shared/inversify';

import {
  COMMODORE_MACHINE_PROFILES,
  DEFAULT_COMMODORE_MACHINE_PROFILE_ID,
  getCommodoreMachineProfile,
  resolveCommodoreMachineProfileId,
  type CommodoreMachineLaunchConfiguration,
  type CommodoreMachineProfile,
  type CommodoreMachineProfileId
} from '@commodore-commander/language-support/runtime';

export const COMMODORE_MACHINE_PROFILE_PREFERENCE =
  'commodoreCommander.activeMachine';
export const COMMODORE_MACHINE_PROFILE_WIDGET_ID =
  'commodoreCommander.machineProfile';

const DEFAULT_COMMODORE_ACTIVE_MACHINE_MODEL = getCommodoreMachineProfile(
  DEFAULT_COMMODORE_MACHINE_PROFILE_ID
).vice.defaultModel;

export const DEFAULT_COMMODORE_ACTIVE_MACHINE: CommodoreMachineLaunchConfiguration =
  {
    profile: DEFAULT_COMMODORE_MACHINE_PROFILE_ID,
    ...(DEFAULT_COMMODORE_ACTIVE_MACHINE_MODEL
      ? { model: DEFAULT_COMMODORE_ACTIVE_MACHINE_MODEL }
      : {}),
    viceArgs: []
  };

const VICE_MODEL_IDS = [
  ...new Set(
    COMMODORE_MACHINE_PROFILES.flatMap((profile) =>
      (profile.vice.models ?? []).map((model) => model.id)
    )
  )
].sort();

export const COMMODORE_MACHINE_PROFILE_PREFERENCE_SCHEMA: PreferenceSchema = {
  scope: PreferenceScope.Workspace,
  title: 'Commodore Commander',
  properties: {
    [COMMODORE_MACHINE_PROFILE_PREFERENCE]: {
      type: 'object',
      default: {
        profile: DEFAULT_COMMODORE_MACHINE_PROFILE_ID,
        ...(DEFAULT_COMMODORE_ACTIVE_MACHINE_MODEL
          ? { model: DEFAULT_COMMODORE_ACTIVE_MACHINE_MODEL }
          : {}),
        viceArgs: []
      },
      additionalProperties: false,
      properties: {
        profile: {
          type: 'string',
          enum: [...COMMODORE_MACHINE_PROFILES.map((profile) => profile.id)],
          enumDescriptions: [
            ...COMMODORE_MACHINE_PROFILES.map((profile) => profile.displayName)
          ],
          default: DEFAULT_COMMODORE_MACHINE_PROFILE_ID
        },
        model: {
          type: 'string',
          enum: VICE_MODEL_IDS,
          default: DEFAULT_COMMODORE_ACTIVE_MACHINE_MODEL,
          description: 'VICE -model value for the selected machine profile.'
        },
        viceArgs: {
          type: 'array',
          items: {
            type: 'string'
          },
          default: [],
          description: 'Additional VICE command-line arguments.'
        }
      },
      description:
        'Active Commodore machine for editor reference lookup and default VICE launch requests.'
    }
  }
};

export namespace CommodoreMachineProfileCommands {
  export const SELECT_MACHINE_PROFILE: Command = {
    id: 'commodoreCommander.machine.selectProfile',
    category: 'Commodore Commander',
    label: 'Select Commodore Machine Profile',
    iconClass: 'codicon codicon-circuit-board'
  };
}

@injectable()
export class CommodoreMachineProfileSelectionService {
  @inject(PreferenceService)
  protected readonly preferenceService!: PreferenceService;

  getActiveMachineConfiguration(
    resourceUri?: URI
  ): CommodoreMachineLaunchConfiguration {
    const configured = this.preferenceService.get<unknown>(
      COMMODORE_MACHINE_PROFILE_PREFERENCE,
      DEFAULT_COMMODORE_ACTIVE_MACHINE,
      resourceUri?.toString()
    );
    return resolveActiveMachineConfiguration(configured);
  }

  getActiveMachineProfileId(resourceUri?: URI): CommodoreMachineProfileId {
    return this.getActiveMachineConfiguration(resourceUri).profile;
  }

  getActiveMachineProfile(resourceUri?: URI): CommodoreMachineProfile {
    return getCommodoreMachineProfile(
      this.getActiveMachineProfileId(resourceUri)
    );
  }

  async setWorkspaceMachineProfile(
    machineProfileId: CommodoreMachineProfileId,
    resourceUri?: URI
  ): Promise<void> {
    const profile = getCommodoreMachineProfile(machineProfileId);
    await this.preferenceService.set(
      COMMODORE_MACHINE_PROFILE_PREFERENCE,
      {
        profile: machineProfileId,
        ...(profile.vice.defaultModel ? { model: profile.vice.defaultModel } : {}),
        viceArgs: []
      },
      PreferenceScope.Workspace,
      resourceUri?.toString()
    );
  }
}

function resolveActiveMachineConfiguration(
  value: unknown
): CommodoreMachineLaunchConfiguration {
  const object = isRecord(value) ? value : {};
  const profile =
    resolveCommodoreMachineProfileId(
      typeof object.profile === 'string' ? object.profile : undefined
    ) ?? DEFAULT_COMMODORE_MACHINE_PROFILE_ID;
  const profileDefinition = getCommodoreMachineProfile(profile);
  const configuredModel =
    typeof object.model === 'string' ? object.model : undefined;
  const model = profileDefinition.vice.models?.some(
    (modelOption) => modelOption.id === configuredModel
  )
    ? configuredModel
    : profileDefinition.vice.defaultModel;
  const viceArgs = Array.isArray(object.viceArgs)
    ? object.viceArgs.filter((entry): entry is string => typeof entry === 'string')
    : [];

  return {
    profile,
    ...(model ? { model } : {}),
    viceArgs
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@injectable()
export class CommodoreMachineProfileContribution
  implements
    FrontendApplicationContribution,
    CommandContribution,
    TabBarToolbarContribution
{
  @inject(CommodoreMachineProfileSelectionService)
  protected readonly machineProfileSelection!: CommodoreMachineProfileSelectionService;

  @inject(MessageService)
  protected readonly messageService!: MessageService;

  @inject(QuickInputService)
  protected readonly quickInputService!: QuickInputService;

  @inject(WorkspaceService)
  protected readonly workspaceService!: WorkspaceService;

  @inject(WidgetManager)
  protected readonly widgetManager!: WidgetManager;

  async onDidInitializeLayout(app: FrontendApplication): Promise<void> {
    const widget = await this.widgetManager.getOrCreateWidget(
      COMMODORE_MACHINE_PROFILE_WIDGET_ID
    );
    if (!widget.isAttached) {
      await app.shell.addWidget(widget, { area: 'right', rank: 100 });
    }
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(
      CommodoreMachineProfileCommands.SELECT_MACHINE_PROFILE,
      {
        execute: () => this.selectMachineProfile(),
        isEnabled: () => this.hasWorkspace(),
        isVisible: () => true
      }
    );
  }

  registerToolbarItems(toolbar: TabBarToolbarRegistry): void {
    toolbar.registerItem({
      id: `${CommodoreMachineProfileCommands.SELECT_MACHINE_PROFILE.id}.toolbar`,
      command: CommodoreMachineProfileCommands.SELECT_MACHINE_PROFILE.id,
      text: '$(circuit-board)',
      tooltip: 'Select Commodore machine profile',
      priority: 1,
      isVisible: (widget) => widget?.id === COMMODORE_MACHINE_PROFILE_WIDGET_ID
    });
  }

  protected async selectMachineProfile(): Promise<void> {
    await this.workspaceService.ready;
    if (!this.hasWorkspace()) {
      this.messageService.warn(
        'Open a workspace before selecting a Commodore machine profile.'
      );
      return;
    }

    const activeId = this.machineProfileSelection.getActiveMachineProfileId();
    const picks = COMMODORE_MACHINE_PROFILES.map((profile) =>
      this.toMachineProfilePick(profile, profile.id === activeId)
    );
    const selected = await this.quickInputService.pick(picks, {
      placeHolder: 'Select active Commodore machine profile',
      activeItem: picks.find((pick) => pick.value === activeId)
    });

    if (!selected) {
      return;
    }

    await this.machineProfileSelection.setWorkspaceMachineProfile(
      selected.value
    );
    this.messageService.info(
      `Active Commodore machine profile: ${getCommodoreMachineProfile(selected.value).displayName}.`
    );
  }

  protected toMachineProfilePick(
    profile: CommodoreMachineProfile,
    isActive: boolean
  ): QuickPickValue<CommodoreMachineProfileId> {
    return {
      label: `${isActive ? '$(check) ' : ''}${profile.displayName}`,
      description: `${profile.cpu.primary} - ${profile.vice.executable}`,
      detail: profile.description,
      value: profile.id
    };
  }

  protected hasWorkspace(): boolean {
    return (
      this.workspaceService.opened ||
      this.workspaceService.tryGetRoots().length > 0
    );
  }
}

export const COMMODORE_MACHINE_PROFILE_PREFERENCE_BINDING:
  PreferenceContribution = {
    schema: COMMODORE_MACHINE_PROFILE_PREFERENCE_SCHEMA
  };
