import type {
  SidScorePlaybackStateEvent,
  SidScorePlaybackStateName
} from './sidscore-runtime-service';

export function isTerminalSidScorePlaybackState(
  state: SidScorePlaybackStateName
): boolean {
  return (
    state === 'idle' ||
    state === 'stopped' ||
    state === 'ended' ||
    state === 'error'
  );
}

export function isStartedSidScorePlaybackState(
  state: SidScorePlaybackStateName
): boolean {
  return state === 'playing' || state === 'paused';
}

export function shouldTreatUnmatchedTerminalAsScorePlayback(
  event: SidScorePlaybackStateEvent,
  currentPlaybackState: SidScorePlaybackStateName,
  hasActiveScorePlaybackIdentity: boolean
): boolean {
  return (
    hasActiveScorePlaybackIdentity &&
    event.requestId === 0 &&
    isTerminalSidScorePlaybackState(event.state) &&
    isStartedSidScorePlaybackState(currentPlaybackState)
  );
}
