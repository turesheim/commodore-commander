import * as React from 'react';

import { codicon, ReactWidget } from '@theia/core/lib/browser';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';

import {
    CommodoreViceEmbedService,
    type CommodoreViceEmbedClient,
    type CommodoreViceEmbedFrameEvent,
    type CommodoreViceEmbedKeyEvent,
    type CommodoreViceEmbedOutputEvent,
    type CommodoreViceEmbedService as CommodoreViceEmbedServiceProxy,
    type CommodoreViceEmbedStatusEvent,
    type CommodoreViceEmbedStatusState
} from '../common/commodore-vice-embed-service';

export const VICE_EMBEDDED_WIDGET_ID = 'commodore-commander.vice-embedded';

@injectable()
export class ViceEmbeddedWidget
    extends ReactWidget
    implements CommodoreViceEmbedClient {
    @inject(CommodoreViceEmbedService)
    protected readonly viceEmbedService!: CommodoreViceEmbedServiceProxy;

    protected canvas: HTMLCanvasElement | undefined;
    protected frame: CommodoreViceEmbedFrameEvent | undefined;
    protected status: CommodoreViceEmbedStatusState = 'idle';
    protected statusMessage = 'Idle';
    protected lastOutput = '';
    protected starting = false;

    @postConstruct()
    protected init(): void {
        this.id = VICE_EMBEDDED_WIDGET_ID;
        this.title.label = 'VICE';
        this.title.caption = 'Embedded VICE';
        this.title.iconClass = codicon('vm');
        this.title.closable = true;
        this.addClass('commodore-commander-vice-embedded-widget');
        this.viceEmbedService.setClient(this);
        this.update();
    }

    override dispose(): void {
        this.viceEmbedService.setClient(undefined);
        super.dispose();
    }

    override onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.canvas?.focus();
    }

    onViceEmbedFrame(event: CommodoreViceEmbedFrameEvent): void {
        this.frame = event;
        this.drawFrame();
        this.update();
    }

    onViceEmbedStatus(event: CommodoreViceEmbedStatusEvent): void {
        this.status = event.state;
        this.statusMessage = event.message ?? event.state;
        this.starting = event.state === 'starting';
        this.update();
    }

    onViceEmbedOutput(event: CommodoreViceEmbedOutputEvent): void {
        const text = event.text.trim();
        if (text) {
            this.lastOutput = `${event.stream}: ${text.slice(0, 200)}`;
            this.update();
        }
    }

    protected override onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.drawFrame();
    }

    protected override render(): React.ReactNode {
        return (
            <div
                className='cc-vice-embed'
                style={styles.container}
            >
                <div
                    className='cc-vice-embed-toolbar'
                    style={styles.toolbar}
                >
                    <button
                        className='theia-button main'
                        title='Start patched VICE'
                        disabled={this.starting || this.status === 'running'}
                        onClick={this.startVice}
                        style={styles.button}
                    >
                        <span className={codicon('debug-start')} /> Start
                    </button>
                    <button
                        className='theia-button secondary'
                        title='Stop VICE'
                        disabled={this.status !== 'running' && this.status !== 'starting'}
                        onClick={this.stopVice}
                        style={styles.button}
                    >
                        <span className={codicon('debug-stop')} /> Stop
                    </button>
                    <span
                        className={`cc-vice-embed-status cc-vice-embed-status-${this.status}`}
                        style={styles.status}
                        title={this.lastOutput || this.statusMessage}
                    >
                        {this.statusMessage}
                    </span>
                </div>
                <div
                    className='cc-vice-embed-screen'
                    style={styles.screen}
                    onMouseDown={this.focusCanvas}
                >
                    <canvas
                        ref={this.setCanvasRef}
                        tabIndex={0}
                        role='application'
                        aria-label='Embedded VICE'
                        onKeyDown={this.handleKeyDown}
                        onKeyUp={this.handleKeyUp}
                        style={styles.canvas}
                    />
                    {!this.frame && (
                        <div style={styles.emptyState}>
                            {this.status === 'error' ? this.statusMessage : 'VICE'}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    protected readonly startVice = async (): Promise<void> => {
        this.starting = true;
        this.status = 'starting';
        this.statusMessage = 'Starting patched VICE.';
        this.update();
        try {
            await this.viceEmbedService.launch();
        } catch (error) {
            this.starting = false;
            this.status = 'error';
            this.statusMessage = error instanceof Error ? error.message : String(error);
            this.update();
        }
    };

    protected readonly stopVice = async (): Promise<void> => {
        await this.viceEmbedService.stop();
        this.status = 'stopped';
        this.statusMessage = 'Stopped';
        this.update();
    };

    protected readonly setCanvasRef = (canvas: HTMLCanvasElement | null): void => {
        this.canvas = canvas ?? undefined;
        this.drawFrame();
    };

    protected readonly focusCanvas = (): void => {
        this.canvas?.focus();
    };

    protected readonly handleKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>): void => {
        this.sendKeyEvent(event, true);
    };

    protected readonly handleKeyUp = (event: React.KeyboardEvent<HTMLCanvasElement>): void => {
        this.sendKeyEvent(event, false);
    };

    protected sendKeyEvent(event: React.KeyboardEvent<HTMLCanvasElement>, pressed: boolean): void {
        if (!event.metaKey) {
            event.preventDefault();
            event.stopPropagation();
        }
        const keyEvent: CommodoreViceEmbedKeyEvent = {
            code: event.code,
            key: event.key,
            keyCode: event.keyCode,
            pressed,
            repeat: event.repeat,
            shift: event.shiftKey,
            ctrl: event.ctrlKey,
            alt: event.altKey,
            meta: event.metaKey
        };
        void this.viceEmbedService.sendKey(keyEvent);
    }

    protected drawFrame(): void {
        const canvas = this.canvas;
        const frame = this.frame;
        if (!canvas || !frame) {
            return;
        }
        const expectedLength = frame.width * frame.height * 4;
        const bytes = decodeBase64(frame.data);
        if (bytes.length !== expectedLength) {
            this.status = 'error';
            this.statusMessage = `Invalid VICE frame size: ${bytes.length}/${expectedLength}.`;
            this.update();
            return;
        }
        canvas.width = frame.width;
        canvas.height = frame.height;
        const context = canvas.getContext('2d');
        if (!context) {
            return;
        }
        const imageData = new ImageData(
            new Uint8ClampedArray(bytes),
            frame.width,
            frame.height
        );
        context.putImageData(imageData, 0, 0);
    }
}

function decodeBase64(value: string): Uint8Array {
    const binary = window.atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: 'var(--theia-editor-background)'
    } satisfies React.CSSProperties,
    toolbar: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        borderBottom: '1px solid var(--theia-panel-border)',
        background: 'var(--theia-sideBar-background)'
    } satisfies React.CSSProperties,
    button: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4
    } satisfies React.CSSProperties,
    status: {
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        color: 'var(--theia-descriptionForeground)',
        fontSize: 'var(--theia-ui-font-size1)',
        lineHeight: '20px'
    } satisfies React.CSSProperties,
    screen: {
        position: 'relative',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: '#050608'
    } satisfies React.CSSProperties,
    canvas: {
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        imageRendering: 'pixelated',
        outline: 'none'
    } satisfies React.CSSProperties,
    emptyState: {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--theia-disabledForeground)',
        fontSize: 18,
        letterSpacing: 0
    } satisfies React.CSSProperties
};
