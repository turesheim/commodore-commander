# Core

`packages/core` contains the first reusable extraction pass:

- Kick Assembler debug-info model classes without Eclipse workspace types
- a JAXB parser for `-debugdump` metadata
- numeric value parsing utilities reused by debugger-oriented code

VICE-specific code intentionally stays outside `core`:

- `packages/debug-adapter` for monitor protocol/adaptation
- the Theia backend currently owns the minimal embedded VICE `.prg` launch path
- any future reusable runtime/process package should be TypeScript-first

What is intentionally not here yet:

- Eclipse builder orchestration
- console integration
- source lookup integration
- response-to-debug-event translation
- reference XML assets and disassembler code that still need a second extraction
  pass
