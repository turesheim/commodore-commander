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

/**
 * A {@link LineMapping} represents a mapping between line numbers, columns,
 * start address, end address and file index.
 */
public class LineMapping {

	int startAddress;
	int endAddress;
	int fileIndex;
	int startLine;
	int startColumn;
	int endLine;
	int endColumn;

	public LineMapping() {

	}

	public LineMapping(String inputString) {
		String[] split = inputString.split(",");
		startAddress = Integer.parseInt(split[0].substring(1), 16);
		endAddress = Integer.parseInt(split[1].substring(1), 16);
		fileIndex = Integer.parseInt(split[2]);
		startLine = Integer.parseInt(split[3]);
		startColumn = Integer.parseInt(split[4]);
		endLine = Integer.parseInt(split[5]);
		endColumn = Integer.parseInt(split[6]);
	}

	public int getStartAddress() {
		return startAddress;
	}

	public int getEndAddress() {
		return endAddress;
	}

	public int getFileIndex() {
		return fileIndex;
	}

	public int getStartLine() {
		return startLine;
	}

	public int getStartColumn() {
		return startColumn;
	}

	public int getEndLine() {
		return endLine;
	}

	public int getEndColumn() {
		return endColumn;
	}

}
