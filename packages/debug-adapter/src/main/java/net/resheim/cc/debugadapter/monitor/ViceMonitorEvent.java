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

import java.util.Arrays;
import java.util.List;

import net.resheim.cc.debugadapter.monitor.protocol.ViceMonitorCommandId;

public sealed interface ViceMonitorEvent permits ViceMonitorEvent.ExecutionStateChanged,
        ViceMonitorEvent.CheckpointUpdated, ViceMonitorEvent.RegistersAvailable,
        ViceMonitorEvent.RegistersUpdated, ViceMonitorEvent.MemoryBytesReceived,
        ViceMonitorEvent.CommandAcknowledged, ViceMonitorEvent.ProtocolError,
        ViceMonitorEvent.UnhandledResponse {

    int requestId();

    enum ExecutionState {
        STOPPED,
        RESUMED,
        TERMINATED
    }

    record CheckpointInfo(
            int number,
            boolean hit,
            int startAddress,
            int endAddress,
            boolean stop,
            boolean enabled,
            boolean load,
            boolean store,
            boolean exec,
            boolean temporary) {
    }

    record RegisterDescriptor(int id, String name, int bitSize) {
    }

    record RegisterValue(int id, byte[] littleEndianValue) {
        public RegisterValue {
            littleEndianValue = littleEndianValue == null ? new byte[0]
                    : Arrays.copyOf(littleEndianValue, littleEndianValue.length);
        }

        @Override
        public byte[] littleEndianValue() {
            return Arrays.copyOf(littleEndianValue, littleEndianValue.length);
        }
    }

    record ExecutionStateChanged(int requestId, ExecutionState state) implements ViceMonitorEvent {
    }

    record CheckpointUpdated(int requestId, CheckpointInfo checkpoint) implements ViceMonitorEvent {
    }

    record RegistersAvailable(int requestId, List<RegisterDescriptor> registers) implements ViceMonitorEvent {
        public RegistersAvailable {
            registers = List.copyOf(registers);
        }
    }

    record RegistersUpdated(int requestId, List<RegisterValue> registers) implements ViceMonitorEvent {
        public RegistersUpdated {
            registers = List.copyOf(registers);
        }
    }

    record MemoryBytesReceived(int requestId, int declaredByteCount, byte[] bytes) implements ViceMonitorEvent {
        public MemoryBytesReceived {
            bytes = bytes == null ? new byte[0] : Arrays.copyOf(bytes, bytes.length);
        }

        @Override
        public byte[] bytes() {
            return Arrays.copyOf(bytes, bytes.length);
        }
    }

    record CommandAcknowledged(int requestId, ViceMonitorCommandId commandId, byte[] body) implements ViceMonitorEvent {
        public CommandAcknowledged {
            body = body == null ? new byte[0] : Arrays.copyOf(body, body.length);
        }

        @Override
        public byte[] body() {
            return Arrays.copyOf(body, body.length);
        }
    }

    record ProtocolError(int requestId, byte responseType, byte errorCode, byte[] body) implements ViceMonitorEvent {
        public ProtocolError {
            body = body == null ? new byte[0] : Arrays.copyOf(body, body.length);
        }

        @Override
        public byte[] body() {
            return Arrays.copyOf(body, body.length);
        }
    }

    record UnhandledResponse(int requestId, byte responseType, byte[] body) implements ViceMonitorEvent {
        public UnhandledResponse {
            body = body == null ? new byte[0] : Arrays.copyOf(body, body.length);
        }

        @Override
        public byte[] body() {
            return Arrays.copyOf(body, body.length);
        }
    }
}
