import type { DebugProtocol } from '@vscode/debugprotocol';

import { DapClient } from './dap-client';

export interface C64VisualSnapshot {
  cia2: Uint8Array;
  colorBytes: Uint8Array;
  screenBytes: Uint8Array;
  sprite0: SpriteSnapshot;
  video: VideoSnapshot;
  vic: Uint8Array;
}

export interface VideoSnapshot {
  bankBase: number;
  bankSelect: number;
  bitmapBase: number;
  characterBase: number;
  memoryControl: number;
  screenBase: number;
}

export interface SpriteSnapshot {
  color: number;
  dataAddress: number;
  enabled: boolean;
  pointer: number;
  x: number;
  y: number;
}

interface ViceMemoryBank {
  id: number;
  name: string;
}

const ACTIVE_BANK = 0;
const C64_IO_BANK = 3;
const C64_RAM_BANK = 1;
const CIA2_BASE = 0xdd00;
const CIA_REGISTER_COUNT = 0x10;
const COLOR_RAM_BYTES = 0x0400;
const MAIN_MEMORY_SPACE = 0;
const SCREEN_MATRIX_BYTES = 0x0400;
const SPRITE_BYTES = 64;
const SPRITE_POINTER_OFFSET = 0x03f8;
const VIC_BASE = 0xd000;
const VIC_REGISTER_COUNT = 0x2f;

export async function readC64VisualSnapshot(
  client: DapClient
): Promise<C64VisualSnapshot> {
  const banks = await resolveMemoryBanks(client);
  const [vic, cia2] = await Promise.all([
    readMemory(client, VIC_BASE, VIC_REGISTER_COUNT, {
      bankId: banks.ioBankId
    }),
    readMemory(client, CIA2_BASE, CIA_REGISTER_COUNT, {
      bankId: banks.ioBankId
    })
  ]);
  const video = createVideoSnapshot(vic, cia2);
  const [screenBytes, colorBytes] = await Promise.all([
    readMemory(client, video.screenBase, SCREEN_MATRIX_BYTES, {
      bankId: banks.ramBankId
    }),
    readMemory(client, 0xd800, COLOR_RAM_BYTES, {
      bankId: banks.ioBankId
    })
  ]);
  const pointer = screenBytes[SPRITE_POINTER_OFFSET] ?? 0;
  const spriteBytes = await readMemory(
    client,
    video.bankBase + pointer * SPRITE_BYTES,
    SPRITE_BYTES,
    { bankId: banks.ramBankId }
  );
  // Reading sprite data is a regression guard even though the test currently
  // asserts only the pointer and effective address. It catches bank-selection
  // mistakes where the snapshot would otherwise look plausible.
  if (spriteBytes.length !== SPRITE_BYTES) {
    throw new Error(`Expected ${SPRITE_BYTES} sprite bytes, got ${spriteBytes.length}.`);
  }

  return {
    cia2,
    colorBytes,
    screenBytes,
    sprite0: createSprite0Snapshot(vic, pointer, video.bankBase),
    video,
    vic
  };
}

async function resolveMemoryBanks(client: DapClient): Promise<{
  ioBankId: number;
  ramBankId: number;
}> {
  const response = await client.request<{ banks?: ViceMemoryBank[] }>(
    'commodore-vice/banksAvailable',
    {}
  );
  const banks = response.banks ?? [];
  return {
    ioBankId: findMemoryBankId(banks, 'io') ?? C64_IO_BANK,
    ramBankId: findMemoryBankId(banks, 'ram') ?? C64_RAM_BANK
  };
}

async function readMemory(
  client: DapClient,
  startAddress: number,
  count: number,
  options: { bankId?: number } = {}
): Promise<Uint8Array> {
  const response = await client.request<DebugProtocol.ReadMemoryResponse['body']>(
    'readMemory',
    {
      memoryReference: memoryReference(startAddress),
      count,
      sideEffects: false,
      memspace: MAIN_MEMORY_SPACE,
      bankId: options.bankId ?? ACTIVE_BANK
    }
  );
  return response?.data
    ? new Uint8Array(Buffer.from(response.data, 'base64'))
    : new Uint8Array();
}

function createVideoSnapshot(vic: Uint8Array, cia2: Uint8Array): VideoSnapshot {
  const memoryControl = vic[0x18] ?? 0;
  const bankSelect = (cia2[0] ?? 0) & 0x03;
  const bankBase = (3 - bankSelect) * 0x4000;
  return {
    bankSelect,
    bankBase,
    screenBase: bankBase + ((memoryControl >> 4) & 0x0f) * 0x0400,
    characterBase: bankBase + ((memoryControl >> 1) & 0x07) * 0x0800,
    bitmapBase: bankBase + ((memoryControl >> 3) & 0x01) * 0x2000,
    memoryControl
  };
}

function createSprite0Snapshot(
  vic: Uint8Array,
  pointer: number,
  bankBase: number
): SpriteSnapshot {
  return {
    x: (vic[0] ?? 0) + (((vic[0x10] ?? 0) & 0x01) !== 0 ? 0x100 : 0),
    y: vic[1] ?? 0,
    enabled: ((vic[0x15] ?? 0) & 0x01) !== 0,
    pointer,
    dataAddress: bankBase + pointer * SPRITE_BYTES,
    color: vic[0x27] ?? 0
  };
}

function findMemoryBankId(
  banks: readonly ViceMemoryBank[],
  name: string
): number | undefined {
  return banks.find((bank) =>
    bank.name.replace(/^\*+/u, '').trim().toLowerCase() === name
  )?.id;
}

function memoryReference(address: number): string {
  return `0x${(address & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`;
}
