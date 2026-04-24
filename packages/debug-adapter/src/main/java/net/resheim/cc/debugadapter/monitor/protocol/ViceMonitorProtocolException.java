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

import java.io.IOException;

public class ViceMonitorProtocolException extends IOException {

    private static final long serialVersionUID = 1L;

    public ViceMonitorProtocolException(String message) {
        super(message);
    }
}
