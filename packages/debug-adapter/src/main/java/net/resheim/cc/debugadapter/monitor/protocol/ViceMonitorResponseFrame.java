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

import java.util.Arrays;

public record ViceMonitorResponseFrame(ViceMonitorResponseHeader header, byte[] body) {

    public ViceMonitorResponseFrame {
        body = body == null ? new byte[0] : Arrays.copyOf(body, body.length);
    }

    @Override
    public byte[] body() {
        return Arrays.copyOf(body, body.length);
    }
}
