export const COMMODORE_VICE_MONITOR_LOG_EVENT = 'commodoreViceMonitorLog';

export type CommodoreViceMonitorLogCategory = 'user' | 'input' | 'output';

export interface CommodoreViceMonitorLogEvent {
  category: CommodoreViceMonitorLogCategory;
  message: string;
  requestId?: number;
  code?: number;
  name?: string;
  bodyLength?: number;
  bodyPreview?: string;
  errorCode?: number;
  timestamp?: string;
}
