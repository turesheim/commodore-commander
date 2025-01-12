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

import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.model.IDebugTarget;
import org.eclipse.debug.core.model.IIndexedValue;
import org.eclipse.debug.core.model.IVariable;

import net.resheim.eclipse.cc.builder.model.Label;
import net.resheim.eclipse.cc.vice.debug.model.VICEDebugElement;

/**
 * Represents an indexed labeled block of data
 */
public class ArrayValue extends VICEDebugElement implements IIndexedValue {

	IVariable[] variables;
	private Label label;

	public ArrayValue(IDebugTarget target, Label label, int line) {
		super(target);
		this.label = label;
		// compute the variables
		int[] lineLengths = label.getData().getLineLengths();
		// figure out the length of the current line
		int length = lineLengths[line];
		this.variables = new IVariable[length];
		int offset = 0;
		for (int i = 0; i < line; i++) {
			offset += lineLengths[i];
		}
		for (int i = 0; i < length; i++) {
			variables[i] = new Variable(getDebugTarget(), label, "[" + i + "]", offset);
			offset = offset + 1;
		}

	}

	@Override
	public String getReferenceTypeName() throws DebugException {
		return "Data";
	}

	@Override
	public String getValueString() throws DebugException {
		StringBuilder sb = new StringBuilder();
		for (IVariable v : variables) {
			sb.append(v.getValue().getValueString());
			sb.append(" ");
		}
		return sb.toString();
	}

	@Override
	public boolean isAllocated() throws DebugException {
		return true;
	}

	@Override
	public IVariable[] getVariables() throws DebugException {
		return variables;
	}

	@Override
	public boolean hasVariables() throws DebugException {
		return true;
	}

	@Override
	public IVariable getVariable(int offset) throws DebugException {
		return variables[offset];
	}

	@Override
	public IVariable[] getVariables(int offset, int length) throws DebugException {
		IVariable[] subset = new IVariable[length];
		System.arraycopy(variables, 0, subset, offset, length);
		return subset;
	}

	@Override
	public int getSize() throws DebugException {
		return label.getData().getLineLengths().length;
	}

	@Override
	public int getInitialOffset() {
		// TODO Auto-generated method stub
		return 0;
	}

}
