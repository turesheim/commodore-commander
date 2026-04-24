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
import jakarta.xml.bind.annotation.XmlAttribute;
import jakarta.xml.bind.annotation.XmlValue;

@XmlAccessorType(XmlAccessType.FIELD)
public class Block {

    @XmlAttribute(name = "name")
    private String name;

    @XmlValue
    private String blockData;

    public String getName() {
        return name;
    }

    public String getBlockData() {
        return blockData;
    }

    public List<LineMapping> getLineMappings() {
        List<LineMapping> lineMappings = new CopyOnWriteArrayList<>();
        if (blockData == null || blockData.isBlank()) {
            return lineMappings;
        }
        String[] split = blockData.split("\\r?\\n");
        for (String string : split) {
            if (!string.isBlank()) {
                lineMappings.add(new LineMapping(string.strip()));
            }
        }
        return lineMappings;
    }

    @Override
    public String toString() {
        return "Block " + name;
    }
}
