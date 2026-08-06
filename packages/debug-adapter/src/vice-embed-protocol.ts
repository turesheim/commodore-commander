export const COMMODORE_VICE_EMBED_PROTOCOL = 'commodore-vice-embed-v1';
export const COMMODORE_VICE_EMBED_PROTOCOL_PREFIX = 'CCV1 ';
export const COMMODORE_VICE_EMBED_DEBUG_EVENT =
  'commodoreCommander.viceEmbed';
export const VICE_EMBED_FLAG = '-cc-embed';

export interface ViceEmbedProtocolEvent {
  readonly type: 'hello' | 'frame' | 'status';
  readonly [key: string]: unknown;
}

export interface ViceEmbedCommand {
  readonly type: 'key' | 'joystick' | 'resize' | 'reset' | 'quit';
  readonly [key: string]: unknown;
}

export function encodeViceEmbedCommand(command: ViceEmbedCommand): string {
  return `${COMMODORE_VICE_EMBED_PROTOCOL_PREFIX}${JSON.stringify(command)}\n`;
}

export function isViceEmbedProtocolLine(line: string): boolean {
  return line.trimEnd().startsWith(COMMODORE_VICE_EMBED_PROTOCOL_PREFIX);
}

export function parseViceEmbedProtocolLine(
  line: string
): ViceEmbedProtocolEvent | undefined {
  const trimmedLine = line.trimEnd();
  if (!trimmedLine.startsWith(COMMODORE_VICE_EMBED_PROTOCOL_PREFIX)) {
    return undefined;
  }

  const payload = JSON.parse(
    trimmedLine.slice(COMMODORE_VICE_EMBED_PROTOCOL_PREFIX.length)
  );
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  if (!isProtocolType((payload as { type?: unknown }).type)) {
    return undefined;
  }
  if (
    (payload as { type: string }).type === 'hello' &&
    (payload as { protocol?: unknown }).protocol !== COMMODORE_VICE_EMBED_PROTOCOL
  ) {
    return undefined;
  }
  return payload as ViceEmbedProtocolEvent;
}

function isProtocolType(value: unknown): value is ViceEmbedProtocolEvent['type'] {
  return value === 'hello' || value === 'frame' || value === 'status';
}
