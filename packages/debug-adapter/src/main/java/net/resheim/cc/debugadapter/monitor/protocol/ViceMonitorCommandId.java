/**
 * Copyright (c) 2026 Torkild Ulvøy Resheim.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 */
package net.resheim.cc.debugadapter.monitor.protocol;

public enum ViceMonitorCommandId {
    MEMORY_GET((byte) 0x01),
    MEMORY_SET((byte) 0x02),
    CHECKPOINT_GET((byte) 0x11),
    CHECKPOINT_SET((byte) 0x12),
    CHECKPOINT_DELETE((byte) 0x13),
    CHECKPOINT_LIST((byte) 0x14),
    CHECKPOINT_TOGGLE((byte) 0x15),
    CHECKPOINT_CONDITION_SET((byte) 0x22),
    REGISTERS_GET((byte) 0x31),
    REGISTERS_SET((byte) 0x32),
    DUMP((byte) 0x41),
    UNDUMP((byte) 0x42),
    RESOURCE_GET((byte) 0x51),
    RESOURCE_SET((byte) 0x52),
    ADVANCE_INSTRUCTIONS((byte) 0x71),
    KEYBOARD_FEED((byte) 0x72),
    EXECUTE_UNTIL_RETURN((byte) 0x73),
    PING((byte) 0x81),
    BANKS_AVAILABLE((byte) 0x82),
    REGISTERS_AVAILABLE((byte) 0x83),
    DISPLAY_GET((byte) 0x84),
    VICE_INFO((byte) 0x85),
    PALETTE_GET((byte) 0x91),
    JOYPORT_SET((byte) 0xA2),
    USERPORT_SET((byte) 0xB2),
    EXIT((byte) 0xAA),
    QUIT((byte) 0xBB),
    RESET((byte) 0xCC),
    AUTOSTART((byte) 0xDD);

    private final byte code;

    ViceMonitorCommandId(byte code) {
        this.code = code;
    }

    public byte getCode() {
        return code;
    }

    public static boolean hasCode(byte code) {
        for (ViceMonitorCommandId value : values()) {
            if (value.code == code) {
                return true;
            }
        }
        return false;
    }

    public static String getNameFromCode(byte code) {
        for (ViceMonitorCommandId value : values()) {
            if (value.code == code) {
                return value.name();
            }
        }
        return "Unknown command " + code;
    }
}
