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
import {
    createViceEmbedFrameSocket,
    type ViceEmbedBinaryFrame
} from './vice-embed-frame-stream';
import {
    calculateViceCanvasDisplaySize,
    type ViceCanvasDisplaySize
} from './vice-canvas-scaling';
import {
    isViceEmbedCommodoreFunctionKeyEvent,
    ViceEmbedKeyEventTracker
} from './vice-keyboard-mapping';

export const VICE_EMBEDDED_WIDGET_ID = 'commodore-commander.vice-embedded';

type ViceEmbedRenderableFrame = CommodoreViceEmbedFrameEvent | ViceEmbedBinaryFrame;
type ViceEmbedFrameBytes =
    | Uint8Array<ArrayBufferLike>
    | Uint8ClampedArray<ArrayBufferLike>;

@injectable()
export class ViceEmbeddedWidget
    extends ReactWidget
    implements CommodoreViceEmbedClient {
    @inject(CommodoreViceEmbedService)
    protected readonly viceEmbedService!: CommodoreViceEmbedServiceProxy;

    protected screenElement: HTMLDivElement | undefined;
    protected resizeObserver: ResizeObserver | undefined;
    protected canvas: HTMLCanvasElement | undefined;
    protected frame: ViceEmbedRenderableFrame | undefined;
    protected canvasDisplaySize: ViceCanvasDisplaySize | undefined;
    protected frameSocket: WebSocket | undefined;
    protected status: CommodoreViceEmbedStatusState = 'idle';
    protected statusMessage = 'Idle';
    protected lastOutput = '';
    protected starting = false;
    protected hostCommodorePressed = false;
    protected readonly keyEventTracker = new ViceEmbedKeyEventTracker();

    @postConstruct()
    protected init(): void {
        this.id = VICE_EMBEDDED_WIDGET_ID;
        this.title.label = 'VICE';
        this.title.caption = 'Embedded VICE';
        this.title.iconClass = codicon('vm');
        this.title.closable = true;
        this.addClass('commodore-commander-vice-embedded-widget');
        this.viceEmbedService.setClient(this);
        this.frameSocket = createViceEmbedFrameSocket(
            this.onViceEmbedBinaryFrame,
            this.onViceEmbedFrameSocketError
        );
        document.addEventListener('keydown', this.handleDocumentKeyDown, true);
        document.addEventListener('keyup', this.handleDocumentKeyUp, true);
        window.addEventListener('blur', this.handleWindowBlur);
        this.update();
    }

    override dispose(): void {
        document.removeEventListener('keydown', this.handleDocumentKeyDown, true);
        document.removeEventListener('keyup', this.handleDocumentKeyUp, true);
        window.removeEventListener('blur', this.handleWindowBlur);
        this.resizeObserver?.disconnect();
        this.resizeObserver = undefined;
        this.viceEmbedService.setClient(undefined);
        this.frameSocket?.close();
        this.frameSocket = undefined;
        super.dispose();
    }

    override onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.canvas?.focus();
    }

    onViceEmbedFrame(event: CommodoreViceEmbedFrameEvent): void {
        this.frame = event;
        this.drawFrame();
        this.refreshCanvasDisplaySize();
        this.update();
    }

    onViceEmbedStatus(event: CommodoreViceEmbedStatusEvent): void {
        this.status = event.state;
        this.statusMessage = event.message ?? event.state;
        this.starting = event.state === 'starting';
        if (event.state === 'stopped' || event.state === 'error') {
            this.keyEventTracker.reset();
            this.frame = undefined;
            this.refreshCanvasDisplaySize();
        }
        this.update();
    }

    onViceEmbedOutput(event: CommodoreViceEmbedOutputEvent): void {
        const text = event.text.trim();
        if (text) {
            this.lastOutput = `${event.stream}: ${text.slice(0, 200)}`;
            this.update();
        }
    }

    protected readonly onViceEmbedBinaryFrame = (event: ViceEmbedBinaryFrame): void => {
        const previousFrame = this.frame;
        const shouldUpdate = this.starting ||
            this.status !== 'running' ||
            previousFrame?.width !== event.width ||
            previousFrame?.height !== event.height;
        this.frame = event;
        this.status = 'running';
        this.statusMessage = 'Emulator running';
        this.starting = false;
        this.drawFrame();
        const displaySizeChanged = this.refreshCanvasDisplaySize();
        if (shouldUpdate || displaySizeChanged) {
            this.update();
        }
    };

    protected readonly onViceEmbedFrameSocketError = (message: string): void => {
        this.lastOutput = `frame socket: ${message}`;
        this.update();
    };

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
                        title='Start emulator'
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
                    ref={this.setScreenRef}
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
                        style={{
                            ...styles.canvas,
                            ...this.canvasDisplayStyle()
                        }}
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
        this.statusMessage = 'Starting emulator.';
        this.frame = undefined;
        this.refreshCanvasDisplaySize();
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
        this.keyEventTracker.reset();
        this.status = 'stopped';
        this.statusMessage = 'Stopped';
        this.frame = undefined;
        this.refreshCanvasDisplaySize();
        this.update();
    };

    protected readonly setCanvasRef = (canvas: HTMLCanvasElement | null): void => {
        this.canvas = canvas ?? undefined;
        this.drawFrame();
    };

    protected readonly setScreenRef = (element: HTMLDivElement | null): void => {
        if (this.screenElement === (element ?? undefined)) {
            return;
        }
        this.resizeObserver?.disconnect();
        this.screenElement = element ?? undefined;
        if (this.screenElement && typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(this.handleScreenResize);
            this.resizeObserver.observe(this.screenElement);
        } else {
            this.resizeObserver = undefined;
        }
        if (this.refreshCanvasDisplaySize()) {
            this.update();
        }
    };

    protected readonly handleScreenResize = (): void => {
        if (this.refreshCanvasDisplaySize()) {
            this.update();
        }
    };

    protected refreshCanvasDisplaySize(): boolean {
        const next = this.calculateCanvasDisplaySize();
        const previous = this.canvasDisplaySize;
        const changed =
            previous?.width !== next?.width ||
            previous?.height !== next?.height ||
            previous?.scale !== next?.scale;
        this.canvasDisplaySize = next;
        return changed;
    }

    protected calculateCanvasDisplaySize(): ViceCanvasDisplaySize | undefined {
        if (!this.frame || !this.screenElement) {
            return undefined;
        }
        return calculateViceCanvasDisplaySize(
            this.frame.width,
            this.frame.height,
            this.screenElement.clientWidth,
            this.screenElement.clientHeight
        );
    }

    protected canvasDisplayStyle(): React.CSSProperties {
        const displaySize = this.canvasDisplaySize;
        if (!displaySize) {
            return {};
        }
        return {
            width: displaySize.width,
            height: displaySize.height,
            maxWidth: 'none',
            maxHeight: 'none',
            flexShrink: 0
        };
    }

    protected readonly focusCanvas = (): void => {
        this.canvas?.focus();
    };

    protected readonly handleKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>): void => {
        this.sendKeyEvent(event, true);
    };

    protected readonly handleKeyUp = (event: React.KeyboardEvent<HTMLCanvasElement>): void => {
        this.sendKeyEvent(event, false);
    };

    protected readonly handleDocumentKeyDown = (event: KeyboardEvent): void => {
        this.handleCommodoreFunctionKey(event, true);
    };

    protected readonly handleDocumentKeyUp = (event: KeyboardEvent): void => {
        this.handleCommodoreFunctionKey(event, false);
    };

    protected handleCommodoreFunctionKey(
        event: KeyboardEvent,
        pressed: boolean
    ): boolean {
        if (
            this.status !== 'running' ||
            this.starting ||
            !isViceEmbedCommodoreFunctionKeyEvent(event) ||
            !this.hasKeyboardFocus(event)
        ) {
            return false;
        }

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        void this.viceEmbedService.sendKey(
            this.keyEventTracker.createKeyEvent(
                this.keyboardEventForEmulator(event),
                pressed
            )
        );
        return true;
    }

    protected hasKeyboardFocus(event: KeyboardEvent): boolean {
        const target = event.target;
        if (target instanceof Node && this.node.contains(target)) {
            return true;
        }
        const activeElement = document.activeElement;
        return activeElement instanceof Node && this.node.contains(activeElement);
    }

    protected sendKeyEvent(event: React.KeyboardEvent<HTMLCanvasElement>, pressed: boolean): void {
        if (!event.metaKey) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (isHostCommodoreKeyEvent(event)) {
            this.hostCommodorePressed = pressed;
        }
        const keyEvent: CommodoreViceEmbedKeyEvent =
            this.keyEventTracker.createKeyEvent(
                this.keyboardEventForEmulator(event),
                pressed
            );
        void this.viceEmbedService.sendKey(keyEvent);
    }

    protected readonly handleWindowBlur = (): void => {
        for (const keyEvent of this.keyEventTracker.releasePressedMatrixKeys()) {
            void this.viceEmbedService.sendKey(keyEvent);
        }
    };

    protected keyboardEventForEmulator(
        event: React.KeyboardEvent<HTMLCanvasElement> | KeyboardEvent
    ): React.KeyboardEvent<HTMLCanvasElement> | KeyboardEvent | NormalizedKeyboardEventLike {
        if (
            this.hostCommodorePressed &&
            event.altKey &&
            !isHostCommodoreKeyEvent(event)
        ) {
            const unmodified = unmodifiedKeyboardEventFromCode(event);
            if (unmodified) {
                return unmodified;
            }
        }
        return event;
    }

    protected drawFrame(): void {
        const canvas = this.canvas;
        const frame = this.frame;
        if (!canvas || !frame) {
            return;
        }
        const expectedLength = frame.width * frame.height * 4;
        const bytes = getFrameBytes(frame);
        if (bytes.length !== expectedLength) {
            this.status = 'error';
            this.statusMessage = `Invalid VICE frame size: ${bytes.length}/${expectedLength}.`;
            this.update();
            return;
        }
        if (canvas.width !== frame.width) {
            canvas.width = frame.width;
        }
        if (canvas.height !== frame.height) {
            canvas.height = frame.height;
        }
        const context = canvas.getContext('2d');
        if (!context) {
            return;
        }
        context.imageSmoothingEnabled = false;
        const imageData = new ImageData(toClampedBytes(bytes), frame.width, frame.height);
        context.putImageData(imageData, 0, 0);
    }
}

