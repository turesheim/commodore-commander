/**
 * Copyright (c) 2026 Torkild Ulvøy Resheim.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 */
package net.resheim.cc.core.debuginfo;

public class Watchpoint extends Breakpoint {

    private int endAddress;

    public Watchpoint(String inputString) {
        String[] split = inputString.split(",");
        segment = split[0];
        startAddress = Integer.parseInt(split[1].substring(1), 16);
        if (split.length > 2 && !split[2].isEmpty()) {
            endAddress = Integer.parseInt(split[2].substring(1), 16);
        }
        if (split.length > 3) {
            argument = split[3];
        }
        if (split.length > 4) {
            argument += "," + split[4];
        }
    }

    public int getEndAddress() {
        return endAddress;
    }
}
