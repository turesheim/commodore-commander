/**
 * Copyright (c) 2026 Torkild U. Resheim.
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

public final class ViceMonitorRequests {

    private ViceMonitorRequests() {
    }

    public static ViceMonitorRequest resume() {
        return empty(ViceMonitorCommandId.EXIT);
    }

    public static ViceMonitorRequest suspend() {
        return new ViceMonitorRequest(ViceMonitorCommandId.PING, new byte[] { 0x00 });
    }

    public static ViceMonitorRequest quit() {
        return empty(ViceMonitorCommandId.QUIT);
    }

    public static ViceMonitorRequest listCheckpoints() {
        return empty(ViceMonitorCommandId.CHECKPOINT_LIST);
    }

    public static ViceMonitorRequest requestRegistersAvailable() {
        return new ViceMonitorRequest(ViceMonitorCommandId.REGISTERS_AVAILABLE, new byte[] { 0x00 });
    }

    public static ViceMonitorRequest advanceInstructions(int instructionCount, boolean stepOverSubroutines) {
        ByteBuffer buffer = ByteBuffer.allocate(3);
        buffer.order(ByteOrder.LITTLE_ENDIAN);
        buffer.put(stepOverSubroutines ? (byte) 0x01 : (byte) 0x00);
        buffer.putShort((short) instructionCount);
        return new ViceMonitorRequest(ViceMonitorCommandId.ADVANCE_INSTRUCTIONS, buffer.array());
    }

    public static ViceMonitorRequest executeUntilReturn() {
        return empty(ViceMonitorCommandId.EXECUTE_UNTIL_RETURN);
    }

    public static ViceMonitorRequest requestMemory(int startAddress, int endAddress) {
        return requestMemory(startAddress, endAddress, false, 0, 0);
    }

    public static ViceMonitorRequest requestMemory(int startAddress, int endAddress, boolean sideEffects,
            int memspace, int bankId) {
        validateAddress(startAddress, "startAddress");
        validateAddress(endAddress, "endAddress");
        ByteBuffer buffer = ByteBuffer.allocate(8);
        buffer.order(ByteOrder.LITTLE_ENDIAN);
        buffer.put(sideEffects ? (byte) 0x01 : (byte) 0x00);
        buffer.putShort((short) startAddress);
        buffer.putShort((short) endAddress);
        buffer.put((byte) memspace);
        buffer.putShort((short) bankId);
        return new ViceMonitorRequest(ViceMonitorCommandId.MEMORY_GET, buffer.array());
    }

    public static ViceMonitorRequest writeMemory(int startAddress, byte[] values) {
        return writeMemory(startAddress, values, false, 0, 0);
    }

    public static ViceMonitorRequest writeMemory(int startAddress, byte[] values, boolean sideEffects, int memspace,
            int bankId) {
        validateAddress(startAddress, "startAddress");
        if (values == null || values.length == 0) {
            throw new IllegalArgumentException("values must not be empty");
        }
        int endAddress = startAddress + values.length - 1;
        validateAddress(endAddress, "endAddress");

        ByteBuffer buffer = ByteBuffer.allocate(values.length + 8);
        buffer.order(ByteOrder.LITTLE_ENDIAN);
        buffer.put(sideEffects ? (byte) 0x01 : (byte) 0x00);
        buffer.putShort((short) startAddress);
        buffer.putShort((short) endAddress);
        buffer.put((byte) memspace);
        buffer.putShort((short) bankId);
        buffer.put(values);
        return new ViceMonitorRequest(ViceMonitorCommandId.MEMORY_SET, buffer.array());
    }

    public static ViceMonitorRequest setCheckpoint(ViceMonitorCheckpointSpec spec) {
        ByteBuffer buffer = ByteBuffer.allocate(8);
        buffer.order(ByteOrder.LITTLE_ENDIAN);
        buffer.putShort((short) spec.startAddress());
        buffer.putShort((short) spec.endAddress());
        buffer.put(spec.stopWhenHit() ? (byte) 0x01 : (byte) 0x00);
        buffer.put(spec.enabled() ? (byte) 0x01 : (byte) 0x00);
        int bitmask = 0;
        if (spec.load()) {
            bitmask |= 1 << 0;
        }
        if (spec.store()) {
            bitmask |= 1 << 1;
        }
        if (spec.exec()) {
            bitmask |= 1 << 2;
        }
        buffer.put((byte) bitmask);
        buffer.put(spec.temporary() ? (byte) 0x01 : (byte) 0x00);
        return new ViceMonitorRequest(ViceMonitorCommandId.CHECKPOINT_SET, buffer.array());
    }

    public static ViceMonitorRequest toggleCheckpoint(int checkpointNumber, boolean enabled) {
        ByteBuffer buffer = ByteBuffer.allocate(5);
        buffer.order(ByteOrder.LITTLE_ENDIAN);
        buffer.putInt(checkpointNumber);
        buffer.put(enabled ? (byte) 0x01 : (byte) 0x00);
        return new ViceMonitorRequest(ViceMonitorCommandId.CHECKPOINT_TOGGLE, buffer.array());
    }

    public static ViceMonitorRequest deleteCheckpoint(int checkpointNumber) {
        ByteBuffer buffer = ByteBuffer.allocate(4);
        buffer.order(ByteOrder.LITTLE_ENDIAN);
        buffer.putInt(checkpointNumber);
        return new ViceMonitorRequest(ViceMonitorCommandId.CHECKPOINT_DELETE, buffer.array());
    }

    public static ViceMonitorRequest empty(ViceMonitorCommandId commandId) {
        return new ViceMonitorRequest(commandId, ViceBinaryMonitorProtocol.EMPTY_COMMAND_BODY);
    }

    private static void validateAddress(int address, String label) {
        if (address < 0 || address > 0xFFFF) {
            throw new IllegalArgumentException(label + " must be between 0x0000 and 0xFFFF");
        }
    }
}
