/**
 * Copyright (c) 2025 Torkild Ulvøy Resheim
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

public class DataLabel {

	private String label;
	private int length;
	private Type type;
	private Presentation presentation;

	private int[] lineLengths;

	public DataLabel(String label, int length, int[] lineLengths, Type type, Presentation presentation) {
		super();
		this.label = label;
		this.length = length;
		this.lineLengths = lineLengths;
		this.type = type;
		this.presentation = presentation;
	}

	public String getLabel() {
		return label;
	}

	public int getLength() {
		return length;
	}

	/**
	 * Returns the length of each line in the number of tokens used to declare the
	 * symbol. This would for example return <code>[0]=4, [1]=2</code>:
	 *
	 * <pre>
	 * SpriteMem:
	 * .byte $73, $00, $e0, $00
	 * .byte $30, $00
	 * </pre>
	 *
	 * @return
	 */
	public int[] getLineLengths() {
		return lineLengths;
	}

	public Type getType() {
		return type;
	}

	public void setType(Type type) {
		this.type = type;
	}

	public Presentation getPresentation() {
		return presentation;
	}

	public void setPresentation(Presentation presentation) {
		this.presentation = presentation;
	}

}
