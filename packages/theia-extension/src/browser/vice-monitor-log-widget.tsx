import * as React from 'react';

import { codicon, ReactWidget } from '@theia/core/lib/browser';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { injectable } from '@theia/core/shared/inversify';

import type {
  CommodoreViceMonitorLogCategory,
  CommodoreViceMonitorLogEvent
} from '../common/commodore-vice-monitor-log';

export const VICE_MONITOR_LOG_WIDGET_ID =
  'commodore-commander.vice-monitor-log';

const MAX_MONITOR_LOG_ENTRIES = 1000;

interface CommodoreViceMonitorLogEntry extends CommodoreViceMonitorLogEvent {
  id: number;
  receivedAt: number;
}

@injectable()
export class ViceMonitorLogWidget extends ReactWidget {
  protected entries: CommodoreViceMonitorLogEntry[] = [];
  protected nextEntryId = 1;

  constructor() {
    super();
    this.id = VICE_MONITOR_LOG_WIDGET_ID;
    this.title.label = 'VICE Monitor';
    this.title.caption = 'VICE Binary Monitor Protocol Messages';
    this.title.iconClass = codicon('debug-console');
    this.title.closable = true;
    this.addClass('cc-vice-monitor-log-widget');
  }

  appendEntry(event: CommodoreViceMonitorLogEvent): void {
    this.entries.push({
      ...event,
      id: this.nextEntryId,
      receivedAt: Date.now()
    });
    this.nextEntryId += 1;
    if (this.entries.length > MAX_MONITOR_LOG_ENTRIES) {
      this.entries = this.entries.slice(
        this.entries.length - MAX_MONITOR_LOG_ENTRIES
      );
    }
    this.update();
  }

  clearEntries(): void {
    this.entries = [];
    this.update();
  }

  protected override onUpdateRequest(msg: Message): void {
    super.onUpdateRequest(msg);

    const body = this.node.querySelector('.cc-vice-monitor-log__body');
    if (body instanceof HTMLElement) {
      body.scrollTop = body.scrollHeight;
    }
  }

  protected render(): React.ReactNode {
    return (
      <div className='cc-vice-monitor-log'>
        <div className='cc-vice-monitor-log__toolbar'>
          <span className='cc-vice-monitor-log__title'>
            VICE monitor protocol
          </span>
          <span className='cc-vice-monitor-log__count'>
            {this.entries.length}
          </span>
          <button
            className='theia-button secondary cc-vice-monitor-log__clear'
            disabled={this.entries.length === 0}
            onClick={() => this.clearEntries()}
            title='Clear VICE monitor protocol messages'
            type='button'
          >
            Clear
          </button>
        </div>
        <div className='cc-vice-monitor-log__body'>
          {this.entries.length > 0 ? this.renderTable() : (
            <div className='cc-vice-monitor-log__empty'>
              No VICE monitor traffic
            </div>
          )}
        </div>
      </div>
    );
  }

  protected renderTable(): React.ReactNode {
    return (
      <table className='cc-vice-monitor-log__table'>
        <thead>
          <tr>
            <th>Time</th>
            <th>Dir</th>
            <th>Req</th>
            <th>Type</th>
            <th>Bytes</th>
            <th>Message</th>
            <th>Payload</th>
          </tr>
        </thead>
        <tbody>
          {this.entries.map((entry) => this.renderEntryRow(entry))}
        </tbody>
      </table>
    );
  }

  protected renderEntryRow(entry: CommodoreViceMonitorLogEntry): React.ReactNode {
    const timestamp = entry.timestamp ? Date.parse(entry.timestamp) : Number.NaN;
    const time = Number.isNaN(timestamp)
      ? formatTime(entry.receivedAt)
      : formatTime(timestamp);
    const hasError = entry.errorCode !== undefined && entry.errorCode !== 0;
    return (
      <tr
        className={hasError ? 'cc-vice-monitor-log__row--error' : undefined}
        key={entry.id}
      >
        <td title={entry.timestamp}>{time}</td>
        <td>
          <span
            className={`cc-vice-monitor-log__direction cc-vice-monitor-log__direction--${entry.category}`}
            title={directionTitle(entry.category)}
          >
            {directionLabel(entry.category)}
          </span>
        </td>
        <td>{entry.requestId ?? '-'}</td>
        <td title={entry.code === undefined ? undefined : `0x${entry.code.toString(16).padStart(2, '0')}`}>
          {entry.name ?? '-'}
        </td>
        <td>{entry.bodyLength ?? '-'}</td>
        <td
          className='cc-vice-monitor-log__message'
          title={entry.message}
        >
          {entry.message}
        </td>
        <td
          className='cc-vice-monitor-log__payload'
          title={entry.bodyPreview}
        >
          {entry.bodyPreview || '-'}
        </td>
      </tr>
    );
  }
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return [
    date.getHours(),
    date.getMinutes(),
    date.getSeconds()
  ].map((part) => part.toString().padStart(2, '0')).join(':');
}

function directionLabel(category: CommodoreViceMonitorLogCategory): string {
  switch (category) {
    case 'input':
      return 'TX';
    case 'output':
      return 'RX';
    case 'user':
      return 'LOG';
  }
}

function directionTitle(category: CommodoreViceMonitorLogCategory): string {
  switch (category) {
    case 'input':
      return 'sent to VICE';
    case 'output':
      return 'received from VICE';
    case 'user':
      return 'adapter note';
  }
}
