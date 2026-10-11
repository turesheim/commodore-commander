import {
    COMMODORE_VICE_EMBED_BINARY_FRAME_MAGIC,
    getViceEmbedBinaryFrameRecordLength,
    startsWithViceEmbedBinaryFrame
} from './vice-binary-frame';

const MAX_BUFFER_BYTES = 32 * 1024 * 1024;

export interface ViceEmbeddedStdoutCallbacks {
    readonly onLine: (line: string) => void;
    readonly onText: (text: string) => void;
    readonly onBinaryFrame: (record: Buffer) => void;
    readonly onInvalidFrame: (error: Error) => void;
    readonly onOverflow: (buffer: Buffer, limit: number) => void;
}

/** Splits embedded stdout into text and CCB1 records without interpreting JSON. */
export class ViceEmbeddedStdoutDecoder {
    private buffer = Buffer.alloc(0);

    constructor(private readonly callbacks: ViceEmbeddedStdoutCallbacks) {}

    reset(): void {
        this.buffer = Buffer.alloc(0);
    }

    accept(chunk: Buffer): void {
        const ownedChunk = Buffer.from(chunk);
        this.buffer = this.buffer.length === 0
            ? ownedChunk
            : Buffer.concat([this.buffer, ownedChunk]);
        if (this.buffer.length > MAX_BUFFER_BYTES) {
            this.callbacks.onOverflow(this.buffer, MAX_BUFFER_BYTES);
            this.reset();
            return;
        }

        for (;;) {
            if (startsWithViceEmbedBinaryFrame(this.buffer)) {
                let recordLength: number | undefined;
                try {
                    recordLength = getViceEmbedBinaryFrameRecordLength(this.buffer);
                } catch (error) {
                    this.callbacks.onInvalidFrame(error instanceof Error ? error : new Error(String(error)));
                    this.buffer = this.buffer.subarray(COMMODORE_VICE_EMBED_BINARY_FRAME_MAGIC.length);
                    continue;
                }
                if (recordLength === undefined || this.buffer.length < recordLength) {
                    return;
                }
                const record = this.buffer.subarray(0, recordLength);
                this.buffer = this.buffer.subarray(recordLength);
                // Consumers retain their own frame validation/forwarding policy.
                this.callbacks.onBinaryFrame(record);
                continue;
            }

            const binaryIndex = this.buffer.indexOf(COMMODORE_VICE_EMBED_BINARY_FRAME_MAGIC);
            const newlineIndex = this.buffer.indexOf(0x0a);
            if (newlineIndex >= 0 && (binaryIndex < 0 || newlineIndex < binaryIndex)) {
                const line = this.buffer.subarray(0, newlineIndex + 1).toString('utf8');
                this.buffer = this.buffer.subarray(newlineIndex + 1);
                this.callbacks.onLine(line);
                continue;
            }
            if (binaryIndex > 0) {
                const text = this.buffer.subarray(0, binaryIndex).toString('utf8');
                this.buffer = this.buffer.subarray(binaryIndex);
                this.callbacks.onText(text);
                continue;
            }
            return;
        }
    }
}
