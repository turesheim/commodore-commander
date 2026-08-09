export const COMMODORE_VICE_MONITOR_LOG_EVENT = 'commodoreViceMonitorLog';

export type ViceMonitorLogCategory = 'user' | 'input' | 'output';

export interface ViceMonitorLogEvent {
  category: ViceMonitorLogCategory;
  message: string;
  requestId?: number;
  code?: number;
  name?: string;
  bodyLength?: number;
  bodyPreview?: string;
  errorCode?: number;
  timestamp?: string;
}
