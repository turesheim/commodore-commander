/**
 * Copyright (c) 2026 Torkild Ulvøy Resheim.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 */
package net.resheim.cc.core.util;

public final class NumericValueParsers {

    private NumericValueParsers() {
    }

    public static byte parseByte(String input) {
        if (isHexadecimal(input, 2)) {
            int value = Integer.parseInt(input.substring(1), 16);
            if (value >= 0 && value <= 0xFF) {
                return (byte) value;
            }
        } else if (isBinary(input, 8)) {
            int value = Integer.parseInt(input.substring(1), 2);
            if (value >= 0 && value <= 0xFF) {
                return (byte) value;
            }
        } else if (isSignedDecimal(input, Byte.MIN_VALUE, Byte.MAX_VALUE)) {
            return (byte) Integer.parseInt(input);
        }
        throw new NumberFormatException("Invalid byte format: " + input);
    }

    public static short parseWord(String input) {
        if (isHexadecimal(input, 4)) {
            int value = Integer.parseInt(input.substring(1), 16);
            if (value >= 0 && value <= 0xFFFF) {
                return (short) value;
            }
        } else if (isBinary(input, 16)) {
            int value = Integer.parseInt(input.substring(1), 2);
            if (value >= 0 && value <= 0xFFFF) {
                return (short) value;
            }
        } else if (isSignedDecimal(input, Short.MIN_VALUE, Short.MAX_VALUE)) {
            return (short) Integer.parseInt(input);
        }
        throw new NumberFormatException("Invalid word format: " + input);
    }

    public static int parseDWord(String input) {
        if (isHexadecimal(input, 8)) {
            long value = Long.parseLong(input.substring(1), 16);
            if (value >= 0 && value <= 0xFFFFFFFFL) {
                return (int) value;
            }
        } else if (isBinary(input, 32)) {
            long value = Long.parseLong(input.substring(1), 2);
            if (value >= 0 && value <= 0xFFFFFFFFL) {
                return (int) value;
            }
        } else if (isSignedDecimal(input, Integer.MIN_VALUE, Integer.MAX_VALUE)) {
            return (int) Long.parseLong(input);
        }
        throw new NumberFormatException("Invalid DWORD format: " + input);
    }

    private static boolean isHexadecimal(String input, int maxDigits) {
        return input != null && input.matches("^\\$[0-9A-Fa-f]{1," + maxDigits + "}$");
    }

    private static boolean isBinary(String input, int maxDigits) {
        return input != null && input.matches("^%[01]{1," + maxDigits + "}$");
    }

    private static boolean isSignedDecimal(String input, long min, long max) {
        try {
            long value = Long.parseLong(input);
            return value >= min && value <= max;
        } catch (NumberFormatException exception) {
            return false;
        }
    }
}
