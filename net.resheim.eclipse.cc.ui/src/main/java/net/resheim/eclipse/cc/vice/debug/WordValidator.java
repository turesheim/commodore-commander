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

public class WordValidator {

    public static short parseInput(String input) throws NumberFormatException {
        if (isHexadecimal(input)) {
            return parseHexadecimal(input);
        } else if (isBinary(input)) {
            return parseBinary(input);
        } else if (isDecimal(input)) {
            return parseDecimal(input);
        } else {
            throw new NumberFormatException("Invalid word format: " + input);
        }
    }

    private static boolean isHexadecimal(String input) {
        // Match patterns like $FFFF
        String hexPattern = "^\\$[0-9A-Fa-f]{1,4}$"; // 1-4 hex digits with $ prefix
        return input.matches(hexPattern);
    }

    private static short parseHexadecimal(String input) {
        int value = Integer.parseInt(input.substring(1), 16); // Remove '$' and parse as hex
        if (value >= 0 && value <= 65535) { // Unsigned 16-bit range
            return (short) value;
        } else {
            throw new NumberFormatException("Hexadecimal value out of range: " + input);
        }
    }

    private static boolean isBinary(String input) {
        // Match patterns like %1111111111111111
        String binaryPattern = "^%[01]{1,16}$"; // 1-16 binary digits with % prefix
        return input.matches(binaryPattern);
    }

    private static short parseBinary(String input) {
        int value = Integer.parseInt(input.substring(1), 2); // Remove '%' and parse as binary
        if (value >= 0 && value <= 65535) { // Unsigned 16-bit range
            return (short) value;
        } else {
            throw new NumberFormatException("Binary value out of range: " + input);
        }
    }

    private static boolean isDecimal(String input) {
        try {
            int value = Integer.parseInt(input); // Parse as decimal
            return value >= -32768 && value <= 32767; // Signed 16-bit range
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private static short parseDecimal(String input) {
        int value = Integer.parseInt(input); // Parse as decimal
        if (value >= -32768 && value <= 32767) { // Signed 16-bit range
            return (short) value;
        } else {
            throw new NumberFormatException("Decimal value out of range: " + input);
        }
    }

}