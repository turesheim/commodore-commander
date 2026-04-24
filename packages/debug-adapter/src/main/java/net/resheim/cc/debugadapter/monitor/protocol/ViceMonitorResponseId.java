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

public enum ViceMonitorResponseId {
    INVALID((byte) 0x00),
    CHECKPOINT_INFO((byte) 0x11),
    REGISTER_INFO((byte) 0x31),
    RESPONSE_JAM((byte) 0x61),
    STOPPED((byte) 0x62),
    RESUMED((byte) 0x63);

    private final byte code;

    ViceMonitorResponseId(byte code) {
        this.code = code;
    }

    public byte getCode() {
        return code;
    }

    public static boolean hasCode(byte code) {
        for (ViceMonitorResponseId value : values()) {
            if (value.code == code) {
                return true;
            }
        }
        return false;
    }

    public static String getNameFromCode(byte code) {
        for (ViceMonitorResponseId value : values()) {
            if (value.code == code) {
                return value.name();
            }
        }
        return "Unknown response";
    }
}
