export const RuntimeSetupServicePath = '/services/commodore-commander/runtime-setup';
export const RuntimeSetupService = Symbol('RuntimeSetupService');

export interface RuntimeSetupCheck {
  readonly name: string;
  readonly state: 'ready' | 'error';
  readonly detail: string;
}

export interface RuntimeSetupReport {
  readonly platform: string;
  readonly machine: string;
  readonly launchMode: string;
  readonly checks: readonly RuntimeSetupCheck[];
}

export interface RuntimeSetupService {
  check(resourceUri?: string): Promise<RuntimeSetupReport>;
}
