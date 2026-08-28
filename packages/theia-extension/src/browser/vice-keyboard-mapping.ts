import type { CommodoreViceEmbedKeyEvent } from '../common/commodore-vice-embed-service';

export interface ViceEmbedKeyboardEventLike {
    readonly code: string;
    readonly key: string;
    readonly keyCode: number;
    readonly repeat: boolean;
    readonly shiftKey: boolean;
    readonly ctrlKey: boolean;
    readonly altKey: boolean;
    readonly metaKey: boolean;
}

interface KeyMapping {
    readonly keyCode: number;
    readonly shift?: boolean;
    readonly ctrl?: boolean;
    readonly alt?: boolean;
    readonly matrix?: C64MatrixKeyMapping;
}

interface C64MatrixKeyMapping {
    readonly row: number;
    readonly col: number;
    readonly shift?: boolean;
}

const SDL_KEY_BACKSPACE = 8;
const SDL_KEY_TAB = 9;
const SDL_KEY_RETURN = 13;
const SDL_KEY_ESCAPE = 27;
const SDL_KEY_UNKNOWN = 0;
const SDL_KEY_SPACE = 32;
const SDL_KEY_DELETE = 127;
const SDL_KEY_INSERT = 277;
const SDL_KEY_HOME = 278;
const SDL_KEY_END = 279;
const SDL_KEY_PAGEUP = 280;
const SDL_KEY_PAGEDOWN = 281;
const SDL_KEY_UP = 273;
const SDL_KEY_DOWN = 274;
const SDL_KEY_RIGHT = 275;
const SDL_KEY_LEFT = 276;
const SDL_KEY_F1 = 282;
const SDL_KEY_LCTRL = 306;
const SDL_KEY_RCTRL = 305;

const C64_MATRIX_DELETE = c64MatrixKey(0, 0);
const C64_MATRIX_INSERT = c64MatrixKey(0, 0, true);
const C64_MATRIX_CURSOR_RIGHT = c64MatrixKey(0, 2);
const C64_MATRIX_CURSOR_LEFT = c64MatrixKey(0, 2, true);
const C64_MATRIX_CURSOR_DOWN = c64MatrixKey(0, 7);
const C64_MATRIX_CURSOR_UP = c64MatrixKey(0, 7, true);
const C64_MATRIX_F1 = c64MatrixKey(0, 4);
const C64_MATRIX_F2 = c64MatrixKey(0, 4, true);
const C64_MATRIX_F3 = c64MatrixKey(0, 5);
const C64_MATRIX_F4 = c64MatrixKey(0, 5, true);
const C64_MATRIX_F5 = c64MatrixKey(0, 6);
const C64_MATRIX_F6 = c64MatrixKey(0, 6, true);
const C64_MATRIX_F7 = c64MatrixKey(0, 3);
const C64_MATRIX_F8 = c64MatrixKey(0, 3, true);
const C64_MATRIX_EXCLAMATION_MARK = c64MatrixKey(7, 0, true);
const C64_MATRIX_DOUBLE_QUOTE = c64MatrixKey(7, 3, true);
const C64_MATRIX_HASH = c64MatrixKey(1, 0, true);
const C64_MATRIX_DOLLAR = c64MatrixKey(1, 3, true);
const C64_MATRIX_PERCENT = c64MatrixKey(2, 0, true);
const C64_MATRIX_AMPERSAND = c64MatrixKey(2, 3, true);
const C64_MATRIX_LEFT_PAREN = c64MatrixKey(3, 3, true);
const C64_MATRIX_RIGHT_PAREN = c64MatrixKey(4, 0, true);
const C64_MATRIX_COMMA = c64MatrixKey(5, 7);
const C64_MATRIX_LESS_THAN = c64MatrixKey(5, 7, true);
const C64_MATRIX_PERIOD = c64MatrixKey(5, 4);
const C64_MATRIX_GREATER_THAN = c64MatrixKey(5, 4, true);
const C64_MATRIX_SLASH = c64MatrixKey(6, 7);
const C64_MATRIX_QUESTION_MARK = c64MatrixKey(6, 7, true);
const C64_MATRIX_ARROW_UP = c64MatrixKey(6, 6);
const C64_MATRIX_PI = c64MatrixKey(6, 6, true);
const C64_MATRIX_CBM = c64MatrixKey(7, 5);

const HOST_ONLY_MODIFIER_KEY: KeyMapping = {
    keyCode: SDL_KEY_UNKNOWN,
    shift: false,
    ctrl: false,
    alt: false
};

