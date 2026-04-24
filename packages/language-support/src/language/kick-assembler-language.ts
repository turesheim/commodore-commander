export const KICK_ASSEMBLER_LANGUAGE_ID = 'kickassembler';
export const KICK_ASSEMBLER_LANGUAGE_NAME = 'Kick Assembler';
export const KICK_ASSEMBLER_SCOPE_NAME = 'source.assembly.kickassembler';
export const KICK_ASSEMBLER_EXTENSIONS = Object.freeze([
  '.asm',
  '.inc',
  '.s',
  '.a',
  '.lib',
  '.kick',
  '.ka',
  '.src'
]);

export const KICK_ASSEMBLER_LANGUAGE_SPEC = Object.freeze({
  id: KICK_ASSEMBLER_LANGUAGE_ID,
  name: KICK_ASSEMBLER_LANGUAGE_NAME,
  scopeName: KICK_ASSEMBLER_SCOPE_NAME,
  extensions: KICK_ASSEMBLER_EXTENSIONS,
  grammarUrl: new URL(
    '../../syntaxes/kickassembler.tmLanguage.json',
    import.meta.url
  ),
  languageConfigurationUrl: new URL(
    '../../syntaxes/kickassembler.language-configuration.json',
    import.meta.url
  )
});
