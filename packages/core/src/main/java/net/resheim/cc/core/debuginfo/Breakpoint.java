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

public class Breakpoint {

    protected String segment;
    protected int startAddress;
    protected String argument;

    protected Breakpoint() {
    }

    public Breakpoint(String inputString) {
        String[] split = inputString.split(",");
        segment = split[0];
        startAddress = Integer.parseInt(split[1].substring(1), 16);
        if (split.length > 2) {
            argument = split[2];
        }
    }

    public String getSegment() {
        return segment;
    }

    public int getStartAddress() {
        return startAddress;
    }

    public String getArgument() {
        return argument;
    }
}
