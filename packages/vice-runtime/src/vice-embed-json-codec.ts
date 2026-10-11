/** Shared CCV1 wire envelope. Consumers own event-field validation and policy. */
export const COMMODORE_VICE_EMBED_PROTOCOL = 'commodore-vice-embed-v1';
export const COMMODORE_VICE_EMBED_PROTOCOL_PREFIX = 'CCV1 ';

export interface ViceEmbedProtocolEvent {
  readonly type: 'hello' | 'frame' | 'status';
  readonly [key: string]: unknown;
}

export interface ViceEmbedCommand {
  readonly type: 'key' | 'mouse' | 'joystick' | 'resize' | 'menu' | 'reset' | 'quit';
  readonly [key: string]: unknown;
}

export function encodeViceEmbedCommand<T extends { readonly type: ViceEmbedCommand['type'] }>(command: T): string {
  return `${COMMODORE_VICE_EMBED_PROTOCOL_PREFIX}${JSON.stringify(command)}\n`;
}

export function isViceEmbedProtocolLine(line: string): boolean {
  return line.trimEnd().startsWith(COMMODORE_VICE_EMBED_PROTOCOL_PREFIX);
}

/** Malformed prefixed JSON throws so each consumer can report it as before. */
export function parseViceEmbedProtocolLine(line: string): ViceEmbedProtocolEvent | undefined {
  const trimmedLine = line.trimEnd();
  if (!trimmedLine.startsWith(COMMODORE_VICE_EMBED_PROTOCOL_PREFIX)) {
    return undefined;
  }

  const payload: unknown = JSON.parse(trimmedLine.slice(COMMODORE_VICE_EMBED_PROTOCOL_PREFIX.length));
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  const event = payload as Record<string, unknown>;
  if (!isProtocolType(event.type)) {
    return undefined;
  }
  if (event.type === 'hello' && event.protocol !== COMMODORE_VICE_EMBED_PROTOCOL) {
    return undefined;
  }
  return event as ViceEmbedProtocolEvent;
}

function isProtocolType(value: unknown): value is ViceEmbedProtocolEvent['type'] {
  return value === 'hello' || value === 'frame' || value === 'status';
}
