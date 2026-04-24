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

import java.nio.ByteBuffer;
import java.nio.ByteOrder;

public class ViceMonitorCommand {

    private final int requestId;
    private final ViceMonitorCommandId commandType;
    private final byte[] commandBody;

    public ViceMonitorCommand(int requestId, ViceMonitorCommandId commandType, byte[] commandBody) {
        this.requestId = requestId;
        this.commandType = commandType;
        this.commandBody = commandBody;
    }

    public byte[] build() {
        int commandLength = commandBody.length;
        ByteBuffer buffer = ByteBuffer.allocate(6 + 4 + 1 + commandLength);
        buffer.order(ByteOrder.LITTLE_ENDIAN);
        buffer.put(ViceBinaryMonitorProtocol.STX);
        buffer.put(ViceBinaryMonitorProtocol.API_VERSION);
        buffer.putInt(commandLength);
        buffer.putInt(requestId);
        buffer.put(commandType.getCode());
        buffer.put(commandBody);
        return buffer.array();
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        sb.append("Request : ID ").append(String.format("$%08X", requestId));
        sb.append(", type ").append(String.format("$%02X", commandType.getCode()));
        sb.append(" (").append(commandType.name()).append(")");
        sb.append(", length ").append(commandBody.length);
        sb.append(", body ");
        for (byte value : commandBody) {
            sb.append(byteToHex(value)).append(" ");
        }
        return sb.toString();
    }

    private static String byteToHex(byte value) {
        String hex = Integer.toHexString(value & 0xFF);
        return hex.length() == 1 ? "0" + hex : hex;
    }
}
