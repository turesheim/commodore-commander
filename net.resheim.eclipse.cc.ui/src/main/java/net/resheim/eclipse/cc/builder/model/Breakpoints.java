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
import jakarta.xml.bind.annotation.XmlValue;

@XmlAccessorType(XmlAccessType.FIELD)
public class Breakpoints {

    @XmlValue
	private String breakpointsData;

	public List<Breakpoint> getBreakpoints() {
		List<Breakpoint> mappings = new CopyOnWriteArrayList<>();
		String[] split = breakpointsData.split("\\r?\\n");
		for (String string : split) {
			if (!string.isBlank()) {
				Breakpoint lm = new Breakpoint(string.strip());
				mappings.add(lm);
			}
		}
		return mappings;
	}

}