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

import jakarta.xml.bind.annotation.XmlAccessType;
import jakarta.xml.bind.annotation.XmlAccessorType;
import jakarta.xml.bind.annotation.XmlAttribute;
import jakarta.xml.bind.annotation.XmlElement;

/**
 * Represents a program <i>segment</i> which is composed of a set of
 * {@link Block} objects.
 *
 * @since 1.0
 */
@XmlAccessorType(XmlAccessType.FIELD)
public class Segment {

    @XmlAttribute(name = "name")
    private String name;

    @XmlAttribute(name = "dest")
    private String dest;

    @XmlAttribute(name = "values")
    private String values;

    @XmlElement(name = "Block")
    private List<Block> blocks;

	public String getName() {
		return name;
	}

	public String getDest() {
		return dest;
	}

	public String getValues() {
		return values;
	}

	public List<Block> getBlocks() {
		return blocks;
	}

	@Override
	public String toString() {
		StringBuilder sb = new StringBuilder("Segment ");
		sb.append(name);
		if (dest != null && !dest.isBlank()) {
			sb.append(" at ");
			sb.append(dest);
		}
		sb.append("\n");
		for (Block block : blocks) {
			sb.append("  ");
			sb.append(block);
			sb.append("\n");
		}
		return sb.toString();
	}

}