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

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import jakarta.xml.bind.annotation.XmlAccessType;
import jakarta.xml.bind.annotation.XmlAccessorType;
import jakarta.xml.bind.annotation.XmlValue;

@XmlAccessorType(XmlAccessType.FIELD)
public class Breakpoints {

    @XmlValue
    private String breakpointsData;

    public List<Breakpoint> getBreakpoints() {
        List<Breakpoint> mappings = new CopyOnWriteArrayList<>();
        if (breakpointsData == null || breakpointsData.isBlank()) {
            return mappings;
        }
        String[] split = breakpointsData.split("\\r?\\n");
        for (String string : split) {
            if (!string.isBlank()) {
                mappings.add(new Breakpoint(string.strip()));
            }
        }
        return mappings;
    }
}