const FUNCTION_SDL_KEYS_BY_CODE: Record<string, KeyMapping> = {
    F1: { keyCode: SDL_KEY_F1, shift: false, matrix: C64_MATRIX_F1 },
    F2: { keyCode: SDL_KEY_F1, shift: false, matrix: C64_MATRIX_F2 },
    F3: { keyCode: SDL_KEY_F1 + 2, shift: false, matrix: C64_MATRIX_F3 },
    F4: { keyCode: SDL_KEY_F1 + 2, shift: false, matrix: C64_MATRIX_F4 },
    F5: { keyCode: SDL_KEY_F1 + 4, shift: false, matrix: C64_MATRIX_F5 },
    F6: { keyCode: SDL_KEY_F1 + 4, shift: false, matrix: C64_MATRIX_F6 },
    F7: { keyCode: SDL_KEY_F1 + 6, shift: false, matrix: C64_MATRIX_F7 },
    F8: { keyCode: SDL_KEY_F1 + 6, shift: false, matrix: C64_MATRIX_F8 }
};

// Fallback for layouts/events that do not expose the shifted number-row symbol
// through event.key. Host-visible printable characters still take precedence.
// This follows the Nordic ISO Mac cases reported for the embedded emulator.
const SHIFTED_NUMBER_ROW_FALLBACK_SDL_KEYS_BY_CODE: Record<string, KeyMapping> = {
    Digit0: { keyCode: charCode('='), shift: false },
    Digit1: { keyCode: charCode('1'), shift: false, matrix: C64_MATRIX_EXCLAMATION_MARK },
    Digit2: { keyCode: charCode('2'), shift: false, matrix: C64_MATRIX_DOUBLE_QUOTE },
    Digit3: { keyCode: charCode('3'), shift: false, matrix: C64_MATRIX_HASH },
    Digit4: { keyCode: charCode('4'), shift: false, matrix: C64_MATRIX_DOLLAR },
    Digit5: { keyCode: charCode('5'), shift: false, matrix: C64_MATRIX_PERCENT },
    Digit6: { keyCode: charCode('6'), shift: false, matrix: C64_MATRIX_AMPERSAND },
    Digit7: { keyCode: charCode('/'), shift: false },
    Digit8: { keyCode: charCode('8'), shift: false, matrix: C64_MATRIX_LEFT_PAREN },
    Digit9: { keyCode: charCode('9'), shift: false, matrix: C64_MATRIX_RIGHT_PAREN }
};

// These are SDL keysyms for VICE's keyboard map, not PETSCII or screen codes.
// The emulated machine turns the resulting key matrix state into PETSCII.
const PRINTABLE_SDL_KEYS: Record<string, KeyMapping> = {
    ' ': { keyCode: SDL_KEY_SPACE },
    '!': { keyCode: charCode('1'), shift: false, matrix: C64_MATRIX_EXCLAMATION_MARK },
    '"': { keyCode: charCode('2'), shift: false, matrix: C64_MATRIX_DOUBLE_QUOTE },
    '#': { keyCode: charCode('3'), shift: false, matrix: C64_MATRIX_HASH },
    '$': { keyCode: charCode('4'), shift: false, matrix: C64_MATRIX_DOLLAR },
    '%': { keyCode: charCode('5'), shift: false, matrix: C64_MATRIX_PERCENT },
    '&': { keyCode: charCode('6'), shift: false, matrix: C64_MATRIX_AMPERSAND },
    "'": { keyCode: charCode("'") },
    '(': { keyCode: charCode('8'), shift: false, matrix: C64_MATRIX_LEFT_PAREN },
    ')': { keyCode: charCode('9'), shift: false, matrix: C64_MATRIX_RIGHT_PAREN },
    '*': { keyCode: charCode('8'), shift: true },
    '+': { keyCode: charCode('='), shift: true },
    ',': { keyCode: charCode(','), matrix: C64_MATRIX_COMMA },
    '-': { keyCode: charCode('-') },
    '.': { keyCode: charCode('.'), matrix: C64_MATRIX_PERIOD },
    '/': { keyCode: charCode('/'), matrix: C64_MATRIX_SLASH },
    '0': { keyCode: charCode('0') },
    '1': { keyCode: charCode('1') },
    '2': { keyCode: charCode('2') },
    '3': { keyCode: charCode('3') },
    '4': { keyCode: charCode('4') },
    '5': { keyCode: charCode('5') },
    '6': { keyCode: charCode('6') },
    '7': { keyCode: charCode('7') },
    '8': { keyCode: charCode('8') },
    '9': { keyCode: charCode('9') },
    ':': { keyCode: charCode(';'), shift: true },
    ';': { keyCode: charCode(';') },
    '<': { keyCode: charCode(','), shift: false, matrix: C64_MATRIX_LESS_THAN },
    '=': { keyCode: charCode('=') },
    '>': { keyCode: charCode('.'), shift: false, matrix: C64_MATRIX_GREATER_THAN },
    '?': { keyCode: charCode('/'), shift: false, matrix: C64_MATRIX_QUESTION_MARK },
    '@': { keyCode: charCode('2'), shift: true },
    '[': { keyCode: charCode('[') },
    '\\': { keyCode: charCode('\\') },
    ']': { keyCode: charCode(']') },
    '^': { keyCode: SDL_KEY_PAGEDOWN, matrix: C64_MATRIX_ARROW_UP },
    '_': { keyCode: charCode('-'), shift: true },
    '`': { keyCode: charCode('`') },
    '£': { keyCode: charCode('\\') },
    '¤': { keyCode: charCode('4'), shift: false, matrix: C64_MATRIX_DOLLAR },
    '↑': { keyCode: SDL_KEY_PAGEDOWN, matrix: C64_MATRIX_ARROW_UP },
    'π': { keyCode: SDL_KEY_PAGEDOWN, matrix: C64_MATRIX_PI },
    '~': { keyCode: charCode('`'), shift: true }
};

