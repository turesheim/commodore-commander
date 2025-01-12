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

public class Label {

	private String segment;
	private String name;

	int startAddress;
	int fileIndex;
	int startLine;
	int startColumn;
	int endLine;
	int endColumn;

	/** Used if the label is used to name a piece of data */
	private DataLabel data;

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

	public int getStartAddress() {
		return startAddress;
	}

	public String getSegment() {
		return segment;
	}

	public String getName() {
		return name;
	}

	public DataLabel getData() {
		return data;
	}

	public void setData(DataLabel data) {
		this.data = data;
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
