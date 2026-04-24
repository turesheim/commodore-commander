import * as React from 'react';

import { codicon, ReactWidget } from '@theia/core/lib/browser';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { injectable } from '@theia/core/shared/inversify';

import type {
  SidScoreProtocolFrameEvent
} from '../common/sidscore-runtime-service';

export const SID_SCORE_PROTOCOL_LOG_WIDGET_ID =
  'commodore-commander.sidscore-protocol-log';

const MAX_PROTOCOL_LOG_ENTRIES = 500;
const DEFAULT_IGNORE_HIGH_VOLUME_FRAMES = true;
const IGNORED_HIGH_VOLUME_FRAME_TYPES = new Set([
  'SCOPE_SAMPLES',
  'VOICE_STATE'
]);

interface SidScoreProtocolLogEntry extends SidScoreProtocolFrameEvent {
  id: number;
  receivedAt: number;
}

@injectable()
export class SidScoreProtocolLogWidget extends ReactWidget {
  protected entries: SidScoreProtocolLogEntry[] = [];
  protected nextEntryId = 1;
  protected ignoreHighVolumeFrames = DEFAULT_IGNORE_HIGH_VOLUME_FRAMES;

  constructor() {
    super();
    this.id = SID_SCORE_PROTOCOL_LOG_WIDGET_ID;
    this.title.label = 'SIDScore Protocol';
    this.title.caption = 'SIDScore Server Protocol Messages';
    this.title.iconClass = codicon('debug-console');
    this.title.closable = true;
    this.addClass('cc-sidscore-protocol-log-widget');
  }

  appendFrame(event: SidScoreProtocolFrameEvent): void {
    if (this.shouldIgnoreFrame(event)) {
      return;
    }

    this.entries.push({
      ...event,
      id: this.nextEntryId,
      receivedAt: Date.now()
    });
    this.nextEntryId += 1;
    if (this.entries.length > MAX_PROTOCOL_LOG_ENTRIES) {
      this.entries = this.entries.slice(this.entries.length - MAX_PROTOCOL_LOG_ENTRIES);
    }
    this.update();
  }

  setIgnoreHighVolumeFrames(ignore: boolean): void {
    this.ignoreHighVolumeFrames = ignore;
    this.update();
  }

  clearFrames(): void {
    this.entries = [];
    this.update();
  }

  protected shouldIgnoreFrame(event: SidScoreProtocolFrameEvent): boolean {
    return this.ignoreHighVolumeFrames &&
      IGNORED_HIGH_VOLUME_FRAME_TYPES.has(event.typeName);
  }

  protected override onUpdateRequest(msg: Message): void {
    super.onUpdateRequest(msg);

    const body = this.node.querySelector('.cc-sidscore-protocol-log__body');
    if (body instanceof HTMLElement) {
      body.scrollTop = body.scrollHeight;
    }
  }

  protected render(): React.ReactNode {
    return (
      <div className='cc-sidscore-protocol-log'>
        <div className='cc-sidscore-protocol-log__toolbar'>
          <span className='cc-sidscore-protocol-log__title'>
            SIDScore protocol
          </span>
          <span className='cc-sidscore-protocol-log__count'>
            {this.entries.length}
          </span>
          <label
            className='cc-sidscore-protocol-log__filter'
            title='Skip SCOPE_SAMPLES and VOICE_STATE frames'
          >
            <input
              type='checkbox'
              checked={this.ignoreHighVolumeFrames}
              onChange={(event) =>
                this.setIgnoreHighVolumeFrames(event.currentTarget.checked)
              }
            />
            <span>Ignore voice/samples</span>
          </label>
          <button
            className='theia-button secondary cc-sidscore-protocol-log__clear'
            disabled={this.entries.length === 0}
            onClick={() => this.clearFrames()}
            title='Clear protocol messages'
            type='button'
          >
            Clear
          </button>
        </div>
        <div className='cc-sidscore-protocol-log__body'>
          {this.entries.length > 0 ? this.renderTable() : (
            <div className='cc-sidscore-protocol-log__empty'>
              No protocol messages
            </div>
          )}
        </div>
      </div>
    );
  }

  protected renderTable(): React.ReactNode {
    return (
      <table className='cc-sidscore-protocol-log__table'>
        <thead>
          <tr>
            <th>Time</th>
            <th>Dir</th>
            <th>Type</th>
            <th>Seq</th>
            <th>Req</th>
            <th>Flags</th>
            <th>Bytes</th>
            <th>Payload</th>
          </tr>
        </thead>
        <tbody>
          {this.entries.map((entry) => (
            <tr key={entry.id}>
              <td title={entry.timestampNanos}>{formatTime(entry.receivedAt)}</td>
              <td>
                <span
                  className={`cc-sidscore-protocol-log__direction cc-sidscore-protocol-log__direction--${entry.direction}`}
                  title={entry.direction}
                >
                  {entry.direction === 'sent' ? 'TX' : 'RX'}
                </span>
              </td>
              <td title={`0x${entry.type.toString(16).padStart(2, '0')}`}>
                {entry.typeName}
              </td>
              <td>{entry.sequence}</td>
              <td>{entry.requestId ?? '-'}</td>
              <td>0x{entry.flags.toString(16).padStart(4, '0')}</td>
              <td>{entry.payloadLength}</td>
              <td
                className='cc-sidscore-protocol-log__payload'
                title={entry.payloadPreview}
              >
                {entry.payloadPreview || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
