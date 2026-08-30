import {
  ConnectionStatus,
  ConnectionStatusService,
  PingService
} from '@theia/core/lib/browser/connection-status-service';
import type { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
import {
  WindowService
} from '@theia/core/lib/browser/window/window-service';
import type {
  TheiaCoreAPI
} from '@theia/core/lib/electron-common/electron-api';
import {
  Disposable,
  DisposableCollection
} from '@theia/core/lib/common';
import { inject, injectable } from '@theia/core/shared/inversify';

import {
  COMMODORE_COMMANDER_SYSTEM_RESUME_EVENT,
  COMMODORE_COMMANDER_SYSTEM_SUSPEND_EVENT
} from '../common/commodore-commander-electron-events';

const RESUME_CONNECTION_CHECK_DELAY_MS = 2500;
const RESUME_CONNECTION_CHECK_TIMEOUT_MS = 5000;
const RECENT_RESUME_WINDOW_MS = 30000;

type ElectronWindowEventRegistration = (
  event: string,
  handler: () => void
) => Disposable;

@injectable()
export class CommodoreCommanderSleepResumeContribution implements FrontendApplicationContribution {
  @inject(ConnectionStatusService)
  protected readonly connectionStatusService!: ConnectionStatusService;

  @inject(PingService)
  protected readonly pingService!: PingService;

  @inject(WindowService)
  protected readonly windowService!: WindowService;

  protected readonly toDispose = new DisposableCollection();
  protected recentResumeUntil = 0;
  protected reloadRequested = false;
  protected resumeConnectionCheck: number | undefined;

  onStart(): void {
    const electronTheiaCore = getElectronTheiaCore();
    if (!electronTheiaCore) {
      return;
    }

    const onWindowEvent = electronTheiaCore.onWindowEvent as ElectronWindowEventRegistration;
    this.toDispose.push(onWindowEvent(COMMODORE_COMMANDER_SYSTEM_SUSPEND_EVENT, () => {
      this.handleSystemSuspend();
    }));
    this.toDispose.push(onWindowEvent(COMMODORE_COMMANDER_SYSTEM_RESUME_EVENT, () => {
      this.handleSystemResume();
    }));
    this.toDispose.push(
      this.connectionStatusService.onStatusChange((status) => {
        this.handleConnectionStatusChanged(status);
      })
    );
  }

  onStop(): void {
    this.clearResumeConnectionCheck();
    this.toDispose.dispose();
  }

  protected handleSystemSuspend(): void {
    this.recentResumeUntil = 0;
    this.reloadRequested = false;
    this.clearResumeConnectionCheck();
  }

  protected handleSystemResume(): void {
    this.recentResumeUntil = Date.now() + RECENT_RESUME_WINDOW_MS;
    this.reloadRequested = false;
    this.scheduleResumeConnectionCheck(RESUME_CONNECTION_CHECK_DELAY_MS);
  }

  protected handleConnectionStatusChanged(status: ConnectionStatus): void {
    if (
      status === ConnectionStatus.OFFLINE &&
      Date.now() <= this.recentResumeUntil
    ) {
      this.scheduleResumeConnectionCheck(RESUME_CONNECTION_CHECK_DELAY_MS);
    }
  }

  protected scheduleResumeConnectionCheck(delayMs: number): void {
    if (this.reloadRequested) {
      return;
    }
    this.clearResumeConnectionCheck();
    this.resumeConnectionCheck = window.setTimeout(() => {
      this.resumeConnectionCheck = undefined;
      void this.reloadIfConnectionIsUnhealthy();
    }, delayMs);
  }

  protected clearResumeConnectionCheck(): void {
    if (this.resumeConnectionCheck === undefined) {
      return;
    }
    window.clearTimeout(this.resumeConnectionCheck);
    this.resumeConnectionCheck = undefined;
  }

  protected async reloadIfConnectionIsUnhealthy(): Promise<void> {
    if (
      this.reloadRequested ||
      Date.now() > this.recentResumeUntil
    ) {
      return;
    }

    if (this.connectionStatusService.currentStatus === ConnectionStatus.OFFLINE) {
      this.requestReloadAfterResume('backend connection is offline');
      return;
    }

    if (!await this.pingBackend()) {
      this.requestReloadAfterResume('backend ping did not complete after resume');
    }
  }

  protected async pingBackend(): Promise<boolean> {
    try {
      return await Promise.race([
        this.pingService.ping().then(() => true),
        delay(RESUME_CONNECTION_CHECK_TIMEOUT_MS, false)
      ]);
    } catch {
      return false;
    }
  }

  protected requestReloadAfterResume(reason: string): void {
    if (this.reloadRequested) {
      return;
    }
    this.reloadRequested = true;
    console.warn(`Reloading Commodore Commander after system resume: ${reason}.`);
    this.windowService.reload();
  }
}

function getElectronTheiaCore(): TheiaCoreAPI | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return (window as Window & {
    electronTheiaCore?: TheiaCoreAPI;
  }).electronTheiaCore;
}

function delay<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), ms);
  });
}
