export const VICE_EMBED_FLAG = '-cc-embed';
export const VICE_EMBED_FRAME_PORT_FLAG = '-cc-frame-port';
export const VICE_EMBED_COMMAND_FD_FLAG = '-cc-command-fd';
export const VICE_EMBED_COMMAND_FD = 3;
export const VICE_EMBED_MOUSE_GRAB_FLAG = '-mouse';
export const VICE_EMBED_KEYMAP_INDEX_FLAG = '-keymap';
export const VICE_EMBED_SYMBOLIC_KEYMAP_INDEX = '0';
export const VICE_EMBED_KEYBOARD_MAPPING_FLAG = '-keyboardmapping';
export const VICE_EMBED_US_KEYBOARD_MAPPING = '0';

export function createEmbeddedViceArgs(viceArgs: readonly string[]): string[] {
  return [
    ...(viceArgs.includes(VICE_EMBED_MOUSE_GRAB_FLAG) || viceArgs.includes('+mouse')
      ? [] : [VICE_EMBED_MOUSE_GRAB_FLAG]),
    ...viceArgs,
    VICE_EMBED_KEYMAP_INDEX_FLAG,
    VICE_EMBED_SYMBOLIC_KEYMAP_INDEX,
    VICE_EMBED_KEYBOARD_MAPPING_FLAG,
    VICE_EMBED_US_KEYBOARD_MAPPING
  ];
}
