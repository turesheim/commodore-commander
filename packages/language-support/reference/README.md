# Reference Assets

This directory now holds two different categories of assets:

- reused runtime reference data
  - `6502.xml`
  - `c64/c64io.xml`
- reference-only migration material
  - the legacy Java parser/source-tree extraction
  - the preserved `KickAssembler.g4` grammar

Current policy:

- `syntaxes/` is reused directly
- the XML mnemonic and I/O-map datasets are reused by the TypeScript lookup
  service
- the Java and ANTLR assets remain reference-only
- new language-support runtime work belongs under `src/`
