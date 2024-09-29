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

public class Watchpoint extends Breakpoint {

	private int endAddress;

	public Watchpoint(String inputString) {
		String[] split = inputString.split(",");
		segment = split[0];
		startAddress = Integer.parseInt(split[1].substring(1), 16);
		endAddress = Integer.parseInt(split[2].substring(1), 16);
		if (split.length > 3)
			argument = split[3];
	}

	public int getEndAddress() {
		return endAddress;
	}
}
