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
import jakarta.xml.bind.annotation.XmlTransient;
import jakarta.xml.bind.annotation.XmlValue;

@XmlAccessorType(XmlAccessType.FIELD)
public class Labels {

    @XmlAttribute(name = "values")
    private String values;

    @XmlValue
    private String labelData;

    @XmlTransient
    private List<Label> labels;

    public String getValues() {
        return values;
    }

    public String getLabelData() {
        return labelData;
    }

    public List<Label> getLineMappings() {
        List<Label> lineMappings = new CopyOnWriteArrayList<>();
        if (labelData == null || labelData.isBlank()) {
            return lineMappings;
        }
        String[] split = labelData.split("\\r?\\n");
        for (String string : split) {
            if (!string.isBlank()) {
                lineMappings.add(new Label(string.strip()));
            }
        }
        return lineMappings;
    }

    public List<Label> getLabels() {
        if (labels == null) {
            labels = getLineMappings();
        }
        return labels;
    }
}
