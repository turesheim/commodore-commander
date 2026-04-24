import * as React from 'react';

import { codicon, ReactWidget } from '@theia/core/lib/browser';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import {
  PreferenceService
} from '@theia/core/lib/common/preferences';
import { DisposableCollection } from '@theia/core/lib/common';
import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';

import {
  COMMODORE_MACHINE_PROFILE_PREFERENCE,
  COMMODORE_MACHINE_PROFILE_WIDGET_ID,
  CommodoreMachineProfileSelectionService
} from './commodore-machine-profile-selection';

@injectable()
export class CommodoreMachineProfileWidget extends ReactWidget {
  @inject(CommodoreMachineProfileSelectionService)
  protected readonly machineProfileSelection!: CommodoreMachineProfileSelectionService;

  @inject(PreferenceService)
  protected readonly preferenceService!: PreferenceService;

  protected readonly toDispose = new DisposableCollection();

  @postConstruct()
  protected init(): void {
    this.id = COMMODORE_MACHINE_PROFILE_WIDGET_ID;
    this.title.label = 'Machine';
    this.title.caption = 'Commodore Machine Profile';
    this.title.iconClass = codicon('circuit-board');
    this.title.closable = false;
    this.addClass('cc-machine-profile-widget');
    this.toDispose.push(
      this.preferenceService.onPreferenceChanged((event) => {
        if (event.preferenceName === COMMODORE_MACHINE_PROFILE_PREFERENCE) {
          this.update();
        }
      })
    );
  }

  override dispose(): void {
    this.toDispose.dispose();
    super.dispose();
  }

  protected override onActivateRequest(msg: Message): void {
    super.onActivateRequest(msg);
    this.node.focus();
  }

  protected render(): React.ReactNode {
    const machine = this.machineProfileSelection.getActiveMachineConfiguration();
    const profile = this.machineProfileSelection.getActiveMachineProfile();
    const screen = profile.screenLayouts[0];
    return (
      <div
        style={{
          color: 'var(--theia-foreground)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          height: '100%',
          minHeight: 0,
          overflow: 'auto',
          padding: '12px'
        }}
      >
        <div
          style={{
            color: 'var(--theia-descriptionForeground)',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase'
          }}
        >
          Active Machine
        </div>
        <div
          style={{
            fontSize: '18px',
            fontWeight: 600,
            lineHeight: 1.25
          }}
        >
          {profile.displayName}
        </div>
        <div
          style={{
            color: 'var(--theia-descriptionForeground)',
            fontSize: '12px',
            lineHeight: 1.4
          }}
        >
          {profile.description}
        </div>
        <dl
          style={{
            display: 'grid',
            gap: '6px 12px',
            gridTemplateColumns: 'max-content 1fr',
            margin: 0
          }}
        >
          {this.renderFact('CPU', profile.cpu.primary)}
          {this.renderFact('VICE', profile.vice.executable)}
          {machine.model ? this.renderFact('Model', machine.model) : undefined}
          {machine.viceArgs && machine.viceArgs.length > 0
            ? this.renderFact('VICE Args', machine.viceArgs.join(' '))
            : undefined}
          {screen
            ? this.renderFact('Screen', `${screen.columns}x${screen.rows}`)
            : undefined}
          {this.renderFact('Charset', profile.characterSets[0]?.name ?? 'Default')}
        </dl>
      </div>
    );
  }

  protected renderFact(label: string, value: string): React.ReactNode {
    return (
      <React.Fragment key={label}>
        <dt
          style={{
            color: 'var(--theia-descriptionForeground)',
            fontSize: '12px',
            margin: 0
          }}
        >
          {label}
        </dt>
        <dd
          style={{
            fontSize: '12px',
            margin: 0
          }}
        >
          {value}
        </dd>
      </React.Fragment>
    );
  }
}
