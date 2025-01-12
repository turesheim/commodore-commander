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

public class ArrayValueSet extends VICEDebugElement implements IIndexedValue {

	IVariable[] variables;
	private int length;

	public ArrayValueSet(IDebugTarget target, Label label) {
		super(target);
		length = label.getData().getLineLengths().length;
		this.variables = new IVariable[length];
		for (int i = 0; i < length; i++) {
			variables[i] = new ArrayValueRow(target, label, i);
		}
	}

	@Override
	public String getReferenceTypeName() throws DebugException {
		return "java.lang.Array";
	}

	@Override
	public String getValueString() throws DebugException {
		return "";
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
		return length;
	}

	@Override
	public int getInitialOffset() {
		return 0;
	}

}
