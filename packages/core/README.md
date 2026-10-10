# Preserved Java Core

This directory contains Java domain code extracted from the Eclipse version:
Kick Assembler debug-info models, a JAXB parser for `-debugdump` metadata, and
numeric value parsing utilities.

It is not an npm workspace and is not compiled into the Theia/Electron product.
The active TypeScript debug-info parser, disassembler, and monitor integration
live in `packages/debug-adapter`; language services and reference datasets live
in `packages/language-support`; external VICE process helpers live in
`packages/vice-runtime`.

Keep this code as migration/reference material until its remaining consumers
and domain semantics have been checked. Its presence does not imply a shared
TypeScript core package has been implemented.
