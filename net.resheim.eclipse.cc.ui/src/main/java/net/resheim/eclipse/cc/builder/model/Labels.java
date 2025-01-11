/**
 * Copyright (c) 2024 Torkild Ulvøy Resheim
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *
 *   Torkild Ulvøy Resheim <torkildr@gmail.com> - initial API and implementation
 */
package net.resheim.eclipse.cc.builder.model;

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

	// Create a list of labels by parsing the labelData field
	public List<Label> getLineMappings() {
		List<Label> lineMappings = new CopyOnWriteArrayList<>();
		String[] split = labelData.split("\\r?\\n");
		for (String string : split) {
			if (!string.isBlank()) {
				Label lm = new Label(string.strip());
				lineMappings.add(lm);
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