const CONTROL_SDL_KEYS_BY_CODE: Record<string, KeyMapping> = {
    Backspace: { keyCode: SDL_KEY_BACKSPACE, matrix: C64_MATRIX_DELETE },
    Tab: { keyCode: SDL_KEY_TAB },
    Enter: { keyCode: SDL_KEY_RETURN },
    NumpadEnter: { keyCode: SDL_KEY_RETURN },
    Escape: { keyCode: SDL_KEY_ESCAPE },
    Space: { keyCode: SDL_KEY_SPACE },
    ArrowLeft: { keyCode: SDL_KEY_LEFT, matrix: C64_MATRIX_CURSOR_LEFT },
    ArrowUp: { keyCode: SDL_KEY_UP, matrix: C64_MATRIX_CURSOR_UP },
    ArrowRight: { keyCode: SDL_KEY_RIGHT, matrix: C64_MATRIX_CURSOR_RIGHT },
    ArrowDown: { keyCode: SDL_KEY_DOWN, matrix: C64_MATRIX_CURSOR_DOWN },
    Insert: { keyCode: SDL_KEY_INSERT, matrix: C64_MATRIX_INSERT },
    Delete: { keyCode: SDL_KEY_DELETE, matrix: C64_MATRIX_DELETE },
    Home: { keyCode: SDL_KEY_HOME },
    End: { keyCode: SDL_KEY_END },
    PageUp: { keyCode: SDL_KEY_PAGEUP },
    PageDown: { keyCode: SDL_KEY_PAGEDOWN },
    ShiftLeft: HOST_ONLY_MODIFIER_KEY,
    ShiftRight: HOST_ONLY_MODIFIER_KEY,
    ControlLeft: { keyCode: SDL_KEY_LCTRL },
    ControlRight: { keyCode: SDL_KEY_RCTRL },
    AltLeft: { keyCode: SDL_KEY_TAB, shift: false, alt: false, matrix: C64_MATRIX_CBM },
    AltRight: HOST_ONLY_MODIFIER_KEY
};

export function createViceEmbedKeyEvent(
    event: ViceEmbedKeyboardEventLike,
    pressed: boolean
): CommodoreViceEmbedKeyEvent {
    const sdlMapping = resolveSdlKeyMapping(event);

    return {
        code: event.code,
        key: event.key,
        keyCode: event.keyCode,
        pressed,
        repeat: event.repeat,
        shift: event.shiftKey,
        ctrl: event.ctrlKey,
        alt: event.altKey,
        meta: event.metaKey,
        ...(sdlMapping ? {
            sdlKeyCode: sdlMapping.keyCode,
            sdlShift: sdlMapping.shift ?? event.shiftKey,
            sdlCtrl: sdlMapping.ctrl ?? event.ctrlKey,
            sdlAlt: sdlMapping.alt ?? event.altKey,
            ...(sdlMapping.matrix ? {
                matrixRow: sdlMapping.matrix.row,
                matrixCol: sdlMapping.matrix.col,
                matrixShift: sdlMapping.matrix.shift ?? false
            } : {})
        } : {})
    };
}

export class ViceEmbedKeyEventTracker {
    protected readonly pressedMatrixKeys = new Map<string, CommodoreViceEmbedKeyEvent>();

    createKeyEvent(
        event: ViceEmbedKeyboardEventLike,
        pressed: boolean
    ): CommodoreViceEmbedKeyEvent {
        const keyEvent = createViceEmbedKeyEvent(event, pressed);
        const identity = viceEmbedKeyboardEventIdentity(event);

        if (pressed) {
            if (isMatrixKeyEvent(keyEvent)) {
                this.pressedMatrixKeys.set(identity, keyEvent);
            } else {
                this.pressedMatrixKeys.delete(identity);
            }
            return keyEvent;
        }

        const pressedKeyEvent = this.pressedMatrixKeys.get(identity);
        this.pressedMatrixKeys.delete(identity);
        if (pressedKeyEvent && !isSameMatrixKey(keyEvent, pressedKeyEvent)) {
            return releaseTrackedMatrixKeyEvent(pressedKeyEvent);
        }
        return keyEvent;
    }