function getFrameBytes(frame: ViceEmbedRenderableFrame): ViceEmbedFrameBytes {
    return typeof frame.data === 'string'
        ? decodeBase64(frame.data)
        : frame.data;
}

function decodeBase64(value: string): Uint8Array {
    const binary = window.atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}

function toClampedBytes(bytes: ViceEmbedFrameBytes): Uint8ClampedArray<ArrayBuffer> {
    return bytes instanceof Uint8ClampedArray && bytes.buffer instanceof ArrayBuffer
        ? bytes as Uint8ClampedArray<ArrayBuffer>
        : new Uint8ClampedArray(bytes) as Uint8ClampedArray<ArrayBuffer>;
}

interface NormalizedKeyboardEventLike {
    readonly code: string;
    readonly key: string;
    readonly keyCode: number;
    readonly repeat: boolean;
    readonly shiftKey: boolean;
    readonly ctrlKey: boolean;
    readonly altKey: boolean;
    readonly metaKey: boolean;
}

function isHostCommodoreKeyEvent(
    event: Pick<KeyboardEvent, 'code'>
): boolean {
    return event.code === 'AltLeft';
}

function unmodifiedKeyboardEventFromCode(
    event: Pick<KeyboardEvent, 'code' | 'repeat' | 'shiftKey' | 'ctrlKey' | 'metaKey'>
): NormalizedKeyboardEventLike | undefined {
    const key = unmodifiedKeyFromCode(event.code);
    if (!key) {
        return undefined;
    }
    return {
        code: event.code,
        key,
        keyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0,
        repeat: event.repeat,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        altKey: false,
        metaKey: event.metaKey
    };
}

function unmodifiedKeyFromCode(code: string): string | undefined {
    const letterMatch = /^Key([A-Z])$/u.exec(code);
    if (letterMatch) {
        return letterMatch[1].toLowerCase();
    }
    const digitMatch = /^Digit(\d)$/u.exec(code);
    if (digitMatch) {
        return digitMatch[1];
    }
    switch (code) {
        case 'Space':
            return ' ';
        case 'Comma':
            return ',';
        case 'Period':
            return '.';
        case 'Slash':
            return '/';
        case 'Semicolon':
            return ';';
        case 'Quote':
            return "'";
        case 'BracketLeft':
            return '[';
        case 'BracketRight':
            return ']';
        case 'Minus':
            return '-';
        case 'Equal':
            return '=';
        case 'Backslash':
            return '\\';
        default:
            return undefined;
    }
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
        alignItems: 'flex-start',
        justifyContent: 'center',
        overflow: 'auto',
        background: 'var(--theia-editor-background)'
    } satisfies React.CSSProperties,
    canvas: {
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        imageRendering: 'pixelated',
        outline: 'none',
        border: '1px solid #000',
        boxSizing: 'border-box',
        background: '#000'
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
