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
package net.resheim.eclipse.cc.vice.debug.model;

import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.model.IDebugTarget;
import org.eclipse.debug.core.model.IValue;
import org.eclipse.debug.core.model.IVariable;

import net.resheim.eclipse.cc.builder.model.Presentation;
import net.resheim.eclipse.cc.builder.model.Type;

/**
 * A simple {@link IValue} representing a scalar. It has a value and a size in
 * in the number of bits required to represent the value.
 *
 * @since 1.0
 * @author Torkild Ulvøy Resheim
 */
public class Scalar extends VICEDebugElement implements IValue {

	private int value;
	private Type type;
	private Presentation presentation;

	public Scalar(IDebugTarget target, int value, Type type, Presentation presentation) {
		super(target);
		this.setValue(value);
		this.type = type;
		this.presentation = presentation;
	}

	public Scalar(IDebugTarget target, int value, byte size) {
		super(target);
		this.setValue(value);
		if (size <= 8)
			type = Type.BYTE;
		if (size == 16)
			type = Type.WORD;
		presentation = Presentation.HEXADECIMAL;
	}

	@Override
	public String getReferenceTypeName() throws DebugException {
		switch (type) {
		case BYTE: {
			return "byte";
		}
		case WORD: {
			return "word";
		}
		case DWORD: {
			return "dword";
		}
		default:
			throw new IllegalArgumentException("Unexpected value: " + type);
		}
	}

	@Override
	public String getValueString() throws DebugException {
		switch (type) {
		case BYTE: {
			if (presentation.equals(Presentation.BINARY)) {
				return String.format("%8s", Integer.toBinaryString(value)).replace(' ', '0');
			} else if (presentation.equals(Presentation.HEXADECIMAL)) {
				return String.format("$%02X", value);
			} else
				return Integer.toUnsignedString(value);
		}
		case WORD: {
			return String.format("$%04X", value);
		}
		case DWORD: {
			return String.format("$%08X", value);
		}
		default:
			throw new IllegalArgumentException("Unexpected value: " + type);
		}
	}

	@Override
	public boolean isAllocated() throws DebugException {
		return true;
	}

	@Override
	public IVariable[] getVariables() throws DebugException {
		return new IVariable[0];
	}

	@Override
	public boolean hasVariables() throws DebugException {
		return false;
	}

	public void setValue(int value) {
		this.value = value;
	}

	public int getValue() {
		return value;
	}

	public short getShortValue() {
		return (short) value;
	}

}