    releasePressedMatrixKeys(): CommodoreViceEmbedKeyEvent[] {
        const releases = Array.from(
            this.pressedMatrixKeys.values(),
            releaseTrackedMatrixKeyEvent
        );
        this.pressedMatrixKeys.clear();
        return releases;
    }

    reset(): void {
        this.pressedMatrixKeys.clear();
    }
}

export function isViceEmbedCommodoreFunctionKeyEvent(
    event: Pick<ViceEmbedKeyboardEventLike, 'code' | 'key' | 'keyCode' | 'ctrlKey' | 'altKey' | 'metaKey'>
): boolean {
    if (event.ctrlKey || event.altKey || event.metaKey) {
        return false;
    }
    return isCommodoreFunctionKeyName(event.code) ||
        isCommodoreFunctionKeyName(event.key) ||
        (event.keyCode >= 112 && event.keyCode <= 119);
}

function resolveSdlKeyMapping(event: ViceEmbedKeyboardEventLike): KeyMapping | undefined {
    const shiftedNumberRowFallback = resolveC64ShiftedNumberRowFallback(event);
    if (shiftedNumberRowFallback) {
        return shiftedNumberRowFallback;
    }

    const printableMapping = resolvePrintableSdlKeyMapping(event.key);
    if (printableMapping) {
        return printableMapping;
    }
    if (shouldSuppressLegacyFallback(event.key)) {
        return { keyCode: SDL_KEY_UNKNOWN, shift: false, ctrl: false, alt: false };
    }

    const functionKeyMapping = FUNCTION_SDL_KEYS_BY_CODE[event.code];
    if (functionKeyMapping) {
        return functionKeyMapping;
    }
    if (/^F\d{1,2}$/u.test(event.code)) {
        return { keyCode: SDL_KEY_UNKNOWN, shift: false, ctrl: false, alt: false };
    }

    return CONTROL_SDL_KEYS_BY_CODE[event.code];
}

function resolveC64ShiftedNumberRowFallback(event: ViceEmbedKeyboardEventLike): KeyMapping | undefined {
    if (!event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
        return undefined;
    }
    const digit = digitFromCode(event.code);
    if (digit === undefined || event.key !== digit) {
        return undefined;
    }
    return SHIFTED_NUMBER_ROW_FALLBACK_SDL_KEYS_BY_CODE[event.code];
}

function resolvePrintableSdlKeyMapping(key: string): KeyMapping | undefined {
    if (key.length !== 1) {
        return undefined;
    }
    if (/^[A-Z]$/u.test(key)) {
        return { keyCode: charCode(key.toLowerCase()), shift: false, ctrl: false, alt: false };
    }
    if (/^[a-z]$/u.test(key)) {
        return { keyCode: charCode(key), shift: false, ctrl: false, alt: false };
    }
    const mapping = PRINTABLE_SDL_KEYS[key];
    return mapping ? { shift: false, ctrl: false, alt: false, ...mapping } : undefined;
}

function shouldSuppressLegacyFallback(key: string): boolean {
    return key.length === 1 || key === 'Dead';
}

function digitFromCode(code: string): string | undefined {
    const match = /^Digit(\d)$/u.exec(code);
    return match?.[1];
}

function isCommodoreFunctionKeyName(value: string): boolean {
    return /^[Ff][1-8]$/u.test(value);
}

function viceEmbedKeyboardEventIdentity(
    event: Pick<ViceEmbedKeyboardEventLike, 'code' | 'key' | 'keyCode'>
): string {
    return event.code || `${event.keyCode}:${event.key}`;
}

function isMatrixKeyEvent(event: CommodoreViceEmbedKeyEvent): boolean {
    return event.matrixRow !== undefined && event.matrixCol !== undefined;
}

function isSameMatrixKey(
    event: CommodoreViceEmbedKeyEvent,
    other: CommodoreViceEmbedKeyEvent
): boolean {
    return event.matrixRow === other.matrixRow &&
        event.matrixCol === other.matrixCol &&
        Boolean(event.matrixShift) === Boolean(other.matrixShift);
}

function releaseTrackedMatrixKeyEvent(
    event: CommodoreViceEmbedKeyEvent
): CommodoreViceEmbedKeyEvent {
    return {
        ...event,
        pressed: false,
        repeat: false
    };
}

function charCode(value: string): number {
    return value.charCodeAt(0);
}

function c64MatrixKey(row: number, col: number, shift = false): C64MatrixKeyMapping {
    return { row, col, shift };
}
