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
import org.eclipse.debug.core.model.IValue;
import org.eclipse.debug.core.model.IVariable;

import net.resheim.eclipse.cc.builder.model.Label;
import net.resheim.eclipse.cc.vice.debug.model.VICEDebugElement;

public class ArrayValueRow extends VICEDebugElement implements IVariable {

	private int lineNumber;
	private IValue value;

	public ArrayValueRow(IDebugTarget target, Label label, int lineNumber) {
		super(target);
		this.lineNumber = lineNumber;
		this.value = new ArrayValue(getDebugTarget(), label, lineNumber);
	}

	@Override
	public void setValue(String expression) throws DebugException {
	}

	@Override
	public void setValue(IValue value) throws DebugException {
	}

	@Override
	public boolean supportsValueModification() {
		return false;
	}

	@Override
	public boolean verifyValue(String expression) throws DebugException {
		return false;
	}

	@Override
	public boolean verifyValue(IValue value) throws DebugException {
		return false;
	}

	@Override
	public IValue getValue() throws DebugException {
		return value;
	}

	@Override
	public String getName() throws DebugException {
		return "line " + lineNumber;
	}

	@Override
	public String getReferenceTypeName() throws DebugException {
		return "adsf";
	}

	@Override
	public boolean hasValueChanged() throws DebugException {
		return false;
	}

}
