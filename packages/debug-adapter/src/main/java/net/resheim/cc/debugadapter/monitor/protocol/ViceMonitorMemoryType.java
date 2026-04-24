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

public enum ViceMonitorMemoryType {
    DEFAULT((byte) 0),
    CPU((byte) 1),
    RAM((byte) 2),
    ROM((byte) 3),
    IO((byte) 4),
    CARTRIDGE((byte) 5);

    private final byte type;

    ViceMonitorMemoryType(byte type) {
        this.type = type;
    }

    public byte getType() {
        return type;
    }
}
