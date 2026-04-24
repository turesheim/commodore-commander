"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KICK_ASSEMBLER_LANGUAGE_SPEC = exports.KICK_ASSEMBLER_EXTENSIONS = exports.KICK_ASSEMBLER_SCOPE_NAME = exports.KICK_ASSEMBLER_LANGUAGE_NAME = exports.KICK_ASSEMBLER_LANGUAGE_ID = void 0;
exports.KICK_ASSEMBLER_LANGUAGE_ID = 'kickassembler';
exports.KICK_ASSEMBLER_LANGUAGE_NAME = 'Kick Assembler';
exports.KICK_ASSEMBLER_SCOPE_NAME = 'source.assembly.kickassembler';
exports.KICK_ASSEMBLER_EXTENSIONS = Object.freeze([
    '.asm',
    '.inc',
    '.s',
    '.a',
    '.lib',
    '.kick',
    '.ka',
    '.src'
]);
exports.KICK_ASSEMBLER_LANGUAGE_SPEC = Object.freeze({
    id: exports.KICK_ASSEMBLER_LANGUAGE_ID,
    name: exports.KICK_ASSEMBLER_LANGUAGE_NAME,
    scopeName: exports.KICK_ASSEMBLER_SCOPE_NAME,
    extensions: exports.KICK_ASSEMBLER_EXTENSIONS,
    grammarUrl: new URL('../../syntaxes/kickassembler.tmLanguage.json', import.meta.url),
    languageConfigurationUrl: new URL('../../syntaxes/kickassembler.language-configuration.json', import.meta.url)
});
//# sourceMappingURL=kick-assembler-language.js.map