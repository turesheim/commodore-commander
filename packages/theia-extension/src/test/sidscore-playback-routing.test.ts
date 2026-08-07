import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isStartedSidScorePlaybackState,
  isTerminalSidScorePlaybackState,
  shouldTreatUnmatchedTerminalAsScorePlayback
} from '../common/sidscore-playback-routing';
import type {
  SidScorePlaybackStateEvent
} from '../common/sidscore-runtime-service';

test('SIDScore terminal routing ignores stale SFX completion while score is loading', () => {
  assert.equal(
    shouldTreatUnmatchedTerminalAsScorePlayback(
      playbackStateEvent({ requestId: 0, state: 'ended' }),
      'loading',
      true
    ),
    false
  );
});

test('SIDScore terminal routing accepts unmatched score completion after playback starts', () => {
  assert.equal(
    shouldTreatUnmatchedTerminalAsScorePlayback(
      playbackStateEvent({ requestId: 0, state: 'ended' }),
      'playing',
      true
    ),
    true
  );
});

test('SIDScore terminal routing requires an unmatched terminal event and active score identity', () => {
  assert.equal(
    shouldTreatUnmatchedTerminalAsScorePlayback(
      playbackStateEvent({ requestId: 77, state: 'ended' }),
      'playing',
      true
    ),
    false
  );
  assert.equal(
    shouldTreatUnmatchedTerminalAsScorePlayback(
      playbackStateEvent({ requestId: 0, state: 'playing' }),
      'playing',
      true
    ),
    false
  );
  assert.equal(
    shouldTreatUnmatchedTerminalAsScorePlayback(
      playbackStateEvent({ requestId: 0, state: 'ended' }),
      'playing',
      false
    ),
    false
  );
});

test('SIDScore playback state helpers classify started and terminal states', () => {
  assert.equal(isStartedSidScorePlaybackState('playing'), true);
  assert.equal(isStartedSidScorePlaybackState('paused'), true);
  assert.equal(isStartedSidScorePlaybackState('loading'), false);
  assert.equal(isTerminalSidScorePlaybackState('ended'), true);
  assert.equal(isTerminalSidScorePlaybackState('stopped'), true);
  assert.equal(isTerminalSidScorePlaybackState('playing'), false);
});

function playbackStateEvent(
  patch: Pick<SidScorePlaybackStateEvent, 'requestId' | 'state'> & {
    reason?: SidScorePlaybackStateEvent['reason'];
  }
): SidScorePlaybackStateEvent {
  return {
    requestId: patch.requestId,
    state: patch.state,
    reason: patch.reason ?? 'none',
    scoreId: 'score-1',
    frameIndex: '0',
    elapsedNanos: '0'
  };
}
