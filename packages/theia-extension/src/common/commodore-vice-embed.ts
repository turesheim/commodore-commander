export const COMMODORE_COMMANDER_PATCHED_VICE_BASE_VERSION = '3.10.0';
export const COMMODORE_COMMANDER_PATCHED_VICE_SOURCE_TAG = 'v3.10';
export const COMMODORE_COMMANDER_PATCHED_VICE_SOURCE_URL =
  'https://sourceforge.net/p/vice-emu/code/HEAD/tree/tags/v3.10/vice/';

export type CommodoreCommanderViceLaunchMode =
  | 'embedded'
  | 'external';

export const DEFAULT_COMMODORE_COMMANDER_VICE_LAUNCH_MODE:
  CommodoreCommanderViceLaunchMode = 'embedded';
