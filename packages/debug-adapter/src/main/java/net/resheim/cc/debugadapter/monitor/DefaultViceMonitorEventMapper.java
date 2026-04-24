/**
 * Copyright (c) 2026 Torkild U. Resheim.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 */
package net.resheim.cc.debugadapter.monitor;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import net.resheim.cc.debugadapter.monitor.protocol.ViceMonitorCommandId;
import net.resheim.cc.debugadapter.monitor.protocol.ViceMonitorResponseFrame;
import net.resheim.cc.debugadapter.monitor.protocol.ViceMonitorResponseHeader;
import net.resheim.cc.debugadapter.monitor.protocol.ViceMonitorResponseId;

public class DefaultViceMonitorEventMapper implements ViceMonitorEventMapper {

    @Override
    public ViceMonitorEvent map(ViceMonitorResponseFrame responseFrame) {
        ViceMonitorResponseHeader header = responseFrame.header();
        byte[] body = responseFrame.body();
        if (header.getErrorCode() != 0) {
            return new ViceMonitorEvent.ProtocolError(header.getRequestId(), header.getResponseType(),
                    header.getErrorCode(), body);
        }

        byte responseType = header.getResponseType();
        if (responseType == ViceMonitorResponseId.STOPPED.getCode()) {
            return new ViceMonitorEvent.ExecutionStateChanged(header.getRequestId(),
                    ViceMonitorEvent.ExecutionState.STOPPED);
        }
        if (responseType == ViceMonitorResponseId.RESUMED.getCode()) {
            return new ViceMonitorEvent.ExecutionStateChanged(header.getRequestId(),
                    ViceMonitorEvent.ExecutionState.RESUMED);
        }
        if (responseType == ViceMonitorResponseId.CHECKPOINT_INFO.getCode()) {
            return new ViceMonitorEvent.CheckpointUpdated(header.getRequestId(), parseCheckpointInfo(body));
        }
        if (responseType == ViceMonitorResponseId.REGISTER_INFO.getCode()) {
            return new ViceMonitorEvent.RegistersUpdated(header.getRequestId(), parseRegisterValues(body));
        }
        if (responseType == ViceMonitorCommandId.REGISTERS_AVAILABLE.getCode()) {
            return new ViceMonitorEvent.RegistersAvailable(header.getRequestId(), parseRegisterDescriptors(body));
        }
        if (responseType == ViceMonitorCommandId.MEMORY_GET.getCode()) {
            return parseMemory(header.getRequestId(), body);
        }
        if (responseType == ViceMonitorCommandId.QUIT.getCode()) {
            return new ViceMonitorEvent.ExecutionStateChanged(header.getRequestId(),
                    ViceMonitorEvent.ExecutionState.TERMINATED);
        }
        if (ViceMonitorCommandId.hasCode(responseType)) {
            return new ViceMonitorEvent.CommandAcknowledged(header.getRequestId(),
                    commandFromResponseType(responseType), body);
        }
        return new ViceMonitorEvent.UnhandledResponse(header.getRequestId(), responseType, body);
    }

    private static ViceMonitorEvent.MemoryBytesReceived parseMemory(int requestId, byte[] body) {
        ByteBuffer buffer = littleEndian(body);
        int declaredByteCount = Short.toUnsignedInt(buffer.getShort());
        byte[] bytes = new byte[buffer.remaining()];
        buffer.get(bytes);
        return new ViceMonitorEvent.MemoryBytesReceived(requestId, declaredByteCount, bytes);
    }

    private static ViceMonitorEvent.CheckpointInfo parseCheckpointInfo(byte[] body) {
        ByteBuffer buffer = littleEndian(body);
        int number = buffer.getInt();
        boolean hit = buffer.get() == 0x01;
        int startAddress = Short.toUnsignedInt(buffer.getShort());
        int endAddress = Short.toUnsignedInt(buffer.getShort());
        boolean stop = buffer.get() == 0x01;
        boolean enabled = buffer.get() == 0x01;
        byte bitmask = buffer.get();
        boolean load = (bitmask & (1 << 0)) != 0;
        boolean store = (bitmask & (1 << 1)) != 0;
        boolean exec = (bitmask & (1 << 2)) != 0;
        boolean temporary = buffer.get() == 0x01;
        return new ViceMonitorEvent.CheckpointInfo(number, hit, startAddress, endAddress, stop, enabled, load,
                store, exec, temporary);
    }

    private static List<ViceMonitorEvent.RegisterDescriptor> parseRegisterDescriptors(byte[] body) {
        ByteBuffer buffer = littleEndian(body);
        int items = Short.toUnsignedInt(buffer.getShort());
        List<ViceMonitorEvent.RegisterDescriptor> registers = new ArrayList<>(items);
        for (int index = 0; index < items && buffer.hasRemaining(); index++) {
            int size = Byte.toUnsignedInt(buffer.get());
            int id = Byte.toUnsignedInt(buffer.get());
            int bitSize = Byte.toUnsignedInt(buffer.get());
            int nameLength = Byte.toUnsignedInt(buffer.get());
            byte[] nameBytes = new byte[nameLength];
            buffer.get(nameBytes);
            int extraBytes = size - (3 + nameLength);
            if (extraBytes > 0 && buffer.remaining() >= extraBytes) {
                buffer.position(buffer.position() + extraBytes);
            }
            String name = new String(nameBytes, StandardCharsets.US_ASCII);
            registers.add(new ViceMonitorEvent.RegisterDescriptor(id, name, bitSize));
        }
        return registers;
    }

    private static List<ViceMonitorEvent.RegisterValue> parseRegisterValues(byte[] body) {
        ByteBuffer buffer = littleEndian(body);
        int items = Short.toUnsignedInt(buffer.getShort());
        List<ViceMonitorEvent.RegisterValue> registers = new ArrayList<>(items);
        for (int index = 0; index < items && buffer.hasRemaining(); index++) {
            int size = Byte.toUnsignedInt(buffer.get());
            int id = Byte.toUnsignedInt(buffer.get());
            int valueLength = Math.max(0, size - 1);
            byte[] rawValue = new byte[Math.min(valueLength, buffer.remaining())];
            buffer.get(rawValue);
            if (valueLength > rawValue.length) {
                rawValue = Arrays.copyOf(rawValue, valueLength);
            }
            registers.add(new ViceMonitorEvent.RegisterValue(id, rawValue));
        }
        return registers;
    }

    private static ViceMonitorCommandId commandFromResponseType(byte responseType) {
        for (ViceMonitorCommandId value : ViceMonitorCommandId.values()) {
            if (value.getCode() == responseType) {
                return value;
            }
        }
        throw new IllegalArgumentException("Unknown command response type: " + responseType);
    }

    private static ByteBuffer littleEndian(byte[] body) {
        ByteBuffer buffer = ByteBuffer.wrap(body);
        buffer.order(ByteOrder.LITTLE_ENDIAN);
        return buffer;
    }
}
