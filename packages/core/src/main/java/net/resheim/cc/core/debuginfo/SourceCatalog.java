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
import jakarta.xml.bind.annotation.XmlTransient;
import jakarta.xml.bind.annotation.XmlValue;

@XmlAccessorType(XmlAccessType.FIELD)
public class SourceCatalog {

    @XmlValue
    private String sourcesData;

    @XmlTransient
    private List<SourceEntry> sourceFiles;

    public List<SourceEntry> getSourceFiles() {
        if (sourceFiles == null) {
            sourceFiles = new CopyOnWriteArrayList<>();
            if (sourcesData == null || sourcesData.isBlank()) {
                return sourceFiles;
            }
            String[] split = sourcesData.split("\\r?\\n");
            for (String string : split) {
                if (!string.isBlank()) {
                    sourceFiles.add(new SourceEntry(string.strip()));
                }
            }
        }
        return sourceFiles;
    }
}
