import * as React from 'react';

import type { TooltipAttributes } from '@theia/core/lib/browser';

export interface SidKnobProps {
  readonly label: string;
  readonly ariaLabel: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly formattedValue?: string;
  readonly disabled?: boolean;
  readonly title?: string;
  readonly tooltipAttributes?: TooltipAttributes;
  readonly onChange: (value: number) => void;
}

export function SidKnob(props: SidKnobProps): React.ReactElement {
  const percent = (props.value - props.min) / (props.max - props.min);
  const clampedPercent = Math.max(0, Math.min(1, percent));
  const angle = -130 + clampedPercent * 260;
  const fill = clampedPercent * 260;
  const style = {
    '--cc-sid-knob-angle': `${angle}deg`,
    '--cc-sid-knob-fill': `${fill}deg`
  } as React.CSSProperties;
  const formatted = props.formattedValue ?? String(props.value);
  const labelClass = `cc-sid-knob${props.disabled ? ' cc-sid-knob--disabled' : ''}`;

  return (
    <label
      {...props.tooltipAttributes}
      className={labelClass}
      title={props.title}
    >
      <span className='cc-sid-knob__value'>{formatted}</span>
      <span className='cc-sid-knob__dial' style={style}>
        <input
          className='cc-sid-knob__input'
          type='range'
          min={props.min}
          max={props.max}
          step={props.step ?? 1}
          value={props.value}
          aria-label={props.ariaLabel}
          disabled={props.disabled}
          onChange={(event) => props.onChange(Number(event.currentTarget.value))}
        />
      </span>
      <span className='cc-sid-knob__label'>{props.label}</span>
    </label>
  );
}
