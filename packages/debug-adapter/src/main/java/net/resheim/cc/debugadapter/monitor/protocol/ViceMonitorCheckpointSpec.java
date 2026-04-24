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

public record ViceMonitorCheckpointSpec(
        int startAddress,
        int endAddress,
        boolean stopWhenHit,
        boolean enabled,
        boolean load,
        boolean store,
        boolean exec,
        boolean temporary) {

    public ViceMonitorCheckpointSpec {
        validateAddress(startAddress, "startAddress");
        validateAddress(endAddress, "endAddress");
    }

    private static void validateAddress(int address, String label) {
        if (address < 0 || address > 0xFFFF) {
            throw new IllegalArgumentException(label + " must be between 0x0000 and 0xFFFF");
        }
    }
}
