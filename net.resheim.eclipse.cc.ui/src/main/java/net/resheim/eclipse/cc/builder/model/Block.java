/**
 * Copyright (c) 2024 Torkild Ulvøy Resheim.
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
		String[] split = blockData.split("\\r?\\n");
		for (String string : split) {
			if (!string.isBlank()) {
				LineMapping lm = new LineMapping(string.strip());
				lineMappings.add(lm);
			}
		}
		return lineMappings;
	}

	@Override
	public String toString() {
		StringBuilder sb = new StringBuilder("Block ");
		sb.append(name);
		return sb.toString();
	}

}