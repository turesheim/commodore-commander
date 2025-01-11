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

public class DWordValidator {

    public static int parseInput(String input) throws NumberFormatException {
        if (isHexadecimal(input)) {
            return parseHexadecimal(input);
        } else if (isBinary(input)) {
            return parseBinary(input);
        } else if (isDecimal(input)) {
            return parseDecimal(input);
        } else {
            throw new NumberFormatException("Invalid DWORD format: " + input);
        }
    }

    private static boolean isHexadecimal(String input) {
        // Match patterns like $FFFFFFFF
        String hexPattern = "^\\$[0-9A-Fa-f]{1,8}$"; // 1-8 hex digits with $ prefix
        return input.matches(hexPattern);
    }

    private static int parseHexadecimal(String input) {
        long value = Long.parseLong(input.substring(1), 16); // Remove '$' and parse as hex
        if (value >= 0 && value <= 0xFFFFFFFFL) { // Unsigned 32-bit range
            return (int) value;
        } else {
            throw new NumberFormatException("Hexadecimal value out of range: " + input);
        }
    }

    private static boolean isBinary(String input) {
        // Match patterns like %11111111111111111111111111111111
        String binaryPattern = "^%[01]{1,32}$"; // 1-32 binary digits with % prefix
        return input.matches(binaryPattern);
    }

    private static int parseBinary(String input) {
        long value = Long.parseLong(input.substring(1), 2); // Remove '%' and parse as binary
        if (value >= 0 && value <= 0xFFFFFFFFL) { // Unsigned 32-bit range
            return (int) value;
        } else {
            throw new NumberFormatException("Binary value out of range: " + input);
        }
    }

    private static boolean isDecimal(String input) {
        try {
            long value = Long.parseLong(input); // Parse as decimal
            return value >= Integer.MIN_VALUE && value <= Integer.MAX_VALUE; // Signed 32-bit range
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private static int parseDecimal(String input) {
        long value = Long.parseLong(input); // Parse as decimal
        if (value >= Integer.MIN_VALUE && value <= Integer.MAX_VALUE) { // Signed 32-bit range
            return (int) value;
        } else {
            throw new NumberFormatException("Decimal value out of range: " + input);
        }
    }

}