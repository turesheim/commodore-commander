export const KICK_ASSEMBLER_FILE_EXTENSIONS = Object.freeze([
  '.asm',
  '.inc',
  '.s',
  '.a',
  '.lib',
  '.kick',
  '.ka',
  '.src'
]);

const KICK_ASSEMBLER_FILE_EXTENSION_SET = new Set(KICK_ASSEMBLER_FILE_EXTENSIONS);

export function isKickAssemblerFileExtension(extension: string): boolean {
  return KICK_ASSEMBLER_FILE_EXTENSION_SET.has(extension.toLowerCase());
}
