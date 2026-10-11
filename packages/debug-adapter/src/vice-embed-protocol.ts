import {
  parseViceEmbedBinaryFrameRecord as parseRuntimeFrame,
  type ViceEmbedBinaryFrame as RuntimeFrame
} from '@commodore-commander/vice-runtime';

export const COMMODORE_VICE_EMBED_PROTOCOL = 'commodore-vice-embed-v1';
export const COMMODORE_VICE_EMBED_PROTOCOL_PREFIX = 'CCV1 ';
export const COMMODORE_VICE_EMBED_DEBUG_EVENT =
  'commodoreCommander.viceEmbed';
// Keep protocol consumers compatible while the runtime owns launch flags.
export {
  VICE_EMBED_FLAG,
  VICE_EMBED_FRAME_PORT_FLAG,
  VICE_EMBED_COMMAND_FD_FLAG,
  VICE_EMBED_COMMAND_FD,
  VICE_EMBED_MOUSE_GRAB_FLAG,
  VICE_EMBED_KEYMAP_INDEX_FLAG,
  VICE_EMBED_SYMBOLIC_KEYMAP_INDEX,
  VICE_EMBED_KEYBOARD_MAPPING_FLAG,
  VICE_EMBED_US_KEYBOARD_MAPPING
} from '@commodore-commander/vice-runtime';
export {
  COMMODORE_VICE_EMBED_BINARY_FRAME_MAGIC,
  COMMODORE_VICE_EMBED_BINARY_FRAME_HEADER_BYTES,
  getViceEmbedBinaryFrameRecordLength,
  startsWithViceEmbedBinaryFrame
} from '@commodore-commander/vice-runtime';

export interface ViceEmbedProtocolEvent {
  readonly type: 'hello' | 'frame' | 'status';
  readonly [key: string]: unknown;
}

export interface ViceEmbedCommand {
  readonly type: 'key' | 'mouse' | 'joystick' | 'resize' | 'menu' | 'reset' | 'quit';
  readonly [key: string]: unknown;
}

export type ViceEmbedBinaryFrame = Omit<RuntimeFrame, 'record'>;

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

export function parseViceEmbedBinaryFrameRecord(record: Buffer): ViceEmbedBinaryFrame {
  const { record: _record, ...frame } = parseRuntimeFrame(record);
  return frame;
}

function isProtocolType(value: unknown): value is ViceEmbedProtocolEvent['type'] {
  return value === 'hello' || value === 'frame' || value === 'status';
}
