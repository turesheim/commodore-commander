import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  SidScoreRuntimeClient,
  SidScoreScopeSamplesEvent
} from '../common/sidscore-runtime-service';
import { SidScoreRuntimeServiceImpl } from '../node/sidscore-runtime-service-impl';

test('SIDScore runtime clears telemetry when the frontend RPC connection closes', (t) => {
  const service = new TestSidScoreRuntimeService();
  t.after(() => service.dispose());

  const client = new TestSidScoreRuntimeClient();
  service.setClient(client);
  service.queueTestScopeSamples(scopeSamplesEvent([1, 2, 3]));
  assert.equal(service.hasPendingTelemetry(), true);

  client.closeConnection();
  assert.equal(service.hasPendingTelemetry(), false);

  service.queueTestScopeSamples(scopeSamplesEvent([4, 5, 6]));
  assert.equal(service.hasPendingTelemetry(), false);
});

class TestSidScoreRuntimeService extends SidScoreRuntimeServiceImpl {
  queueTestScopeSamples(event: SidScoreScopeSamplesEvent): void {
    this.queueScopeSamples(event);
  }

  hasPendingTelemetry(): boolean {
    return Boolean(
      this.pendingVoiceState ||
      this.pendingScopeBuckets ||
      this.pendingScopeSamples ||
      this.telemetryFlushTimer
    );
  }
}

class TestSidScoreRuntimeClient implements SidScoreRuntimeClient {
  private readonly closeListeners = new Set<() => void>();

  readonly onDidCloseConnection = (listener: () => void): { dispose(): void } => {
    this.closeListeners.add(listener);
    return {
      dispose: () => this.closeListeners.delete(listener)
    };
  };

  onSidScoreScopeSamples(): void {}

  closeConnection(): void {
    for (const listener of this.closeListeners) {
      listener();
    }
  }
}

function scopeSamplesEvent(samples: readonly number[]): SidScoreScopeSamplesEvent {
  return {
    scoreId: 'score',
    blockIndex: '0',
    sampleRate: 44100,
    sampleCount: samples.length,
    voices: [
      {
        voiceIndex: 1,
        samples
      }
    ]
  };
}
