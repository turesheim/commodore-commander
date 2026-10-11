import {
    COMMODORE_VICE_EMBED_BINARY_FRAME_MAGIC,
    getViceEmbedBinaryFrameRecordLength,
    parseViceEmbedBinaryFrameRecord,
    startsWithViceEmbedBinaryFrame
} from './vice-binary-frame';

const MAX_FRAME_TRANSPORT_BUFFER_BYTES = 32 * 1024 * 1024;

export interface ViceFrameDecoderCallbacks {
    readonly onFrame: (record: Buffer) => void;
    readonly onError: (error: Error) => void;
}

/** Reassembles the native CCB1 TCP stream; unrelated bytes are skipped. */
export class ViceFrameDecoder {
    private buffer = Buffer.alloc(0);

    constructor(private readonly callbacks: ViceFrameDecoderCallbacks) {}

    reset(): void {
        this.buffer = Buffer.alloc(0);
    }

    accept(chunk: Buffer): void {
        const ownedChunk = Buffer.from(chunk);
        this.buffer = this.buffer.length === 0
            ? ownedChunk
            : Buffer.concat([this.buffer, ownedChunk]);
        if (this.buffer.length > MAX_FRAME_TRANSPORT_BUFFER_BYTES) {
            this.callbacks.onError(new Error('Patched VICE frame transport buffer was too large.'));
            this.buffer = Buffer.alloc(0);
            return;
        }

        for (;;) {
            if (this.buffer.length < COMMODORE_VICE_EMBED_BINARY_FRAME_MAGIC.length) {
                return;
            }
            if (!startsWithViceEmbedBinaryFrame(this.buffer)) {
                const binaryIndex = this.buffer.indexOf(
                    COMMODORE_VICE_EMBED_BINARY_FRAME_MAGIC,
                    1
                );
                if (binaryIndex >= 0) {
                    this.buffer = this.buffer.subarray(binaryIndex);
                    continue;
                }
                this.buffer = this.buffer.subarray(
                    Math.max(
                        0,
                        this.buffer.length -
                            (COMMODORE_VICE_EMBED_BINARY_FRAME_MAGIC.length - 1)
                    )
                );
                return;
            }

            let recordLength: number | undefined;
            try {
                recordLength = getViceEmbedBinaryFrameRecordLength(this.buffer);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.callbacks.onError(new Error(`Invalid patched VICE binary frame: ${message}`));
                this.buffer = this.buffer.subarray(
                    COMMODORE_VICE_EMBED_BINARY_FRAME_MAGIC.length
                );
                continue;
            }
            if (recordLength === undefined || this.buffer.length < recordLength) {
                return;
            }

            const record = this.buffer.subarray(0, recordLength);
            this.buffer = this.buffer.subarray(recordLength);
            try {
                this.callbacks.onFrame(parseViceEmbedBinaryFrameRecord(record).record);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.callbacks.onError(new Error(`Invalid patched VICE binary frame: ${message}`));
            }
        }
    }
}
