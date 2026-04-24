import * as React from 'react';

import { codicon, ReactWidget } from '@theia/core/lib/browser';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { injectable } from '@theia/core/shared/inversify';

export const KICK_ASSEMBLER_BUILD_CONSOLE_WIDGET_ID =
  'commodore-commander.kick-assembler-console';

const MAX_BUFFER_LENGTH = 200_000;

@injectable()
export class KickAssemblerBuildConsoleWidget extends ReactWidget {
  private output = '';

  constructor() {
    super();
    this.id = KICK_ASSEMBLER_BUILD_CONSOLE_WIDGET_ID;
    this.title.label = 'Kick Assembler';
    this.title.caption = 'Kick Assembler Console';
    this.title.iconClass = codicon('terminal');
    this.title.closable = true;
    this.addClass('cc-kick-assembler-console');
  }

  appendOutput(chunk: string): void {
    this.output = truncateBuffer(`${this.output}${chunk}`);
    this.update();
  }

  protected override onUpdateRequest(msg: Message): void {
    super.onUpdateRequest(msg);

    const outputNode = this.node.querySelector(
      '.cc-kick-assembler-console__output'
    );
    if (outputNode instanceof HTMLElement) {
      outputNode.scrollTop = outputNode.scrollHeight;
    }
  }

  protected render(): React.ReactNode {
    return (
      <div
        style={{
          background: 'var(--cc-vic20-background, var(--theia-editor-background))',
          color: 'var(--cc-vic20-text, var(--theia-foreground))',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0
        }}
      >
        <div
          className='cc-kick-assembler-console__header'
          style={{
            background:
              'color-mix(in srgb, var(--cc-vic20-background, var(--theia-editorWidget-background)) 78%, white)',
            borderBottom: '1px solid var(--cc-vic20-highlight, var(--theia-editorGroup-border))',
            color:
              'var(--cc-vic20-label-foreground, var(--theia-descriptionForeground))',
            fontSize: '12px',
            fontWeight: 600,
            padding: '6px 10px'
          }}
        >
          Kick Assembler build output
        </div>
        <pre
          className='cc-kick-assembler-console__output'
          style={{
            background:
              'color-mix(in srgb, var(--cc-vic20-background, var(--theia-editorWidget-background)) 88%, white)',
            color: 'var(--cc-vic20-text, var(--theia-editor-foreground))',
            flex: 1,
            fontFamily: 'monospace',
            fontSize: '12px',
            margin: 0,
            minHeight: 0,
            overflow: 'auto',
            padding: '10px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}
        >
          {this.output.length > 0 ? this.output : 'Build output will appear here.'}
        </pre>
      </div>
    );
  }
}

function truncateBuffer(buffer: string): string {
  if (buffer.length <= MAX_BUFFER_LENGTH) {
    return buffer;
  }

  return buffer.slice(buffer.length - MAX_BUFFER_LENGTH);
}
