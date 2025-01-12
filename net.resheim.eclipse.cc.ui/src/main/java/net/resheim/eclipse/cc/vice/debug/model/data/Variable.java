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
package net.resheim.eclipse.cc.vice.debug.model.data;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;

import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.model.IDebugTarget;
import org.eclipse.debug.core.model.IValue;
import org.eclipse.debug.core.model.IVariable;

import net.resheim.eclipse.cc.builder.model.Label;
import net.resheim.eclipse.cc.builder.model.Type;
import net.resheim.eclipse.cc.vice.debug.ByteValidator;
import net.resheim.eclipse.cc.vice.debug.DWordValidator;
import net.resheim.eclipse.cc.vice.debug.WordValidator;
import net.resheim.eclipse.cc.vice.debug.model.Scalar;
import net.resheim.eclipse.cc.vice.debug.model.VICEDebugElement;
import net.resheim.eclipse.cc.vice.debug.model.VICEDebugTarget;

public class Variable extends VICEDebugElement implements IVariable {

	private String name;
	private int offset;
	private Label label;
	private Scalar value;


	public Variable(IDebugTarget target, Label label, String name, int offset) {
		super(target);
		this.label = label;
		this.name = name;
		this.offset = offset;
	}

	@Override
	public void setValue(String expression) throws DebugException {
		if (label.getData().getType().equals(Type.BYTE)) {
			byte input = ByteValidator.parseInput(expression);
			((VICEDebugTarget) getDebugTarget()).setComputerMemory(label.getStartAddress() + offset,
					new byte[] { input });
		}
		if (label.getData().getType().equals(Type.WORD)) {
			ByteBuffer bb = ByteBuffer.allocate(2).order(ByteOrder.LITTLE_ENDIAN);
			short input = WordValidator.parseInput(expression);
			bb.putShort(input);
			((VICEDebugTarget) getDebugTarget()).setComputerMemory(label.getStartAddress() + offset, bb.array());
		}
		if (label.getData().getType().equals(Type.DWORD)) {
			ByteBuffer bb = ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN);
			int input = DWordValidator.parseInput(expression);
			bb.putInt(input);
			((VICEDebugTarget) getDebugTarget()).setComputerMemory(label.getStartAddress() + offset, bb.array());
		}
	}

	@Override
	public void setValue(IValue value) throws DebugException {
		this.value = (Scalar) value;
	}

	@Override
	public boolean supportsValueModification() {
		return true;
	}

	@Override
	public boolean verifyValue(String expression) throws DebugException {
		try {
			switch (label.getData().getType()) {
			case BYTE: {
				ByteValidator.parseInput(expression);
				return true;
			}
			case WORD: {
				WordValidator.parseInput(expression);
				return true;
			}
			case DWORD: {
				DWordValidator.parseInput(expression);
				return true;
			}
			default:
				return false;
			}
		} catch (NumberFormatException e) {
			return false;
		}
	}

	@Override
	public boolean verifyValue(IValue value) throws DebugException {
		return false;
	}

	@Override
	public IValue getValue() throws DebugException {
		Type type = label.getData().getType();
		if (value == null) {
			value = new Scalar(getDebugTarget(), 0, type, label.getData().getPresentation());
		}
		byte[] computerMemory = ((VICEDebugTarget) getDebugTarget()).getComputerMemory();
		switch (type) {
		case BYTE: {
			value.setValue(Byte.toUnsignedInt(computerMemory[label.getStartAddress() + offset]));
			break;
		}
		case WORD: {
			value.setValue(Byte.toUnsignedInt(computerMemory[label.getStartAddress() + offset]));
			break;
		}
		case DWORD: {
			value.setValue(Byte.toUnsignedInt(computerMemory[label.getStartAddress() + offset]));
			break;
		}
		default: {
			throw new RuntimeException("Unsupported data type");
		}
		}
		return value;
	}

	@Override
	public String getName() throws DebugException {
		return name;
	}

	@Override
	public String getReferenceTypeName() throws DebugException {
		return "";
	}

	@Override
	public boolean hasValueChanged() throws DebugException {
		return false;
	}

}
