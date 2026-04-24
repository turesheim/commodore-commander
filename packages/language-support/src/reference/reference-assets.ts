import type { ReferenceDocumentKind } from './reference-symbol-catalog.ts';

export interface BundledReferenceAssetSpec {
  kind: ReferenceDocumentKind;
  assetUrl: URL;
}

export const BUNDLED_REFERENCE_ASSET_SPECS = Object.freeze([
  {
    kind: '6502-reference' as const,
    assetUrl: new URL('../../reference/6502.xml', import.meta.url)
  },
  {
    kind: 'c64io-reference' as const,
    assetUrl: new URL('../../reference/c64/c64io.xml', import.meta.url)
  }
]);
