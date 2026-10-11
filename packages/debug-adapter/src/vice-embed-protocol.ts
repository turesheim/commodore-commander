import {
  parseViceEmbedBinaryFrameRecord as parseRuntimeFrame,
  type ViceEmbedBinaryFrame as RuntimeFrame
} from '@commodore-commander/vice-runtime';

export {
  COMMODORE_VICE_EMBED_PROTOCOL,
  COMMODORE_VICE_EMBED_PROTOCOL_PREFIX,
  encodeViceEmbedCommand,
  isViceEmbedProtocolLine,
  parseViceEmbedProtocolLine,
  type ViceEmbedProtocolEvent,
  type ViceEmbedCommand
} from '@commodore-commander/vice-runtime';
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

export type ViceEmbedBinaryFrame = Omit<RuntimeFrame, 'record'>;

export function parseViceEmbedBinaryFrameRecord(record: Buffer): ViceEmbedBinaryFrame {
  const { record: _record, ...frame } = parseRuntimeFrame(record);
  return frame;
}
