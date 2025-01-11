/**
 * Copyright (c) 2025 Torkild Ulvøy Resheim.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *
 *   Torkild Ulvøy Resheim <torkildr@gmail.com> - initial API and implementation
 */
package net.resheim.eclipse.cc.vice.debug;

public class ByteValidator {

    public static byte parseInput(String input) throws NumberFormatException {
        if (isHexadecimal(input)) {
            return parseHexadecimal(input);
        } else if (isBinary(input)) {
            return parseBinary(input);
        } else if (isDecimal(input)) {
            return parseDecimal(input);
        } else {
            throw new NumberFormatException("Invalid byte format: " + input);
        }
    }

    private static boolean isHexadecimal(String input) {
        // Match patterns like $FF
        String hexPattern = "^\\$[0-9A-Fa-f]{1,2}$"; // 1-2 hex digits with $ prefix
        return input.matches(hexPattern);
    }

    private static byte parseHexadecimal(String input) {
        int value = Integer.parseInt(input.substring(1), 16); // Remove '$' and parse as hex
        if (value >= 0 && value <= 255) {
            return (byte) value;
        } else {
            throw new NumberFormatException("Hexadecimal value out of range: " + input);
        }
    }

    private static boolean isBinary(String input) {
        // Match patterns like %10101010
        String binaryPattern = "^%[01]{1,8}$"; // 1-8 binary digits with % prefix
        return input.matches(binaryPattern);
    }

    private static byte parseBinary(String input) {
        int value = Integer.parseInt(input.substring(1), 2); // Remove '%' and parse as binary
        if (value >= 0 && value <= 255) {
            return (byte) value;
        } else {
            throw new NumberFormatException("Binary value out of range: " + input);
        }
    }

    private static boolean isDecimal(String input) {
        try {
            int value = Integer.parseInt(input); // Parse as decimal
            return value >= -128 && value <= 127; // Signed byte range
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private static byte parseDecimal(String input) {
        int value = Integer.parseInt(input); // Parse as decimal
        if (value >= -128 && value <= 127) {
            return (byte) value;
        } else {
            throw new NumberFormatException("Decimal value out of range: " + input);
        }
    }
}