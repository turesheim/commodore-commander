/**
 * Directory names omitted from automatic editor/build source discovery.
 * This is not an include-resolution filter: explicit imports and configured
 * program roots may still refer to files in these directories.
 */
export const DEFAULT_KICK_ASSEMBLER_EXCLUDED_DIRECTORY_NAMES: readonly string[] = Object.freeze([
  '.git',
  '.metadata',
  '.theia',
  'dist',
  'node_modules',
  'out',
  'src-gen',
  'target'
]);
