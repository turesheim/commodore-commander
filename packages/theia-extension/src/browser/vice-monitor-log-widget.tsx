import * as React from 'react';

import { codicon, ReactWidget } from '@theia/core/lib/browser';
import { ClipboardService } from '@theia/core/lib/browser/clipboard-service';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { MessageService } from '@theia/core/lib/common/message-service';
import { inject, injectable } from '@theia/core/shared/inversify';

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
  @inject(ClipboardService)
  protected readonly clipboardService!: ClipboardService;

  @inject(MessageService)
  protected readonly messageService!: MessageService;

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

  protected async copyEntriesToClipboard(): Promise<void> {
    if (this.entries.length === 0) {
      return;
    }
    try {
      await this.clipboardService.writeText(this.serializeEntries());
      this.messageService.info(
        `Copied ${this.entries.length} VICE monitor log ` +
          `${this.entries.length === 1 ? 'entry' : 'entries'} to clipboard.`
      );
    } catch (error) {
      this.messageService.error(
        `Unable to copy VICE monitor log: ${errorMessage(error)}`
      );
    }
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
            className='theia-button secondary cc-vice-monitor-log__copy'
            disabled={this.entries.length === 0}
            onClick={() => void this.copyEntriesToClipboard()}
            title='Copy VICE monitor protocol messages to the clipboard'
            type='button'
          >
            Copy to Clipboard
          </button>
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
    const hasError = entry.errorCode !== undefined && entry.errorCode !== 0;
    return (
      <tr
        className={hasError ? 'cc-vice-monitor-log__row--error' : undefined}
        key={entry.id}
      >
        <td title={entry.timestamp}>{formatEntryTime(entry)}</td>
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

  protected serializeEntries(): string {
    return [
      [
        'Time',
        'Dir',
        'Req',
        'Type',
        'Code',
        'Error',
        'Bytes',
        'Message',
        'Payload'
      ].join('\t'),
      ...this.entries.map((entry) => [
        formatEntryTime(entry),
        directionLabel(entry.category),
        formatOptionalNumber(entry.requestId),
        entry.name ?? '',
        entry.code === undefined
          ? ''
          : `0x${entry.code.toString(16).padStart(2, '0')}`,
        formatOptionalNumber(entry.errorCode),
        formatOptionalNumber(entry.bodyLength),
        entry.message,
        entry.bodyPreview ?? ''
      ].map(escapeTsvValue).join('\t'))
    ].join('\n');
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

function formatEntryTime(entry: CommodoreViceMonitorLogEntry): string {
  const timestamp = entry.timestamp ? Date.parse(entry.timestamp) : Number.NaN;
  return Number.isNaN(timestamp)
    ? formatTime(entry.receivedAt)
    : formatTime(timestamp);
}

function formatOptionalNumber(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

function escapeTsvValue(value: string): string {
  return value
    .replace(/\t/gu, ' ')
    .replace(/\r\n/gu, ' ')
    .replace(/[\r\n]/gu, ' ');
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
