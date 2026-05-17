import { DebugState, type DebugSession } from '@theia/debug/lib/browser/debug-session';
import type { DebugRequestTypes } from '@theia/debug/lib/browser/debug-session-connection';
import type { DebugSessionManager } from '@theia/debug/lib/browser/debug-session-manager';

import { COMMODORE_VICE_DEBUG_TYPE } from '../common/commodore-vice-debug';

export interface MemoryRequestOptions {
  sideEffects?: boolean;
  memspace?: number;
  bankId?: number;
}

export const VICE_MEMORY_TIMEOUT_MS = 10000;
export const C64_IO_BANK = 3;

export function currentViceSession(
  debugSessionManager: DebugSessionManager
): DebugSession | undefined {
  const session = debugSessionManager.currentSession;
  return session?.configuration.type === COMMODORE_VICE_DEBUG_TYPE
    ? session
    : undefined;
}

export function requireViceSession(
  debugSessionManager: DebugSessionManager,
  write: boolean
): DebugSession {
  const session = currentViceSession(debugSessionManager);
  if (!session) {
    throw new Error('Start a commodore-vice debug session first.');
  }
  if (session.state !== DebugState.Stopped) {
    throw new Error('Pause or stop at a breakpoint before using VICE memory.');
  }
  if (!session.capabilities.supportsReadMemoryRequest) {
    throw new Error('The active debug session does not support memory reads.');
  }
  if (write && !session.capabilities.supportsWriteMemoryRequest) {
    throw new Error('The active debug session does not support memory writes.');
  }
  return session;
}

export async function resolveViceAddress(
  session: DebugSession,
  input: string
): Promise<number> {
  const parsed = parseOptionalAddress(input);
  if (parsed !== undefined) {
    return parsed;
  }
  const result = await session.evaluate(input.trim(), 'watch');
  const address =
    parseOptionalAddress(result.memoryReference ?? '') ??
    parseOptionalAddress(result.result);
  if (address === undefined) {
    throw new Error(`Could not resolve memory address: ${input}`);
  }
  return address;
}

export async function readViceMemory(
  session: DebugSession,
  address: number,
  count: number,
  options: MemoryRequestOptions = {}
): Promise<Uint8Array> {
  const response = await session.sendRequest(
    'readMemory',
    {
      memoryReference: memoryReference(address),
      count,
      ...options
    } as DebugRequestTypes['readMemory'][0] & MemoryRequestOptions,
    VICE_MEMORY_TIMEOUT_MS
  );
  return response.body?.data
    ? decodeBase64(response.body.data)
    : new Uint8Array(0);
}

export async function writeViceMemory(
  session: DebugSession,
  address: number,
  bytes: Uint8Array,
  options: MemoryRequestOptions = {}
): Promise<void> {
  await session.sendRequest(
    'writeMemory',
    {
      memoryReference: memoryReference(address),
      data: encodeBase64(bytes),
      ...options
    } as DebugRequestTypes['writeMemory'][0] & MemoryRequestOptions,
    VICE_MEMORY_TIMEOUT_MS
  );
}

export function parseOptionalAddress(input: string): number | undefined {
  const value = input.trim();
  if (/^\$[0-9a-f]{1,4}$/iu.test(value)) {
    return Number.parseInt(value.slice(1), 16);
  }
  if (/^0x[0-9a-f]{1,4}$/iu.test(value)) {
    return Number.parseInt(value.slice(2), 16);
  }
  if (/^[0-9a-f]{1,4}$/iu.test(value)) {
    return Number.parseInt(value, 16);
  }
  if (/^\d{1,5}$/u.test(value)) {
    const parsed = Number.parseInt(value, 10);
    return parsed >= 0 && parsed <= 0xffff ? parsed : undefined;
  }
  return undefined;
}

export function memoryReference(address: number): string {
  return `0x${(address & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`;
}

export function formatAddress(address: number): string {
  return `$${(address & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`;
}

export function hexByte(value: number): string {
  return (value & 0xff).toString(16).toUpperCase().padStart(2, '0');
}

function decodeBase64(data: string): Uint8Array {
  const decoded = atob(data);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}

function encodeBase64(bytes: Uint8Array): string {
  let decoded = '';
  for (const byte of bytes) {
    decoded += String.fromCharCode(byte);
  }
  return btoa(decoded);
}
