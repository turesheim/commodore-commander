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

public class Label extends LineMapping {

	private String segment;
	private String name;

	public Label(String inputString) {
		String[] split = inputString.split(",");
		segment = split[0];
		startAddress = Integer.parseInt(split[1].substring(1), 16);
		name = split[2];
		fileIndex = Integer.parseInt(split[3]);
		startLine = Integer.parseInt(split[4]);
		startColumn = Integer.parseInt(split[5]);
		endLine = Integer.parseInt(split[6]);
		endColumn = Integer.parseInt(split[7]);
	}

	public String getSegment() {
		return segment;
	}

	public String getName() {
		return name;
	}

}
