export interface Reconstructed6502CallFrame {
  stackAddress: number;
  callSiteAddress: number;
  returnAddress: number;
  targetAddress: number;
}

export interface Reconstruct6502CallStackOptions {
  stackPointer: number;
  stackPage: Buffer;
  readMemory: (startAddress: number, byteCount: number) => Promise<Buffer>;
  maxFrames?: number;
}

const JSR_ABSOLUTE_OPCODE = 0x20;
const STACK_BASE = 0x0100;
const STACK_PAGE_SIZE = 0x0100;
const MAX_6502_JSR_FRAMES = 128;

export async function reconstruct6502CallStack(
  options: Reconstruct6502CallStackOptions
): Promise<Reconstructed6502CallFrame[]> {
  const stackPointer = options.stackPointer & 0xff;
  const maxFrames = Math.max(
    0,
    Math.min(options.maxFrames ?? MAX_6502_JSR_FRAMES, MAX_6502_JSR_FRAMES)
  );
  if (stackPointer >= 0xff || maxFrames === 0) {
    return [];
  }

  const stackPage = normalizeStackPage(options.stackPage);
  const frames: Reconstructed6502CallFrame[] = [];
  let offset = stackPointer + 1;
  while (offset < STACK_PAGE_SIZE - 1 && frames.length < maxFrames) {
    const returnAddressMinusOne = stackPage.readUInt16LE(offset);
    const candidate = await validateJsrReturnAddress(
      returnAddressMinusOne,
      options.readMemory
    );
    if (candidate) {
      frames.push({
        stackAddress: STACK_BASE + offset,
        ...candidate
      });
      offset += 2;
      continue;
    }
    offset += 1;
  }
  return frames;
}

async function validateJsrReturnAddress(
  returnAddressMinusOne: number,
  readMemory: (startAddress: number, byteCount: number) => Promise<Buffer>
): Promise<Omit<Reconstructed6502CallFrame, 'stackAddress'> | undefined> {
  const callSiteAddress = returnAddressMinusOne - 2;
  if (callSiteAddress < 0 || callSiteAddress > 0xfffd) {
    return undefined;
  }

  let bytes: Buffer;
  try {
    bytes = await readMemory(callSiteAddress, 3);
  } catch {
    return undefined;
  }
  if (bytes.length < 3 || bytes[0] !== JSR_ABSOLUTE_OPCODE) {
    return undefined;
  }

  return {
    callSiteAddress,
    returnAddress: (returnAddressMinusOne + 1) & 0xffff,
    targetAddress: bytes.readUInt16LE(1)
  };
}

function normalizeStackPage(stackPage: Buffer): Buffer {
  if (stackPage.length >= STACK_PAGE_SIZE) {
    return stackPage.subarray(0, STACK_PAGE_SIZE);
  }
  const padded = Buffer.alloc(STACK_PAGE_SIZE);
  stackPage.copy(padded);
  return padded;
}
