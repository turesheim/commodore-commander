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

import net.resheim.cc.debugadapter.monitor.protocol.ViceMonitorResponseFrame;

public interface ViceMonitorEventMapper {

    ViceMonitorEvent map(ViceMonitorResponseFrame responseFrame);
}
