import * as React from 'react';

import {
  c64UpperGraphicsGlyph
} from '../common/commodore-petscii-glyphs';

export interface CommodorePetsciiGlyphIconProps {
  readonly screenCode: number;
  readonly title?: string;
  readonly style?: React.CSSProperties;
}

export function CommodorePetsciiGlyphIcon(
  props: CommodorePetsciiGlyphIconProps
): React.ReactElement {
  const glyph = c64UpperGraphicsGlyph(props.screenCode);
  return (
    <svg
      aria-hidden={props.title ? undefined : true}
      role={props.title ? 'img' : undefined}
      style={props.style}
      viewBox='0 0 8 8'
      shapeRendering='geometricPrecision'
      focusable='false'
    >
      {props.title ? <title>{props.title}</title> : undefined}
      <path d={glyph.svgPath} fill='currentColor' />
    </svg>
  );
}
