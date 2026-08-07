import { Endpoint } from '@theia/core/lib/browser/endpoint';

import {
  CommodoreViceEmbedFrameSocketPath
} from '../common/commodore-vice-embed-service';

const BINARY_FRAME_MAGIC = [0x43, 0x43, 0x42, 0x31]; // CCB1
const BINARY_FRAME_HEADER_BYTES = 32;
const BINARY_FRAME_TYPE_RGBA8888 = 1;
const BINARY_PIXEL_FORMAT_RGBA8888 = 1;

export interface ViceEmbedBinaryFrame {
  readonly type: 'frame';
  readonly frameId: number;
  readonly width: number;
  readonly height: number;
  readonly pixelFormat: 'rgba8888';
  readonly timestamp: number;
  readonly flags: number;
  readonly data: Uint8ClampedArray<ArrayBuffer>;
}

export function createViceEmbedFrameSocket(
  onFrame: (frame: ViceEmbedBinaryFrame) => void,
  onError?: (message: string) => void
): WebSocket {
  const url = new Endpoint({
    path: CommodoreViceEmbedFrameSocketPath
  }).getWebSocketUrl().toString();
  const socket = new WebSocket(url);
  let pendingFrame: ViceEmbedBinaryFrame | undefined;
  let animationFrame: number | undefined;
  const flushPendingFrame = (): void => {
    animationFrame = undefined;
    const frame = pendingFrame;
    pendingFrame = undefined;
    if (frame) {
      onFrame(frame);
    }
  };
  const scheduleFrame = (frame: ViceEmbedBinaryFrame): void => {
    pendingFrame = frame;
    if (animationFrame === undefined) {
      animationFrame = window.requestAnimationFrame(flushPendingFrame);
    }
  };
  socket.binaryType = 'arraybuffer';
  socket.onmessage = (event) => {
    try {
      const buffer = readFrameMessage(event.data);
      if (buffer instanceof Promise) {
        void buffer.then((resolved) => {
          if (resolved) {
            scheduleFrame(parseViceEmbedBinaryFrameRecord(resolved));
          }
        }).catch((error) => {
          onError?.(error instanceof Error ? error.message : String(error));
        });
        return;
      }
      if (buffer) {
        scheduleFrame(parseViceEmbedBinaryFrameRecord(buffer));
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : String(error));
    }
  };
  socket.onclose = () => {
    if (animationFrame !== undefined) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = undefined;
    }
    pendingFrame = undefined;
  };
  socket.onerror = () => onError?.('VICE frame socket failed.');
  return socket;
}

export function parseViceEmbedBinaryFrameRecord(
  record: ArrayBuffer
): ViceEmbedBinaryFrame {
  if (record.byteLength < BINARY_FRAME_HEADER_BYTES) {
    throw new Error('Incomplete VICE binary frame header.');
  }

  const bytes = new Uint8Array(record);
  for (let index = 0; index < BINARY_FRAME_MAGIC.length; index += 1) {
    if (bytes[index] !== BINARY_FRAME_MAGIC[index]) {
      throw new Error('Missing VICE binary frame magic.');
    }
  }

  const view = new DataView(record);
  const frameType = view.getUint8(4);
  const pixelFormat = view.getUint8(5);
  const headerLength = view.getUint16(6, true);
  const payloadLength = view.getUint32(8, true);
  const frameId = view.getUint32(12, true);
  const timestamp = Number(view.getBigUint64(16, true));
  const width = view.getUint16(24, true);
  const height = view.getUint16(26, true);
  const flags = view.getUint32(28, true);

  if (frameType !== BINARY_FRAME_TYPE_RGBA8888) {
    throw new Error(`Unsupported VICE binary frame type: ${frameType}.`);
  }
  if (pixelFormat !== BINARY_PIXEL_FORMAT_RGBA8888) {
    throw new Error(`Unsupported VICE binary pixel format: ${pixelFormat}.`);
  }
  if (headerLength < BINARY_FRAME_HEADER_BYTES) {
    throw new Error(`Invalid VICE binary frame header length: ${headerLength}.`);
  }
  if (record.byteLength < headerLength + payloadLength) {
    throw new Error('Incomplete VICE binary frame payload.');
  }
  if (payloadLength !== width * height * 4) {
    throw new Error(`Invalid VICE binary frame size: ${payloadLength}/${width * height * 4}.`);
  }

  return {
    type: 'frame',
    frameId,
    width,
    height,
    pixelFormat: 'rgba8888',
    timestamp,
    flags,
    data: new Uint8ClampedArray(record, headerLength, payloadLength)
  };
}

function readFrameMessage(
  data: unknown
): ArrayBuffer | Promise<ArrayBuffer> | undefined {
  if (data instanceof ArrayBuffer) {
    return data;
  }
  if (data instanceof Blob) {
    return data.arrayBuffer();
  }
  return undefined;
}
